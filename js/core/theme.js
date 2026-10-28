/* =========================================================
   THEME (light / dark)

   The saved preference now lives in the central store:
       state.settings.theme  =  'system' | 'light' | 'dark'
   'system' means "follow the device setting".

   Flow:  toggle() -> store.updateSettings({ theme }) -> store notifies
          -> this file applies the theme to the page.

   This file no longer touches localStorage. The old Phase 1 key
   (eashaforge.theme) is migrated and removed by the store/storage layer.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var listeners = [];

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // Turns the preference ('system' / 'light' / 'dark') into the theme to SHOW
  function resolve(preference) {
    if (preference === 'light' || preference === 'dark') {
      return preference;
    }
    return systemPrefersDark() ? 'dark' : 'light';
  }

  // The theme currently shown on the page: 'light' or 'dark'
  function current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  // What the user chose: 'system', 'light' or 'dark'
  function getPreference() {
    return EF.store.getState().settings.theme;
  }

  function setPreference(preference) {
    return EF.store.updateSettings({ theme: preference });
  }

  // The top-bar button: flips between light and dark (an explicit choice)
  function toggle() {
    setPreference(current() === 'dark' ? 'light' : 'dark');
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    listeners.forEach(function (callback) { callback(theme); });
  }

  // Other files can ask to be told when the shown theme changes
  function onChange(callback) {
    listeners.push(callback);
  }

  function syncWithStore() {
    var shown = resolve(getPreference());
    if (shown !== current()) {
      apply(shown);
    }
  }

  window.EF.theme = {
    current: current,
    getPreference: getPreference,
    setPreference: setPreference,
    toggle: toggle,
    onChange: onChange
  };

  // 1. Apply the saved preference before the page is painted
  apply(resolve(getPreference()));

  // 2. React whenever the store says settings changed
  EF.store.subscribe(function (state, change) {
    if (change.changed.indexOf('settings') !== -1) {
      syncWithStore();
    }
  });

  // 3. If the preference is 'system', follow the device when it changes
  if (window.matchMedia) {
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var handleSystemChange = function () {
      if (getPreference() === 'system') {
        syncWithStore();
      }
    };
    if (media.addEventListener) {
      media.addEventListener('change', handleSystemChange);
    } else if (media.addListener) {
      media.addListener(handleSystemChange); // older Safari
    }
  }
})();