/* =========================================================
   LIVE DEMO CONTROLLER (public GitHub Pages demo only)
   - Loads LAST (just before app.js), so every EF.* module exists
     and the data is seeded before the first screen is drawn.
   - Every page load: storage.js is memory-only, so the demo always starts
     empty (status 'first-run') and is filled with the sample planner once,
     before the first screen is drawn. Edits never survive a refresh.
   - Shows a slim "Live demo" bar with a "Reset demo" button.
     Reset asks for confirmation, then restores the sample planner
     (dates are set around today). Nothing else is changed.
   - Uses only existing APIs: EF.sampleData, EF.store, EF.confirm,
     EF.toast. No network, no external files.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var BAR_ID = 'demo-bar';

  // True only when every API this file needs is present
  function apisReady() {
    return !!(window.EF.sampleData && typeof EF.sampleData.addTo === 'function' &&
      EF.schema && typeof EF.schema.createDefaultState === 'function' &&
      EF.store && typeof EF.store.getState === 'function' &&
      typeof EF.store.getStatus === 'function' &&
      typeof EF.store.replaceAllData === 'function');
  }

  // A complete planner state: empty defaults + the sample records.
  // keepSettings (optional): the visitor's current settings, so their
  // theme and week start survive a reset.
  function buildSeed(keepSettings) {
    var base = EF.schema.createDefaultState();
    var built = EF.sampleData.addTo(base, new Date());
    var settings = Object.assign({}, base.settings);
    if (keepSettings) {
      if (keepSettings.theme) { settings.theme = keepSettings.theme; }
      if (keepSettings.weekStart) { settings.weekStart = keepSettings.weekStart; }
    }
    settings.onboardingDismissed = true; // the demo already has data: no welcome card
    built.state.settings = settings;
    return built.state;
  }

  // ---------- first visit ----------

  // Seeds ONLY when the store reports a brand-new, empty demo.
  // any other status means data already exists in this page,
  // so it is never overwritten.
  function seedOnFirstVisit() {
    if (!apisReady()) {
      return;
    }
    if (EF.store.getStatus().code !== 'first-run') {
      return;
    }
    var outcome = EF.store.replaceAllData(buildSeed(EF.store.getState().settings));
    if (!outcome.ok && window.console) {
      console.warn('EashaForge demo: sample data could not be saved. ' + outcome.message);
    }
  }

  // ---------- reset ----------

  function resetDemo() {
    if (!apisReady() || !EF.confirm || typeof EF.confirm.open !== 'function') {
      if (EF.toast && EF.toast.show) {
        EF.toast.show('The demo could not be reset in this browser.', 'danger');
      }
      return;
    }
    if (!EF.store.getStatus().canSave) {
      EF.toast.show('Saving is turned off in this browser session, so the demo cannot be reset.', 'danger');
      return;
    }

    var size = EF.sampleData.describe();
    EF.confirm.open({
      title: 'Reset the demo?',
      bodyHtml:
        '<p>This <strong>replaces everything in this demo</strong> with the original sample planner: ' +
        size.courses + ' courses, ' + size.assignments + ' assignments and ' + size.tasks + ' tasks.</p>' +
        '<p>Anything you added or changed in the demo will be removed. It only affects this page.</p>',
      confirmLabel: 'Reset demo',
      danger: true,
      onConfirm: function () {
        var outcome = EF.store.replaceAllData(buildSeed(EF.store.getState().settings));
        if (!outcome.ok) {
          EF.toast.show((outcome.message || 'The demo could not be reset.') + ' Nothing was changed.', 'danger');
          return;
        }
        EF.toast.show('Demo reset to the sample planner.', 'success');
        window.location.hash = '#/dashboard';
      }
    });
  }

  // ---------- the "Live demo" bar ----------

  function mountBar() {
    if (document.getElementById(BAR_ID)) {
      return; // never a second bar
    }
    var main = document.getElementById('main');
    if (!main || !main.parentNode) {
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.id = BAR_ID;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Live demo notice');
    bar.innerHTML =
      '<span class="demo-bar__tag">Live demo</span>' +
      '<p class="demo-bar__text">Sample data only. Your changes are temporary and reset when you refresh the page.</p>' +
      '<button type="button" class="btn btn--secondary btn--sm demo-bar__reset" data-demo-action="reset">Reset demo</button>';

    // One listener, on the bar itself
    bar.addEventListener('click', function (event) {
      var target = event.target.closest('[data-demo-action]');
      if (target && target.getAttribute('data-demo-action') === 'reset') {
        resetDemo();
      }
    });

    main.parentNode.insertBefore(bar, main); // between the top bar and the page
  }

  seedOnFirstVisit();
  mountBar();
})();