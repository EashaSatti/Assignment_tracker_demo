/* =========================================================
   MIGRATIONS
   Upgrades OLD saved data to the shape the current app expects.

   How it works:
   - Saved data carries a number: schemaVersion.
   - The app knows its own CURRENT version (EF.schema.CURRENT_VERSION).
   - If saved data is older, we run upgrade steps one by one:
         version 1 -> 2 -> 3 -> ... -> current

   Right now the current version is 1, so there are no steps yet.

   HOW TO ADD A STEP IN THE FUTURE (example: version 2 adds a setting):
     1. Change CURRENT_VERSION in schema.js from 1 to 2 and update the
        defaults / normalizers there.
     2. Add this to STEPS below:
          1: function (data) {
            data.settings = data.settings || {};
            data.settings.compactMode = false;
            return data;
          }
        (The number is the version you are upgrading FROM.)
   Never edit or delete an old step. Buyers on old versions still need it.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var STEPS = {
    // 1: function (data) { ... return data; }   (version 1 -> 2, not needed yet)
  };

  // Reads the version number. Missing or invalid is treated as version 1,
  // the first version that ever existed.
  function readVersion(data) {
    var version = data.schemaVersion;
    if (typeof version !== 'number' || !isFinite(version) || version < 1 || Math.floor(version) !== version) {
      return 1;
    }
    return version;
  }

  // Result:
  //   { ok: true,  data, fromVersion, changed }   upgraded (or already current)
  //   { ok: false, reason: 'newer' | 'no-step' | 'step-failed' }   cannot be used safely
  function migrate(data) {
    var target = EF.schema.CURRENT_VERSION;
    var fromVersion = readVersion(data);
    var version = fromVersion;
    var working = data;

    // Saved by a NEWER version of the app: we must not guess. The caller protects the data.
    if (version > target) {
      return { ok: false, reason: 'newer', fromVersion: fromVersion };
    }

    while (version < target) {
      var step = STEPS[version];
      if (typeof step !== 'function') {
        return { ok: false, reason: 'no-step', fromVersion: fromVersion };
      }
      try {
        working = step(working);
      } catch (error) {
        return { ok: false, reason: 'step-failed', fromVersion: fromVersion };
      }
      version += 1;
      working.schemaVersion = version;
    }

    return { ok: true, data: working, fromVersion: fromVersion, changed: fromVersion !== target };
  }

  window.EF.migrations = { migrate: migrate };
})();