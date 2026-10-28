/* =========================================================
   DEVELOPER TOOLS  (TEMPORARY - for testing Phase 2 only)
   Open with:  index.html#/dev
   Not part of the buyer-facing product.
   REMOVE BEFORE RELEASE: delete the js/dev folder and its
   <script> line in index.html.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var icon = EF.icons.get;
  var esc = EF.utils.escapeHtml;
  var COLORS = ['#2F7D5B', '#B45F2B', '#3B63C9', '#8A4FB0'];

  function pad(number) {
    return number < 10 ? '0' + number : String(number);
  }

  // Local date "days from today" as YYYY-MM-DD
  function dateInDays(days) {
    var date = new Date();
    date.setDate(date.getDate() + days);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function row(label, value) {
    return '<div class="cluster" style="gap: var(--space-2)"><strong>' + esc(label) + ':</strong><span>' + esc(value) + '</span></div>';
  }

  function button(action, label, cssClass) {
    return '<button type="button" class="btn ' + (cssClass || 'btn--secondary') + ' btn--sm" data-action="' + action + '">' + esc(label) + '</button>';
  }

  function render(page) {
    page.innerHTML =
      '<div class="banner banner--warning" role="note">' +
        '<span class="banner__icon">' + icon('alert') + '</span>' +
        '<div><strong>Developer tools - temporary.</strong> For testing the data layer only. ' +
        'This page will be removed before the product is released.</div>' +
      '</div>' +
      '<div style="height: var(--space-6)"></div>' +

      '<section class="ds-section"><h2 class="ds-section__title">Storage status</h2>' +
        '<div class="stack" style="gap: var(--space-2)" id="dev-status"></div></section>' +

      '<section class="ds-section"><h2 class="ds-section__title">Test actions</h2>' +
        '<p class="ds-note">Each button calls a real store action. Results appear as toasts. ' +
        '"First" means the first item in the list.</p>' +
        '<div class="cluster">' +
          button('add-course', 'Add test course') +
          button('rename-course', 'Rename first course') +
          button('archive-course', 'Archive / unarchive first course') +
          button('delete-course', 'Delete first course') +
        '</div>' +
        '<div class="cluster">' +
          button('add-assignment', 'Add test assignment') +
          button('toggle-assignment', 'Toggle first assignment finished') +
          button('delete-assignment', 'Delete first assignment') +
          button('detach-assignment', 'Delete first assignment, keep its tasks') +
        '</div>' +
        '<div class="cluster">' +
          button('add-task', 'Add test task') +
          button('toggle-task', 'Toggle first task done') +
          button('delete-task', 'Delete first task') +
        '</div>' +
        '<div class="cluster">' + button('reset', 'Reset all data', 'btn--danger') + '</div>' +
      '</section>' +

      '<section class="ds-section"><h2 class="ds-section__title">Current state (live)</h2>' +
        '<pre id="dev-json" style="overflow: auto; max-height: 28rem; padding: var(--space-4); ' +
        'background: var(--color-surface-2); border: 1px solid var(--color-border); ' +
        'border-radius: var(--radius-md); font-family: var(--font-mono); font-size: var(--text-xs);"></pre>' +
      '</section>';

    var statusEl = page.querySelector('#dev-status');
    var jsonEl = page.querySelector('#dev-json');

    function refresh() {
      var s = EF.store.getState();
      var status = EF.store.getStatus();
      var raw = EF.storage.readRaw();

      statusEl.innerHTML = [
        row('Storage key', EF.storage.STORAGE_KEY),
        row('Store status', status.code + (status.canSave ? '' : ' (saving is turned off)')),
        row('Changes this session (revision)', EF.store.getRevision()),
        row('Saved size', raw === null ? 'nothing saved yet' : raw.length + ' characters'),
        row('Records', s.courses.length + ' courses, ' + s.assignments.length + ' assignments, ' + s.tasks.length + ' tasks'),
        row('Theme setting', s.settings.theme + '  (showing: ' + EF.theme.current() + ')')
      ].join('');

      jsonEl.textContent = JSON.stringify(s, null, 2);
    }

    refresh();

    // Live updates. A screen is thrown away when you leave it, but the store
    // would still call this function, so we stop listening once the page is gone.
    var stopListening = EF.store.subscribe(function () {
      if (!page.isConnected) {
        stopListening();
        return;
      }
      refresh();
      // The save to localStorage happens ~300 ms later (debounce), so look again then
      setTimeout(function () {
        if (page.isConnected) { refresh(); }
      }, 450);
    });

    function show(result, successMessage) {
      if (result.ok) {
        EF.toast.show(result.unchanged ? 'Nothing changed.' : successMessage, 'success', 2500);
      } else {
        EF.toast.show('Refused (' + result.reason + '): ' + result.message, 'warning', 6000);
      }
    }

    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');
      var s = EF.store.getState();
      var firstCourse = s.courses[0];
      var firstAssignment = s.assignments[0];
      var firstTask = s.tasks[0];

      function need(item, what) {
        if (!item) {
          EF.toast.show('Add a ' + what + ' first.', 'info', 2500);
        }
        return !!item;
      }

      if (action === 'add-course') {
        show(EF.store.addCourse({
          name: 'Test course ' + (s.courses.length + 1),
          instructor: 'Dr. Example',
          color: COLORS[s.courses.length % COLORS.length]
        }), 'Course added.');

      } else if (action === 'rename-course') {
        if (need(firstCourse, 'course')) {
          show(EF.store.updateCourse(firstCourse.id, { name: 'Renamed at ' + new Date().toLocaleTimeString() }), 'Course renamed.');
        }

      } else if (action === 'archive-course') {
        if (need(firstCourse, 'course')) {
          show(EF.store.archiveCourse(firstCourse.id, !firstCourse.archived), firstCourse.archived ? 'Course unarchived.' : 'Course archived.');
        }

      } else if (action === 'delete-course') {
        if (need(firstCourse, 'course')) {
          show(EF.store.deleteCourse(firstCourse.id), 'Course deleted.');
        }

      } else if (action === 'add-assignment') {
        show(EF.store.addAssignment({
          title: 'Test assignment ' + (s.assignments.length + 1),
          courseId: firstCourse ? firstCourse.id : null,
          dueDate: dateInDays(3),
          priority: 'high'
        }), 'Assignment added' + (firstCourse ? ' (linked to the first course).' : ' (no course yet).'));

      } else if (action === 'toggle-assignment') {
        if (need(firstAssignment, 'assignment')) {
          var finished = EF.schema.isAssignmentFinished(firstAssignment.status);
          show(EF.store.updateAssignment(firstAssignment.id, { status: finished ? 'in_progress' : 'completed' }),
            finished ? 'Assignment reopened (completedAt cleared).' : 'Assignment completed (completedAt set).');
        }

      } else if (action === 'delete-assignment') {
        if (need(firstAssignment, 'assignment')) {
          show(EF.store.deleteAssignment(firstAssignment.id), 'Assignment deleted.');
        }

      } else if (action === 'detach-assignment') {
        if (need(firstAssignment, 'assignment')) {
          show(EF.store.deleteAssignment(firstAssignment.id, { linkedTasks: 'detach' }), 'Assignment deleted; its tasks were kept.');
        }

      } else if (action === 'add-task') {
        show(EF.store.addTask({
          title: 'Test task ' + (s.tasks.length + 1),
          assignmentId: firstAssignment ? firstAssignment.id : null,
          courseId: firstCourse ? firstCourse.id : null
        }), 'Task added' + (firstAssignment ? ' (linked to the first assignment).' : ' (standalone).'));

      } else if (action === 'toggle-task') {
        if (need(firstTask, 'task')) {
          show(EF.store.updateTask(firstTask.id, { status: firstTask.status === 'done' ? 'todo' : 'done' }), 'Task toggled.');
        }

      } else if (action === 'delete-task') {
        if (need(firstTask, 'task')) {
          show(EF.store.deleteTask(firstTask.id), 'Task deleted.');
        }

      } else if (action === 'reset') {
        if (window.confirm('Erase ALL data, including settings?')) {
          show(EF.store.resetAllData(), 'All data reset.');
        }
      }
    });
  }

  EF.router.register('dev', {
    title: 'Developer Tools (temporary)',
    render: render
  });
})();