/* =========================================================
   BACKUP FILE FORMAT (create + validate). No page code here.

   A backup file is plain JSON:
     {
       "app": "EashaForge Assignment Tracker",
       "backupVersion": 1,            <- version of THIS wrapper
       "exportedAt": "2026-10-21T...",
       "schemaVersion": 1,            <- version of the data inside
       "data": { courses, assignments, tasks, profile, settings, notificationState }
     }
   Nothing derived (counts, analytics, notifications list) is saved:
   all of that is worked out again from "data" when the app opens.

   validate() checks the WHOLE file and returns a cleaned copy.
   It never touches the store, so a bad file cannot change anything.
   Older schema versions are upgraded with EF.migrations; newer ones
   are refused. Cleaning uses the same EF.schema.normalizeState that
   protects data loaded from localStorage.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var APP_NAME = 'EashaForge Assignment Tracker';
  var FORMAT_VERSION = 1;
  var LISTS = ['courses', 'assignments', 'tasks'];
  var OBJECTS = ['profile', 'settings', 'notificationState'];

  function problem(message) {
    return { ok: false, message: message };
  }

  // state: a plain copy of all data (EF.store.exportData())
  function create(state, now) {
    return {
      app: APP_NAME,
      backupVersion: FORMAT_VERSION,
      exportedAt: (now || new Date()).toISOString(),
      schemaVersion: state.schemaVersion,
      data: state
    };
  }

  function fileName(dateText) {
    return 'eashaforge-backup-' + dateText + '.json';
  }

  // Result: { ok: true, state, summary } or { ok: false, message }
  function validate(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      return problem('The file is empty.');
    }

    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return problem('This file is not readable JSON, so it cannot be an EashaForge backup. It may be damaged or the wrong file.');
    }

    if (!EF.utils.isPlainObject(parsed) || parsed.app !== APP_NAME) {
      return problem('This is not an EashaForge Assignment Tracker backup file.');
    }

    var version = parsed.backupVersion;
    if (typeof version !== 'number' || !isFinite(version) || version < 1 || Math.floor(version) !== version) {
      return problem('This backup has an unknown format.');
    }
    if (version > FORMAT_VERSION) {
      return problem('This backup was made by a newer version of EashaForge. Please update EashaForge and try again.');
    }

    var data = parsed.data;
    if (!EF.utils.isPlainObject(data)) {
      return problem('This backup contains no data.');
    }
    for (var i = 0; i < LISTS.length; i += 1) {
      if (!Array.isArray(data[LISTS[i]])) {
        return problem('This backup is incomplete: its list of ' + LISTS[i] + ' is missing or damaged.');
      }
    }
    for (var j = 0; j < OBJECTS.length; j += 1) {
      if (data[OBJECTS[j]] !== undefined && !EF.utils.isPlainObject(data[OBJECTS[j]])) {
        return problem('This backup is damaged: its ' + OBJECTS[j] + ' section is not valid.');
      }
    }

    var migration = EF.migrations.migrate(data);
    if (!migration.ok) {
      return problem(migration.reason === 'newer'
        ? 'This backup\'s data was made by a newer version of EashaForge. Please update EashaForge and try again.'
        : 'This backup is from a version that cannot be upgraded safely.');
    }

    var report = { repairs: 0, notes: [] };
    var state = EF.schema.normalizeState(migration.data, report);

    return {
      ok: true,
      state: state,
      summary: {
        courses: state.courses.length,
        assignments: state.assignments.length,
        tasks: state.tasks.length,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
        repairs: report.repairs,
        upgraded: migration.changed
      }
    };
  }

  window.EF.backup = {
    APP_NAME: APP_NAME,
    FORMAT_VERSION: FORMAT_VERSION,
    create: create,
    fileName: fileName,
    validate: validate
  };
})();