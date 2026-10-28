/* =========================================================
   STORAGE ADAPTER (PUBLIC DEMO: MEMORY ONLY)
   The ONLY file in the project that holds saved data.
   Everything else goes through EF.storage (and, above that, EF.store).

   In this demo copy NOTHING is written to the browser's localStorage.
   Data lives in a plain object in memory, so:
     - every page load starts empty, and demo.js then fills it with the
       sample planner (a fresh start on every refresh, on purpose);
     - the demo can never read, change or delete any other data stored
       by this website, or by the original EashaForge product.

   The functions below behave exactly like the original adapter, so the
   store and the rest of the app need no changes.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var STORAGE_KEY = 'eashaforge.demo.assignment-tracker';
  var RECOVERY_KEY = 'eashaforge.demo.assignment-tracker.recovery';
  var LEGACY_THEME_KEY = 'eashaforge.demo.theme';

  // A tiny stand-in for localStorage that forgets everything on reload
  function createMemoryArea() {
    var items = Object.create(null);
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null;
      },
      setItem: function (key, value) {
        items[key] = String(value);
      },
      removeItem: function (key) {
        delete items[key];
      }
    };
  }

  var area = createMemoryArea();

  function isAvailable() {
    return area !== null;
  }

  // Result: { status, data, raw }
  //   status 'unavailable'  storage is blocked
  //   status 'empty'        nothing saved yet (first run)
  //   status 'corrupt'      something is saved but it is not usable JSON
  //   status 'ok'           data is the parsed object
  function load() {
    if (!area) {
      return { status: 'unavailable', data: null, raw: null };
    }

    var raw;
    try {
      raw = area.getItem(STORAGE_KEY);
    } catch (error) {
      return { status: 'unavailable', data: null, raw: null };
    }

    if (raw === null) {
      return { status: 'empty', data: null, raw: null };
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return { status: 'corrupt', data: null, raw: raw };
    }

    if (!EF.utils.isPlainObject(data)) {
      return { status: 'corrupt', data: null, raw: raw };
    }

    return { status: 'ok', data: data, raw: raw };
  }

  function isQuotaError(error) {
    return !!error && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    );
  }

  // Result: { ok: true }  or  { ok: false, error: 'unavailable' | 'quota' | 'unknown' }
  function save(state) {
    if (!area) {
      return { ok: false, error: 'unavailable' };
    }
    try {
      area.setItem(STORAGE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: isQuotaError(error) ? 'quota' : 'unknown' };
    }
  }

  // Keeps a copy of data we could not read, BEFORE the app starts fresh.
  // Returns true if the copy is safely stored.
  // (A newer problem replaces an older copy: there is one recovery slot.)
  function backupUnreadable(raw, reason) {
    if (!area) {
      return false;
    }
    try {
      area.setItem(RECOVERY_KEY, JSON.stringify({
        savedAt: EF.utils.nowISO(),
        reason: reason,
        raw: raw
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  // ----- Old Phase 1 theme key (kept so the store's start-up code still works) -----

  function readLegacyTheme() {
    if (!area) {
      return null;
    }
    try {
      var value = area.getItem(LEGACY_THEME_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function removeLegacyTheme() {
    if (!area) {
      return;
    }
    try {
      area.removeItem(LEGACY_THEME_KEY);
    } catch (error) {
      // nothing else to do
    }
  }

  // Developer helper: the raw saved text
  function readRaw() {
    if (!area) {
      return null;
    }
    try {
      return area.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  window.EF.storage = {
    STORAGE_KEY: STORAGE_KEY,
    RECOVERY_KEY: RECOVERY_KEY,
    isAvailable: isAvailable,
    load: load,
    save: save,
    backupUnreadable: backupUnreadable,
    readLegacyTheme: readLegacyTheme,
    removeLegacyTheme: removeLegacyTheme,
    readRaw: readRaw
  };
})();