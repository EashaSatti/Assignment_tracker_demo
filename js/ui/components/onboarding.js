/* =========================================================
   ONBOARDING (welcome card) + "Load sample data" flow
   - The welcome card is shown on the Dashboard while the planner is
     EMPTY and the card has not been dismissed. It never blocks anything.
   - "Dismissed" is saved as settings.onboardingDismissed through the
     central store, so it survives a reload and is part of backups.
   - The User Guide can show the card again (reopen()), even when the
     planner already has data.
   - Nothing is ever created automatically. Sample data is added only
     after the user clicks "Load sample data" and confirms, and it is
     only ADDED next to the user's own data (EF.store.replaceAllData is
     given the current data plus the samples, saved first, all or nothing).
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;

  // Set when the Guide asks to see the card again; cleared when it is dismissed
  var reopenRequested = false;

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function isEmpty(state) {
    return state.courses.length === 0 && state.assignments.length === 0 && state.tasks.length === 0;
  }

  function shouldShow(state) {
    return !state.settings.onboardingDismissed && (reopenRequested || isEmpty(state));
  }

  // ---------- sample data ----------

  // options.goToDashboard: also open the Dashboard after adding (used by the Guide)
  function loadSample(options) {
    if (EF.sampleData.isLoaded(EF.store.getState())) {
      EF.toast.show('Sample data is already in your planner.', 'info');
      return;
    }
    var state = EF.store.getState();
    var size = EF.sampleData.describe();
    var hasOwnData = !isEmpty(state);

    EF.confirm.open({
      title: 'Load sample data?',
      bodyHtml:
        '<p>This adds <strong>' + esc(plural(size.courses, 'example course') + ', ' + plural(size.assignments, 'assignment') + ' and ' + plural(size.tasks, 'task')) + '</strong> so you can explore EashaForge.</p>' +
        '<ul class="onb-list">' +
          '<li>It is <strong>added</strong> to the planner. Nothing you have entered is changed or deleted.' + (hasOwnData ? ' You already have your own data, so samples will appear next to it.' : '') + '</li>' +
          '<li>Sample courses start with \u201cSample \u2013\u201d and sample assignments with \u201cSample:\u201d so you can tell them apart from your own work.</li>' +
          '<li>Dates are set around today, so a few items look overdue or due soon on purpose.</li>' +
          '<li>Samples count in the Dashboard, Calendar, reminders and Analytics until you remove them.</li>' +
          '<li>To remove them later, delete the three sample courses and choose to delete their items. That removes all the sample data and nothing else.</li>' +
        '</ul>',
      confirmLabel: 'Add sample data',
      onConfirm: function () {
        if (EF.sampleData.isLoaded(EF.store.getState())) {
          EF.toast.show('Sample data is already in your planner.', 'info');
          return;
        }
        var built = EF.sampleData.addTo(EF.store.exportData(), new Date());
        var outcome = EF.store.replaceAllData(built.state);
        if (!outcome.ok) {
          EF.toast.show(outcome.message + ' Nothing was added.', 'danger');
          return;
        }
        EF.toast.show('Sample data added. Your own data was not changed.', 'success');
        if (options && options.goToDashboard) {
          window.location.hash = '#/dashboard';
        }
      }
    });
  }

  // ---------- reopen from the Guide ----------

  function reopen() {
    reopenRequested = true;
    EF.store.updateSettings({ onboardingDismissed: false });
    window.location.hash = '#/dashboard';
  }

  // ---------- the card ----------

  function stepHtml(number, step, done) {
    var button = step.action
      ? '<button type="button" class="btn btn--secondary btn--sm onb-step__action" data-action="' + step.action + '"' +
          (step.go ? ' data-go="' + step.go + '"' : '') + '>' + esc(step.button) + '<span class="visually-hidden">: ' + esc(step.title) + '</span></button>'
      : '';
    return '<li class="onb-step' + (done ? ' onb-step--done' : '') + '">' +
      '<span class="onb-step__num" aria-hidden="true">' + (done ? icon('check') : number) + '</span>' +
      '<div class="onb-step__body">' +
        '<h3 class="onb-step__title">' + esc(step.title) +
          (step.optional ? ' <span class="onb-step__tag">Optional</span>' : '') +
          (done ? ' <span class="badge badge--completed">' + icon('check-circle') + 'Done</span>' : '') + '</h3>' +
        '<p class="onb-step__text">' + esc(step.text) + '</p>' +
      '</div>' +
      button +
    '</li>';
  }

  function cardHtml(state) {
    var steps = [
      { title: 'Create a course', optional: true, text: 'Courses group your work and give it a colour. You can skip this and add them later.',
        button: 'Go to Courses', action: 'go', go: 'courses', done: state.courses.length > 0 },
      { title: 'Add an assignment', text: 'Give it a title and a due date. Add a priority and a time if you like.',
        button: 'Add assignment', action: 'add-assignment', done: state.assignments.length > 0 },
      { title: 'Break it into tasks', text: 'Small steps you tick off. They also move the assignment\u2019s progress bar.',
        button: 'Add task', action: 'add-task', done: state.tasks.length > 0 },
      { title: 'Watch it come together', text: 'The Dashboard shows what needs attention. The Calendar shows every due date.',
        button: 'Open Calendar', action: 'go', go: 'calendar', done: false }
    ];

    return '<section class="card onb" aria-labelledby="onb-title">' +
      '<div class="onb__header">' +
        '<div>' +
          '<h2 class="onb__title" id="onb-title">' + icon('guide') + 'Welcome to EashaForge</h2>' +
          '<p class="onb__intro">Plan your courses, assignments and tasks in one place. Everything stays on this device and works without internet. Here is a quick way to start:</p>' +
        '</div>' +
        '<button type="button" class="icon-btn" data-action="dismiss" aria-label="Hide the welcome guide">' + icon('x') + '</button>' +
      '</div>' +
      '<ol class="onb__steps">' + steps.map(function (step, index) { return stepHtml(index + 1, step, step.done); }).join('') + '</ol>' +
      '<div class="onb__footer">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="sample">' + icon('layers') + 'Load sample data</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="go" data-go="guide">' + icon('guide') + 'Read the User Guide</button>' +
        '<button type="button" class="btn btn--secondary btn--sm onb__done" data-action="dismiss">Got it, hide this</button>' +
      '</div>' +
    '</section>';
  }

  // container: an empty element on the Dashboard. page: the Dashboard page element.
  function mount(container, page) {
    var ui = { page: page, resetFilters: function () {} };
    var lastHtml = null;

    function draw() {
      var state = EF.store.getState();
      var html = shouldShow(state) ? cardHtml(state) : '';
      if (html !== lastHtml) {
        lastHtml = html;
        container.innerHTML = html;
      }
    }

    container.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');

      if (action === 'go') {
        window.location.hash = '#/' + target.getAttribute('data-go');
      } else if (action === 'add-assignment') {
        EF.assignmentsUi.openForm(ui);
      } else if (action === 'add-task') {
        EF.tasksUi.openForm({ page: page });
      } else if (action === 'sample') {
        loadSample();
      } else if (action === 'dismiss') {
        reopenRequested = false;
        EF.store.updateSettings({ onboardingDismissed: true });
        document.getElementById('main').focus();
      }
    });

    // Store -> card. The router throws the Dashboard away when you leave.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
      var changed = change.changed;
      if (changed.indexOf('settings') !== -1 || changed.indexOf('courses') !== -1 ||
          changed.indexOf('assignments') !== -1 || changed.indexOf('tasks') !== -1) {
        draw();
      }
    });

    draw();
  }

  EF.onboarding = { mount: mount, reopen: reopen, loadSample: loadSample };
})();