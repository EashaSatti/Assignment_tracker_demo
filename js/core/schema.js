/* =========================================================
   SCHEMA
   Describes the shape of the saved data and cleans it up.

   - createDefaultState()  : the brand new, empty application data
   - normalizeCourse / normalizeAssignment / normalizeTask / ...
        Take ANY object and return a clean one: every field present,
        every value valid, unknown fields removed.
   - normalizeState()      : cleans a whole saved state and repairs
        broken links between records.

   This file stores NOTHING calculated. No totals, no "isOverdue",
   no progress. Those are worked out later from this data.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var utils = EF.utils;

  var CURRENT_VERSION = 1;

  var PRIORITIES = ['low', 'medium', 'high'];
  var ASSIGNMENT_STATUSES = ['not_started', 'in_progress', 'submitted', 'completed'];
  var TASK_STATUSES = ['todo', 'done'];
  var THEMES = ['system', 'light', 'dark'];
  var WEEK_STARTS = ['monday', 'sunday'];

  var DEFAULT_COURSE_COLOR = '#64748B';

  // "Finished" from the student's point of view.
  // Submitted and Completed both count as finished, but stay separate statuses.
  function isAssignmentFinished(status) {
    return status === 'submitted' || status === 'completed';
  }

  function isTaskFinished(status) {
    return status === 'done';
  }

  // ---------- Small cleaning helpers ----------

  // Trimmed text, cut to a maximum length. Non-text becomes ''.
  function text(value, maxLength) {
    if (typeof value !== 'string') {
      return '';
    }
    var trimmed = value.trim();
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  function oneOf(value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
  }

  // A reference to another record: a non-empty id text, or null
  function idOrNull(value) {
    return typeof value === 'string' && value !== '' ? value : null;
  }

  // A valid ISO timestamp text, or null
  function timestampOrNull(value) {
    if (typeof value !== 'string' || isNaN(Date.parse(value))) {
      return null;
    }
    return value;
  }

  // "2026-10-15" if it is a real calendar date, otherwise ''
  function dateOrEmpty(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return '';
    }
    var parts = value.split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    var isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isReal ? value : '';
  }

  // "23:59" (24-hour) if valid, otherwise ''
  function timeOrEmpty(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
  }

  // A whole number from 0 to 100
  function percent(value) {
    var number = Number(value);
    if (!isFinite(number)) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(number)));
  }

  // A whole number of minutes (0 or more), or null when not set
  function minutesOrNull(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    var number = Number(value);
    if (!isFinite(number) || number < 0) {
      return null;
    }
    return Math.round(number);
  }

  // Keeps only entries of an object whose values are text
  function stringMap(value) {
    var result = {};
    if (!utils.isPlainObject(value)) {
      return result;
    }
    Object.keys(value).forEach(function (key) {
      if (typeof value[key] === 'string') {
        result[key] = value[key];
      }
    });
    return result;
  }

  // ---------- Entity normalizers ----------
  // Each returns a NEW object with exactly the agreed fields.
  // (The id is only checked for being text. The caller makes sure it is unique.)

  function normalizeCourse(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    var createdAt = timestampOrNull(source.createdAt) || utils.nowISO();

    return {
      id: typeof source.id === 'string' ? source.id : '',
      name: text(source.name, 100) || 'Untitled course',
      instructor: text(source.instructor, 100),
      color: typeof source.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color : DEFAULT_COURSE_COLOR,
      room: text(source.room, 50),
      notes: text(source.notes, 5000),
      archived: source.archived === true,
      createdAt: createdAt,
      updatedAt: timestampOrNull(source.updatedAt) || createdAt
    };
  }

  function normalizeAssignment(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    var createdAt = timestampOrNull(source.createdAt) || utils.nowISO();
    var updatedAt = timestampOrNull(source.updatedAt) || createdAt;
    var status = oneOf(source.status, ASSIGNMENT_STATUSES, 'not_started');

    // The completedAt rule lives HERE and only here:
    // finished -> must have a time (keep the old one, or use updatedAt)
    // not finished -> must be null
    var completedAt = isAssignmentFinished(status)
      ? (timestampOrNull(source.completedAt) || updatedAt)
      : null;

    return {
      id: typeof source.id === 'string' ? source.id : '',
      title: text(source.title, 200) || 'Untitled assignment',
      courseId: idOrNull(source.courseId),
      description: text(source.description, 5000),
      dueDate: dateOrEmpty(source.dueDate),
      dueTime: timeOrEmpty(source.dueTime),
      priority: oneOf(source.priority, PRIORITIES, 'medium'),
      status: status,
      manualProgress: percent(source.manualProgress),
      estimatedMinutes: minutesOrNull(source.estimatedMinutes),
      notes: text(source.notes, 5000),
      createdAt: createdAt,
      updatedAt: updatedAt,
      completedAt: completedAt
    };
  }

  function normalizeTask(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    var createdAt = timestampOrNull(source.createdAt) || utils.nowISO();
    var updatedAt = timestampOrNull(source.updatedAt) || createdAt;
    var status = oneOf(source.status, TASK_STATUSES, 'todo');
    var assignmentId = idOrNull(source.assignmentId);

    var completedAt = isTaskFinished(status)
      ? (timestampOrNull(source.completedAt) || updatedAt)
      : null;

    return {
      id: typeof source.id === 'string' ? source.id : '',
      title: text(source.title, 200) || 'Untitled task',
      // Rule: a task linked to an assignment gets its course from that
      // assignment, so we do not store a second copy that could go stale.
      courseId: assignmentId !== null ? null : idOrNull(source.courseId),
      assignmentId: assignmentId,
      dueDate: dateOrEmpty(source.dueDate),
      priority: oneOf(source.priority, PRIORITIES, 'medium'),
      status: status,
      estimatedMinutes: minutesOrNull(source.estimatedMinutes),
      notes: text(source.notes, 5000),
      createdAt: createdAt,
      updatedAt: updatedAt,
      completedAt: completedAt
    };
  }

  function normalizeProfile(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    return {
      name: text(source.name, 80)
    };
  }

  function normalizeSettings(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    return {
      theme: oneOf(source.theme, THEMES, 'system'),
      weekStart: oneOf(source.weekStart, WEEK_STARTS, 'monday')
    };
  }

  function normalizeNotificationState(raw) {
    var source = utils.isPlainObject(raw) ? raw : {};
    return {
      read: stringMap(source.read),
      dismissed: stringMap(source.dismissed)
    };
  }

  // ---------- Whole state ----------

  function createDefaultState() {
    return {
      schemaVersion: CURRENT_VERSION,
      courses: [],
      assignments: [],
      tasks: [],
      profile: { name: '' },
      settings: { theme: 'system', weekStart: 'monday' },
      notificationState: { read: {}, dismissed: {} }
    };
  }

  function note(report, message) {
    report.repairs += 1;
    report.notes.push(message);
  }

  // Cleans a list of records, makes sure every id is present and unique
  function normalizeList(list, normalizeItem, prefix, report) {
    var result = [];
    var seen = Object.create(null);

    if (!Array.isArray(list)) {
      return result;
    }

    list.forEach(function (rawItem) {
      if (!utils.isPlainObject(rawItem)) {
        note(report, 'Skipped a saved record that was not an object.');
        return;
      }
      var item = normalizeItem(rawItem);
      if (item.id === '' || seen[item.id]) {
        note(report, item.id === '' ? 'A record had no id; created one.' : 'Two records shared an id; gave one a new id.');
        item.id = utils.generateId(prefix);
      }
      seen[item.id] = true;
      result.push(item);
    });

    return result;
  }

  function idSet(list) {
    var set = Object.create(null);
    list.forEach(function (item) {
      set[item.id] = true;
    });
    return set;
  }

  // Cleans a whole saved state. `report` (optional) collects what was repaired.
  function normalizeState(raw, report) {
    var log = report || { repairs: 0, notes: [] };
    var source = utils.isPlainObject(raw) ? raw : {};

    var courses = normalizeList(source.courses, normalizeCourse, 'c', log);
    var assignments = normalizeList(source.assignments, normalizeAssignment, 'a', log);
    var tasks = normalizeList(source.tasks, normalizeTask, 't', log);

    // Repair broken links (never leave a reference pointing at nothing)
    var courseIds = idSet(courses);

    assignments = assignments.map(function (assignment) {
      if (assignment.courseId !== null && !courseIds[assignment.courseId]) {
        note(log, 'Assignment "' + assignment.title + '" pointed to a missing course; cleared the link.');
        return Object.assign({}, assignment, { courseId: null });
      }
      return assignment;
    });

    var assignmentIds = idSet(assignments);

    tasks = tasks.map(function (task) {
      var fixed = task;
      if (fixed.assignmentId !== null && !assignmentIds[fixed.assignmentId]) {
        note(log, 'Task "' + fixed.title + '" pointed to a missing assignment; cleared the link.');
        fixed = Object.assign({}, fixed, { assignmentId: null });
      }
      if (fixed.assignmentId === null && fixed.courseId !== null && !courseIds[fixed.courseId]) {
        note(log, 'Task "' + fixed.title + '" pointed to a missing course; cleared the link.');
        fixed = Object.assign({}, fixed, { courseId: null });
      }
      return fixed;
    });

    return {
      schemaVersion: CURRENT_VERSION,
      courses: courses,
      assignments: assignments,
      tasks: tasks,
      profile: normalizeProfile(source.profile),
      settings: normalizeSettings(source.settings),
      notificationState: normalizeNotificationState(source.notificationState)
    };
  }

  window.EF.schema = {
    CURRENT_VERSION: CURRENT_VERSION,
    PRIORITIES: PRIORITIES,
    ASSIGNMENT_STATUSES: ASSIGNMENT_STATUSES,
    TASK_STATUSES: TASK_STATUSES,
    THEMES: THEMES,
    WEEK_STARTS: WEEK_STARTS,
    isAssignmentFinished: isAssignmentFinished,
    isTaskFinished: isTaskFinished,
    createDefaultState: createDefaultState,
    normalizeCourse: normalizeCourse,
    normalizeAssignment: normalizeAssignment,
    normalizeTask: normalizeTask,
    normalizeProfile: normalizeProfile,
    normalizeSettings: normalizeSettings,
    normalizeNotificationState: normalizeNotificationState,
    normalizeState: normalizeState
  };
})();