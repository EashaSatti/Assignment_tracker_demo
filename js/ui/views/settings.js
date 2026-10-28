/* =========================================================
   SETTINGS SCREEN
   - Profile name, theme, first day of the week (all saved through
     the central store: updateProfile / updateSettings).
   - Export backup, Restore backup and Reset all data: shown so visitors
     can see what the full product offers, but DISABLED in the live demo.
     Their code is not included in this demo copy.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;

  var THEMES = [
    { value: 'system', label: 'Match my device', icon: 'settings' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' }
  ];
  var WEEK_STARTS = [
    { value: 'monday', label: 'Monday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function countsText(courses, assignments, tasks) {
    return plural(courses, 'course') + ', ' + plural(assignments, 'assignment') + ', ' + plural(tasks, 'task');
  }

  function segmentedHtml(label, action, options, selected) {
    return '<div class="segmented" role="group" aria-label="' + esc(label) + '">' + options.map(function (option) {
      return '<button type="button" class="segmented__btn" data-action="' + action + '" data-value="' + option.value + '" aria-pressed="' +
        (option.value === selected ? 'true' : 'false') + '">' + (option.icon ? icon(option.icon) : '') + esc(option.label) + '</button>';
    }).join('') + '</div>';
  }

  function bannerHtml(type, text) {
    var iconName = type === 'danger' ? 'alert' : type === 'success' ? 'check-circle' : 'info';
    return '<div class="banner banner--' + (type === 'danger' ? 'warning' : type === 'success' ? 'info' : type) + '" role="' + (type === 'danger' ? 'alert' : 'status') + '">' +
      '<span class="banner__icon">' + icon(iconName) + '</span><span>' + esc(text) + '</span></div>';
  }

  // ---------- the screen ----------

  function render(page) {
    var storageNote = EF.storage.isAvailable()
      ? ''
      : bannerHtml('warning', 'Your browser is blocking local storage, so changes are lost when you close this page. Export a backup before you leave.');

    page.innerHTML =
      '<div class="set-page">' +
        storageNote +

        '<section class="card set-card" aria-labelledby="set-profile-title">' +
          '<h2 class="set-card__title" id="set-profile-title">' + icon('user') + 'Profile</h2>' +
          '<form class="set-form" id="set-profile-form" novalidate>' +
            '<div class="field">' +
              '<label class="field__label" for="set-name">Your name</label>' +
              '<input class="input" id="set-name" type="text" maxlength="80" autocomplete="off">' +
              '<span class="field__hint">Used for a friendly greeting. It stays on this device.</span>' +
            '</div>' +
            '<div><button type="submit" class="btn btn--primary">' + icon('check') + 'Save name</button></div>' +
          '</form>' +
        '</section>' +

        '<section class="card set-card" aria-labelledby="set-prefs-title">' +
          '<h2 class="set-card__title" id="set-prefs-title">' + icon('settings') + 'Preferences</h2>' +
          '<div class="set-field">' +
            '<p class="field__label" id="set-theme-label">Theme</p>' +
            '<div id="set-theme"></div>' +
            '<p class="field__hint">Light and Dark can also be switched with the button at the top of every screen.</p>' +
          '</div>' +
          '<div class="set-field">' +
            '<p class="field__label" id="set-week-label">Week starts on</p>' +
            '<div id="set-week"></div>' +
            '<p class="field__hint">Used by the Calendar.</p>' +
          '</div>' +
        '</section>' +

        '<section class="card set-card" aria-labelledby="set-backup-title">' +
          '<h2 class="set-card__title" id="set-backup-title">' + icon('archive') + 'Backup &amp; restore</h2>' +
          '<p class="set-card__text" id="set-data-summary"></p>' +
          '<p class="set-card__text">Your data lives only in this browser. Export a backup file now and then, and before clearing browser data or changing computers.</p>' +
          '<div class="cluster">' +
            '<button type="button" class="btn btn--primary" data-action="export" disabled aria-disabled="true" aria-describedby="set-backup-demo-note" title="Available in the full version">' + icon('archive') + 'Export backup</button>' +
            '<button type="button" class="btn btn--secondary" data-action="choose-file" disabled aria-disabled="true" aria-describedby="set-backup-demo-note" title="Available in the full version">' + icon('restore') + 'Restore from backup\u2026</button>' +
          '</div>' +
          '<p class="field__hint" id="set-backup-demo-note">' + icon('info') + ' Available in the full version. This feature is disabled in the live demo.</p>' +
        '</section>' +

        '<section class="card set-card set-card--danger" aria-labelledby="set-reset-title">' +
          '<h2 class="set-card__title" id="set-reset-title">' + icon('alert') + 'Reset all data</h2>' +
          '<p class="set-card__text">Permanently deletes every course, assignment, task, reminder state and setting on this device. This cannot be undone, so export a backup first.</p>' +
          '<div><button type="button" class="btn btn--danger" data-action="reset" disabled aria-disabled="true" aria-describedby="set-reset-demo-note" title="Available in the full version">' + icon('trash') + 'Reset all data\u2026</button></div>' +
          '<p class="field__hint" id="set-reset-demo-note">' + icon('info') + ' Available in the full version. This feature is disabled in the live demo. Use <em>Reset demo</em> at the top of the page to restore the sample data.</p>' +
        '</section>' +
      '</div>';

    var el = {
      name: page.querySelector('#set-name'),
      theme: page.querySelector('#set-theme'),
      week: page.querySelector('#set-week'),
      summary: page.querySelector('#set-data-summary')
    };

    // Reads the store and updates what can change. The name box is not touched while you type in it.
    function refresh(forceName) {
      var state = EF.store.getState();
      el.theme.innerHTML = segmentedHtml('Theme', 'theme', THEMES, state.settings.theme);
      el.week.innerHTML = segmentedHtml('Week starts on', 'week', WEEK_STARTS, state.settings.weekStart);
      el.summary.textContent = 'Currently stored: ' + countsText(state.courses.length, state.assignments.length, state.tasks.length) + '.';
      if (forceName || document.activeElement !== el.name) {
        el.name.value = state.profile.name;
      }
    }

    // ---------- events (one listener per kind, for the whole screen) ----------

    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');
      var value = target.getAttribute('data-value');

      if (action === 'theme') {
        EF.theme.setPreference(value);
      } else if (action === 'week') {
        EF.store.updateSettings({ weekStart: value });
      }
      // Export, restore and reset are disabled in the live demo, so nothing else is handled here.
    });

    page.querySelector('#set-profile-form').addEventListener('submit', function (event) {
      event.preventDefault();
      EF.store.updateProfile({ name: el.name.value.trim() });
      EF.toast.show('Name saved.', 'success');
    });

    // Store -> screen. The router throws this page away when you leave.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
      var replaced = change.action === 'replaceAllData' || change.action === 'resetAllData';
      var changed = change.changed;
      if (replaced || changed.indexOf('settings') !== -1 || changed.indexOf('profile') !== -1 ||
          changed.indexOf('courses') !== -1 || changed.indexOf('assignments') !== -1 || changed.indexOf('tasks') !== -1) {
        refresh(replaced);
      }
    });

    refresh(true);
  }

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('settings', {
    title: 'Settings',
    render: render
  });
})();