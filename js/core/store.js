/* =========================================================
   STORE
   The single source of truth for all application data.

   Flow for every change:
     action (e.g. addCourse)
       -> builds a NEW state (we never edit the old one in place)
       -> schedules a save to localStorage (debounced)
       -> tells every subscriber "data changed"

   RULES FOR THE REST OF THE APP
   1. Read data with EF.store.getState(). Treat it as READ-ONLY.
   2. Change data only through the actions below.
   3. Never store calculated values (totals, overdue flags, progress).
   4. Do not call store actions inside a subscribe callback
      (that would trigger the callbacks again, in a loop).

   Every action returns:
     { ok: true, item }               it worked
     { ok: true, unchanged: true }    nothing was different, nothing written
     { ok: false, reason, message }   it was refused (message is user-friendly)
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var utils = EF.utils;
  var schema = EF.schema;

  var SAVE_DELAY_MS = 300;
  var PROTECTED_FIELDS = ['id', 'createdAt', 'updatedAt', 'completedAt'];
  var ALL_PARTS = ['courses', 'assignments', 'tasks', 'profile', 'settings', 'notificationState'];

  var MESSAGES = {
    recovered: 'Your saved data could not be read, so EashaForge started fresh. A safety copy of the unreadable data was kept.',
    unreadableNoCopy: 'Your saved data could not be read and a safety copy could not be made. To protect it, changes will not be saved in this session.',
    newer: 'Your saved data was made by a newer version of EashaForge. To protect it, this version will not save any changes.',
    cannotUpgrade: 'Your saved data could not be upgraded safely. To protect it, changes will not be saved in this session.',
    noStorage: 'Your browser is blocking local storage, so your changes cannot be kept after you close this page.',
    quota: 'Your latest changes could not be saved because browser storage is full.',
    saveFailed: 'Your latest changes could not be saved. We will try again with your next change.'
  };

  var state = schema.createDefaultState();
  var revision = 0;                // goes up by 1 on every change (handy for caching later)
  var subscribers = [];
  var statusListeners = [];
  var status = { code: 'ok', canSave: true, message: '' };
  var saveTimer = null;
  var hasUnsavedChanges = false;

  // ---------- small helpers ----------

  function safeCall(callback, first, second) {
    try {
      callback(first, second);
    } catch (error) {
      if (window.console) {
        console.error('EashaForge: a subscriber failed', error);
      }
    }
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function fail(reason, message, extra) {
    return Object.assign({ ok: false, reason: reason, message: message }, extra || {});
  }

  function findIndexById(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  function hasId(list, id) {
    return findIndexById(list, id) !== -1;
  }

  function stripProtected(fields) {
    var clean = {};
    Object.keys(fields || {}).forEach(function (key) {
      if (PROTECTED_FIELDS.indexOf(key) === -1) {
        clean[key] = fields[key];
      }
    });
    return clean;
  }

  // Same content? (updatedAt is ignored, so "no real change" is detected)
  function isSameRecord(a, b) {
    return Object.keys(b).every(function (key) {
      return key === 'updatedAt' || a[key] === b[key];
    });
  }

  function copyState() {
    return Object.assign({}, state);
  }

  // ---------- status ----------

  function getStatus() {
    return { code: status.code, canSave: status.canSave, message: status.message };
  }

  function setStatus(code, canSave, message) {
    var changed = status.code !== code;
    status = { code: code, canSave: canSave, message: message || '' };
    if (changed) {
      statusListeners.slice().forEach(function (callback) {
        safeCall(callback, getStatus());
      });
    }
  }

  function onStatusChange(callback) {
    statusListeners.push(callback);
  }

  // ---------- saving (debounced) ----------

  function flushSave() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!status.canSave) {
      hasUnsavedChanges = false;
      return false;
    }

    var result = EF.storage.save(state);
    if (result.ok) {
      hasUnsavedChanges = false;
      if (status.code === 'save-failed') {
        setStatus('ok', true, '');
      }
      return true;
    }

    setStatus('save-failed', true, result.error === 'quota' ? MESSAGES.quota : MESSAGES.saveFailed);
    return false;
  }

  function scheduleSave() {
    hasUnsavedChanges = true;
    if (!status.canSave) {
      return;
    }
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
  }

  function flushIfNeeded() {
    if (hasUnsavedChanges) {
      flushSave();
    }
  }

  // ---------- subscribe / notify ----------

  // Usage:  var stop = EF.store.subscribe(function (state, change) { ... });
  //         stop();   // later, to unsubscribe
  // `change` looks like { action: 'addCourse', changed: ['courses'], id: 'c_...', revision: 4 }
  function subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('EF.store.subscribe needs a function');
    }
    subscribers.push(callback);
    return function unsubscribe() {
      var index = subscribers.indexOf(callback);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  function notify(meta) {
    var change = Object.assign({ revision: revision }, meta);
    subscribers.slice().forEach(function (callback) {
      safeCall(callback, state, change);
    });
  }

  // The ONE place where state is replaced.
  function commit(nextState, meta) {
    state = nextState;
    revision += 1;
    scheduleSave();   // 1. persistence is scheduled
    notify(meta);     // 2. subscribers are told
  }

  // ---------- generic add / update / delete ----------

  function addEntity(collection, prefix, normalizeItem, fields, validate, actionName) {
    var now = utils.nowISO();
    var item = normalizeItem(Object.assign({}, stripProtected(fields), {
      id: utils.generateId(prefix),
      createdAt: now,
      updatedAt: now
    }));

    var problem = validate ? validate(item) : null;
    if (problem) {
      return fail(problem.reason, problem.message);
    }

    var next = copyState();
    next[collection] = state[collection].concat([item]);
    commit(next, { action: actionName, changed: [collection], id: item.id });
    return { ok: true, item: item };
  }

  function updateEntity(collection, id, changes, normalizeItem, validate, actionName) {
    var list = state[collection];
    var index = findIndexById(list, id);
    if (index === -1) {
      return fail('not-found', 'That item no longer exists.');
    }

    var existing = list[index];
    // id, createdAt and completedAt always come from the existing record.
    // updatedAt is new. completedAt is then settled by the normalizer from the status.
    var item = normalizeItem(Object.assign({}, existing, stripProtected(changes), {
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: utils.nowISO(),
      completedAt: existing.completedAt
    }));

    var problem = validate ? validate(item) : null;
    if (problem) {
      return fail(problem.reason, problem.message);
    }

    if (isSameRecord(existing, item)) {
      return { ok: true, item: existing, unchanged: true };
    }

    var nextList = list.slice();
    nextList[index] = item;
    var next = copyState();
    next[collection] = nextList;
    commit(next, { action: actionName, changed: [collection], id: id });
    return { ok: true, item: item };
  }

  function deleteEntity(collection, id, actionName) {
    if (!hasId(state[collection], id)) {
      return fail('not-found', 'That item no longer exists.');
    }
    var next = copyState();
    next[collection] = state[collection].filter(function (item) {
      return item.id !== id;
    });
    commit(next, { action: actionName, changed: [collection], id: id });
    return { ok: true };
  }

  function updateObject(key, normalizeObject, changes, actionName) {
    var item = normalizeObject(Object.assign({}, state[key], changes || {}));
    if (isSameRecord(state[key], item)) {
      return { ok: true, unchanged: true };
    }
    var next = copyState();
    next[key] = item;
    commit(next, { action: actionName, changed: [key] });
    return { ok: true, value: item };
  }

  // ---------- relationship checks ----------

  function validateAssignment(item) {
    if (item.courseId !== null && !hasId(state.courses, item.courseId)) {
      return { reason: 'invalid-course', message: 'That course does not exist.' };
    }
    return null;
  }

  function validateTask(item) {
    if (item.assignmentId !== null && !hasId(state.assignments, item.assignmentId)) {
      return { reason: 'invalid-assignment', message: 'That assignment does not exist.' };
    }
    if (item.courseId !== null && !hasId(state.courses, item.courseId)) {
      return { reason: 'invalid-course', message: 'That course does not exist.' };
    }
    return null;
  }

  // ---------- reading ----------

  function getState() { return state; }
  function getRevision() { return revision; }

  function getCourse(id) { return state.courses[findIndexById(state.courses, id)] || null; }
  function getAssignment(id) { return state.assignments[findIndexById(state.assignments, id)] || null; }
  function getTask(id) { return state.tasks[findIndexById(state.tasks, id)] || null; }

  // How many records still point at this course? (Counted when asked, never stored.)
  function getCourseUsage(courseId) {
    return {
      assignments: state.assignments.filter(function (a) { return a.courseId === courseId; }).length,
      tasks: state.tasks.filter(function (t) { return t.courseId === courseId; }).length
    };
  }

  function getAssignmentUsage(assignmentId) {
    return {
      tasks: state.tasks.filter(function (t) { return t.assignmentId === assignmentId; }).length
    };
  }
    // "What would be affected if this course went away?"
  // Counted when asked (never stored). `tasks` includes tasks inside the
  // course's assignments, so the number matches what a full delete removes.
  function getCourseImpact(courseId) {
    var assignmentIds = Object.create(null);
    var assignmentCount = 0;
    state.assignments.forEach(function (assignment) {
      if (assignment.courseId === courseId) {
        assignmentIds[assignment.id] = true;
        assignmentCount += 1;
      }
    });

    var taskCount = 0;
    state.tasks.forEach(function (task) {
      if (task.courseId === courseId) {
        taskCount += 1; // a standalone task of this course
      } else if (task.assignmentId !== null && assignmentIds[task.assignmentId]) {
        taskCount += 1; // a task inside one of its assignments
      }
    });

    return {
      assignments: assignmentCount,
      tasks: taskCount,
      total: assignmentCount + taskCount
    };
  }

  // ---------- COURSE actions ----------

  // A course must have a real name: not empty, not only spaces.
  function hasText(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function addCourse(fields) {
    if (!fields || !hasText(fields.name)) {
      return fail('name-required', 'Please enter a course name.');
    }
    return addEntity('courses', 'c', schema.normalizeCourse, fields, null, 'addCourse');
  }

  function updateCourse(id, changes) {
    // Only check the name if the caller is actually trying to change it
    if (changes && Object.prototype.hasOwnProperty.call(changes, 'name') && !hasText(changes.name)) {
      return fail('name-required', 'Please enter a course name.');
    }
    return updateEntity('courses', id, changes, schema.normalizeCourse, null, 'updateCourse');
  }

  // archiveCourse(id) archives. archiveCourse(id, false) brings it back.
  function archiveCourse(id, archived) {
    return updateEntity('courses', id, { archived: archived !== false }, schema.normalizeCourse, null, 'archiveCourse');
  }

  // deleteCourse(id)
  //    Default. Refused while any assignment or standalone task uses the course.
  // deleteCourse(id, { linkedItems: 'move', moveToCourseId: 'c_...' })
  //    Moves the course's assignments and standalone tasks to another ACTIVE
  //    course, then deletes this one. Only the courseId link changes.
  //    (Tasks that belong to an assignment follow that assignment automatically.)
  // deleteCourse(id, { linkedItems: 'delete' })
  //    Deletes the course AND its assignments AND all of their tasks.
  // Everything happens in ONE change, so subscribers are told once.
  function deleteCourse(id, options) {
    var mode = (options && options.linkedItems) || 'reject';
    if (['reject', 'move', 'delete'].indexOf(mode) === -1) {
      return fail('invalid-option', 'Unknown option for linked items.');
    }
    if (!hasId(state.courses, id)) {
      return fail('not-found', 'That course no longer exists.');
    }

    var usage = getCourseUsage(id);
    var inUse = usage.assignments > 0 || usage.tasks > 0;

    if (inUse && mode === 'reject') {
      return fail('in-use',
        'This course still has ' + plural(usage.assignments, 'assignment') + ' and ' + plural(usage.tasks, 'task') +
        '. Archive it, or choose what should happen to those items.',
        { usage: usage });
    }

    var next = copyState();
    var changed = ['courses'];
    next.courses = state.courses.filter(function (course) {
      return course.id !== id;
    });

    if (inUse && mode === 'move') {
      var target = getCourse(options.moveToCourseId);
      if (!target || target.id === id || target.archived) {
        return fail('invalid-course', 'Choose a different, active course to move the items to.');
      }
      var now = utils.nowISO();
      if (usage.assignments > 0) {
        changed.push('assignments');
        next.assignments = state.assignments.map(function (assignment) {
          return assignment.courseId === id
            ? Object.assign({}, assignment, { courseId: target.id, updatedAt: now })
            : assignment;
        });
      }
      if (usage.tasks > 0) {
        changed.push('tasks');
        next.tasks = state.tasks.map(function (task) {
          return task.courseId === id
            ? Object.assign({}, task, { courseId: target.id, updatedAt: now })
            : task;
        });
      }
    }

    if (inUse && mode === 'delete') {
      var removedAssignments = Object.create(null);
      state.assignments.forEach(function (assignment) {
        if (assignment.courseId === id) {
          removedAssignments[assignment.id] = true;
        }
      });
      if (usage.assignments > 0) {
        changed.push('assignments');
        next.assignments = state.assignments.filter(function (assignment) {
          return assignment.courseId !== id;
        });
      }
      var keptTasks = state.tasks.filter(function (task) {
        if (task.courseId === id) {
          return false; // a standalone task of this course
        }
        if (task.assignmentId !== null && removedAssignments[task.assignmentId]) {
          return false; // a task inside a deleted assignment
        }
        return true;
      });
      if (keptTasks.length !== state.tasks.length) {
        changed.push('tasks');
        next.tasks = keptTasks;
      }
    }

    commit(next, { action: 'deleteCourse', changed: changed, id: id });
    return { ok: true };
  }
  

  // ---------- ASSIGNMENT actions ----------

  // Does the schema accept this value exactly as given? The schema quietly
  // repairs bad values, so we ask it and compare. One rule set, no copies.
  function schemaKeeps(field, value) {
    var probe = {};
    probe[field] = value;
    return schema.normalizeAssignment(probe)[field] === value;
  }

  function isBlank(value) {
    return value === undefined || value === null || value === '';
  }

  // Checks the RAW fields a caller sends (before the schema repairs anything).
  // `after` is how the record would look once saved. Returns a refusal, or null if fine.
  function checkAssignmentInput(input, after, isNew) {
    function has(key) {
      return Object.prototype.hasOwnProperty.call(input, key);
    }

    if ((isNew || has('title')) && !hasText(input.title)) {
      return fail('title-required', 'Please enter an assignment title.');
    }
    if (has('dueDate') && !isBlank(input.dueDate) && !schemaKeeps('dueDate', input.dueDate)) {
      return fail('invalid-date', 'Please enter a valid due date.');
    }
    if (has('dueTime') && !isBlank(input.dueTime) && !schemaKeeps('dueTime', input.dueTime)) {
      return fail('invalid-time', 'Please enter a valid due time.');
    }
    // Only checked when the caller touches the date or time, so an old record is never blocked
    if ((has('dueDate') || has('dueTime')) && !isBlank(after.dueTime) && isBlank(after.dueDate)) {
      return fail('time-without-date', 'A due time needs a due date. Add a date or clear the time.');
    }
    if (has('priority') && !schemaKeeps('priority', input.priority)) {
      return fail('invalid-priority', 'Priority must be Low, Medium or High.');
    }
    if (has('status') && !schemaKeeps('status', input.status)) {
      return fail('invalid-status', 'Please choose a valid status.');
    }
    if (has('estimatedMinutes') && !isBlank(input.estimatedMinutes) && !schemaKeeps('estimatedMinutes', input.estimatedMinutes)) {
      return fail('invalid-estimate', 'Estimated time must be a whole number of minutes, 0 or more.');
    }
    return null;
  }

  function addAssignment(fields) {
    var input = fields || {};
    var problem = checkAssignmentInput(input, input, true);
    if (problem) {
      return problem;
    }
    return addEntity('assignments', 'a', schema.normalizeAssignment, input, validateAssignment, 'addAssignment');
  }

  function updateAssignment(id, changes) {
    var input = changes || {};
    var existing = getAssignment(id);
    if (existing) {
      var problem = checkAssignmentInput(input, Object.assign({}, existing, input), false);
      if (problem) {
        return problem;
      }
    }
    return updateEntity('assignments', id, input, schema.normalizeAssignment, validateAssignment, 'updateAssignment');
  }

  // options.linkedTasks decides what happens to tasks linked to this assignment:
  //   'reject'  (default) refuse to delete while linked tasks exist
  //   'delete'  delete the linked tasks too
  //   'detach'  keep the tasks as standalone tasks (they keep the assignment's course)
  function deleteAssignment(id, options) {
    var mode = (options && options.linkedTasks) || 'reject';
    if (['reject', 'delete', 'detach'].indexOf(mode) === -1) {
      return fail('invalid-option', 'Unknown option for linked tasks.');
    }

    var index = findIndexById(state.assignments, id);
    if (index === -1) {
      return fail('not-found', 'That assignment no longer exists.');
    }
    var assignment = state.assignments[index];

    var linkedCount = getAssignmentUsage(id).tasks;
    if (linkedCount > 0 && mode === 'reject') {
      return fail('has-linked-tasks',
        'This assignment still has ' + plural(linkedCount, 'linked task') + '. Choose what to do with them first.',
        { taskCount: linkedCount });
    }

    var next = copyState();
    var changed = ['assignments'];
    next.assignments = state.assignments.filter(function (a) { return a.id !== id; });

    if (linkedCount > 0) {
      changed.push('tasks');
      if (mode === 'delete') {
        next.tasks = state.tasks.filter(function (t) { return t.assignmentId !== id; });
      } else {
        var now = utils.nowISO();
        next.tasks = state.tasks.map(function (task) {
          if (task.assignmentId !== id) {
            return task;
          }
          return Object.assign({}, task, { assignmentId: null, courseId: assignment.courseId, updatedAt: now });
        });
      }
    }

    commit(next, { action: 'deleteAssignment', changed: changed, id: id });
    return { ok: true };
  }

  // ---------- TASK actions ----------

  function addTask(fields) {
    return addEntity('tasks', 't', schema.normalizeTask, fields, validateTask, 'addTask');
  }

  function updateTask(id, changes) {
    return updateEntity('tasks', id, changes, schema.normalizeTask, validateTask, 'updateTask');
  }

  function deleteTask(id) {
    return deleteEntity('tasks', id, 'deleteTask');
  }

  // ---------- PROFILE and SETTINGS actions ----------

  function updateProfile(changes) {
    return updateObject('profile', schema.normalizeProfile, changes, 'updateProfile');
  }

  function updateSettings(changes) {
    return updateObject('settings', schema.normalizeSettings, changes, 'updateSettings');
  }

    // Saves which reminders were read or dismissed (see notification-selectors.js)
  function updateNotificationState(changes) {
    return updateObject('notificationState', schema.normalizeNotificationState, changes, 'updateNotificationState');
  }
  // ---------- whole-data operations ----------

  // A plain copy of ALL application data, ready to become a backup file later.
  function exportData() {
    return JSON.parse(JSON.stringify(state));
  }

  // Erases everything and returns to the empty default state.
  // Developer tool for now; a future Settings button will use it.
  function resetAllData() {
    commit(schema.createDefaultState(), { action: 'resetAllData', changed: ALL_PARTS.slice() });
    flushSave();
    return { ok: true };
  }
    // Replaces EVERYTHING with data that was already checked by EF.backup.validate (used by Restore).
  // The new data is saved first. If saving fails, nothing changes.
  function replaceAllData(newState) {
    if (!status.canSave) {
      return fail('read-only', 'Saving is turned off in this session to protect your existing data, so a backup cannot be restored now.');
    }
    var clean = schema.normalizeState(newState);
    if (EF.storage.isAvailable()) {
      var result = EF.storage.save(clean);
      if (!result.ok) {
        return fail('save-failed', result.error === 'quota' ? MESSAGES.quota : MESSAGES.saveFailed);
      }
    }
    commit(clean, { action: 'replaceAllData', changed: ALL_PARTS.slice() });
    flushSave();
    return { ok: true };
  }

  // ---------- start-up ----------

  function init() {
    var loaded = EF.storage.load();
    var needsInitialSave = false;

    function importLegacyTheme() {
      var legacyTheme = EF.storage.readLegacyTheme();
      if (legacyTheme) {
        state.settings.theme = legacyTheme;
      }
    }

    if (loaded.status === 'unavailable') {
      state = schema.createDefaultState();
      setStatus('no-storage', false, MESSAGES.noStorage);

    } else if (loaded.status === 'empty') {
      state = schema.createDefaultState();
      importLegacyTheme();
      needsInitialSave = true;
      setStatus('first-run', true, '');

    } else if (loaded.status === 'corrupt') {
      state = schema.createDefaultState();
      importLegacyTheme();
      if (EF.storage.backupUnreadable(loaded.raw, 'Saved data could not be parsed')) {
        needsInitialSave = true;
        setStatus('recovered', true, MESSAGES.recovered);
      } else {
        setStatus('read-only', false, MESSAGES.unreadableNoCopy);
      }

    } else {
      var migration = EF.migrations.migrate(loaded.data);
      if (!migration.ok) {
        // Leave the saved data completely untouched; run empty in memory.
        state = schema.createDefaultState();
        setStatus('read-only', false, migration.reason === 'newer' ? MESSAGES.newer : MESSAGES.cannotUpgrade);
      } else {
        var report = { repairs: 0, notes: [] };
        state = schema.normalizeState(migration.data, report);
        if (report.repairs > 0 && window.console) {
          console.warn('EashaForge repaired saved data:', report.notes);
        }
        needsInitialSave = migration.changed || report.repairs > 0;
      }
    }

    if (needsInitialSave) {
      // Save right away. Only once the central copy is safely stored do we
      // remove the old Phase 1 theme key.
      if (flushSave()) {
        EF.storage.removeLegacyTheme();
      }
    } else if (status.canSave) {
      EF.storage.removeLegacyTheme();
    }
  }

  init();

  // Save immediately when the page is hidden or closed, so a change made
  // less than 300 ms before closing is never lost.
  window.addEventListener('pagehide', flushIfNeeded);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      flushIfNeeded();
    }
  });

  window.EF.store = {
    getState: getState,
    getRevision: getRevision,
    getStatus: getStatus,
    subscribe: subscribe,
    onStatusChange: onStatusChange,

    getCourse: getCourse,
    getAssignment: getAssignment,
    getTask: getTask,
    getCourseUsage: getCourseUsage,
    getAssignmentUsage: getAssignmentUsage,
    getCourseImpact: getCourseImpact,

    addCourse: addCourse,
    updateCourse: updateCourse,
    archiveCourse: archiveCourse,
    deleteCourse: deleteCourse,

    addAssignment: addAssignment,
    updateAssignment: updateAssignment,
    deleteAssignment: deleteAssignment,

    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,

    updateProfile: updateProfile,
        updateNotificationState: updateNotificationState,
    updateSettings: updateSettings,

    exportData: exportData,
        replaceAllData: replaceAllData,
    resetAllData: resetAllData,
    flushSave: flushSave
  };
})();