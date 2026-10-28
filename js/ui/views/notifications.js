/* =========================================================
   NOTIFICATIONS SCREEN + BELL BADGE
   - Reminders are worked out from the store every time
     (EF.notificationSelectors). Only "read" and "dismissed"
     are saved, through EF.store.updateNotificationState.
   - Reminders only exist while EashaForge is open. Nothing is
     sent when it is closed, and no browser permission is asked.
   - ONE store subscription, ONE visibilitychange listener and ONE
     timer are created when this file loads (never per screen), so
     they cannot pile up. The screen skips redrawing when nothing
     changed, so keyboard focus is not lost.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var asel = EF.assignmentSelectors;
  var nsel = EF.notificationSelectors;

  var CHECK_EVERY_MS = 60000;
  var current = null; // the Notifications screen that is on display, if any

  function plural(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  // ---------- bell badge (works on every screen) ----------

  function updateBadge(list) {
    EF.shell.setNotificationCount(nsel.unreadCount(list));
  }

  // ---------- small HTML builders (icon AND words, never colour alone) ----------

  function kindBadge(entry) {
    var label = nsel.KIND_LABELS[entry.kind];
    if (entry.kind === 'overdue') {
      return '<span class="badge badge--overdue">' + icon('alert') + esc(label) + '</span>';
    }
    if (entry.kind === 'today' || entry.kind === 'tomorrow') {
      return '<span class="badge badge--due-soon">' + icon('clock') + esc(label) + '</span>';
    }
    if (entry.kind === 'priority') {
      return '<span class="badge badge--priority-high">' + icon('flag') + esc(label) + '</span>';
    }
    return '<span class="badge badge--neutral">' + icon('clock') + esc(label) + '</span>';
  }

  function priorityBadge(priority) {
    return '<span class="badge badge--priority-' + esc(priority) + '">' + icon('flag') + esc(asel.priorityLabel(priority)) + ' priority</span>';
  }

  function courseTagHtml(course) {
    if (!course) {
      return '<span class="course-tag course-tag--none"><span class="course-tag__dot" aria-hidden="true"></span>No course</span>';
    }
    return '<span class="course-tag" style="--course-color: ' + esc(course.color) + '">' +
      '<span class="course-tag__dot" aria-hidden="true"></span>' + esc(course.name) +
      (course.archived ? ' <span class="course-tag__note">(archived)</span>' : '') + '</span>';
  }

  function dueText(entry) {
    return asel.formatDueDate(entry.dueDate) + (entry.dueTime ? ' at ' + asel.formatDueTime(entry.dueTime) : '');
  }

  function itemHtml(entry, courses) {
    var course = entry.courseId ? courses[entry.courseId] || null : null;
    var typeName = entry.type === 'task' ? 'Task' : 'Assignment';
    var showText = entry.kind === 'overdue' || entry.kind === 'priority' || entry.kind === 'upcoming';
    return '<li class="notif-item' + (entry.read ? '' : ' notif-item--unread') + '"' + (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="notif-item__main">' +
        '<div class="notif-item__top">' + kindBadge(entry) +
          (entry.read ? '' : '<span class="notif-item__new"><span class="notif-item__dot" aria-hidden="true"></span>Unread</span>') +
        '</div>' +
        '<button type="button" class="link-btn notif-item__title" data-action="open" data-key="' + esc(entry.key) + '">' +
          '<span class="visually-hidden">' + typeName + ': </span>' + esc(entry.title) + '</button>' +
        '<ul class="notif-item__meta">' +
          '<li>' + icon(entry.type === 'task' ? 'tasks' : 'assignments') + '<span>' + typeName + '</span></li>' +
          '<li>' + courseTagHtml(course) + '</li>' +
          '<li>' + icon('calendar') + '<span><span class="visually-hidden">Due: </span>' + esc(dueText(entry)) + '</span></li>' +
          (showText ? '<li>' + icon('clock') + '<span>' + esc(entry.text) + '</span></li>' : '') +
          '<li>' + priorityBadge(entry.priority) + '</li>' +
        '</ul>' +
      '</div>' +
      '<div class="notif-item__actions">' +
        (entry.read ? '' : '<button type="button" class="btn btn--ghost btn--sm" data-action="read" data-key="' + esc(entry.key) + '">' +
          icon('check') + 'Mark read<span class="visually-hidden">: ' + esc(entry.title) + '</span></button>') +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="dismiss" data-key="' + esc(entry.key) + '">' +
          icon('x') + 'Dismiss<span class="visually-hidden">: ' + esc(entry.title) + '</span></button>' +
      '</div>' +
    '</li>';
  }

  function groupHtml(title, entries, courses) {
    if (!entries.length) {
      return '';
    }
    return '<section class="notif-group">' +
      '<h3 class="notif-group__title">' + esc(title) + ' <span class="notif-group__count">(' + entries.length + ')</span></h3>' +
      '<ul class="notif-list">' + entries.map(function (entry) { return itemHtml(entry, courses); }).join('') + '</ul>' +
    '</section>';
  }

  function emptyHtml(hasDismissed) {
    return '<div class="dash-empty">' +
      '<span class="dash-empty__icon" aria-hidden="true">' + icon('check-circle') + '</span>' +
      '<p class="dash-empty__title">You are all caught up</p>' +
      '<p class="dash-empty__text">' + (hasDismissed
        ? 'No reminders are showing. You can bring dismissed ones back with "Show dismissed".'
        : 'Nothing is overdue, due today or due in the next 7 days.') + '</p>' +
    '</div>';
  }

  // ---------- the screen ----------

  function render(page) {
    page.innerHTML =
      '<div class="notif-page">' +
        '<section class="card notif" aria-labelledby="notif-title">' +
          '<div class="notif__header">' +
            '<div>' +
              '<h2 class="notif__title" id="notif-title" tabindex="-1">Your reminders</h2>' +
              '<p class="notif__summary" id="notif-summary" aria-live="polite"></p>' +
            '</div>' +
            '<div class="notif__actions">' +
              '<button type="button" class="btn btn--secondary btn--sm" data-action="read-all" id="notif-read-all">' + icon('check') + 'Mark all as read</button>' +
              '<button type="button" class="btn btn--ghost btn--sm" data-action="restore" id="notif-restore">' + icon('restore') + 'Show dismissed</button>' +
            '</div>' +
          '</div>' +
          '<div id="notif-body"></div>' +
          '<p class="notif__note">' + icon('info') +
            '<span>Reminders are worked out from your due dates while EashaForge is open. Nothing is sent when it is closed, and your browser is never asked for permission.</span></p>' +
        '</section>' +
      '</div>';

    var el = {
      title: page.querySelector('#notif-title'),
      summary: page.querySelector('#notif-summary'),
      readAll: page.querySelector('#notif-read-all'),
      restore: page.querySelector('#notif-restore'),
      body: page.querySelector('#notif-body')
    };
    var ui = { page: page, resetFilters: function () {} };
    var lastDrawn = '';
    var latest = [];

    function draw(list) {
      latest = list;
      var state = EF.store.getState();
      var shown = nsel.active(list);
      var unread = nsel.unreadCount(list);
      var dismissed = nsel.dismissedCount(list);
      var courses = EF.taskSelectors.mapById(state.courses);

      var summary = shown.length === 0
        ? 'No reminders right now'
        : plural(unread, 'unread reminder') + ' of ' + shown.length;
      var body = shown.length === 0
        ? emptyHtml(dismissed > 0)
        : groupHtml('Overdue', shown.filter(function (e) { return e.kind === 'overdue'; }), courses) +
          groupHtml('Due today', shown.filter(function (e) { return e.kind === 'today'; }), courses) +
          groupHtml('Coming up', shown.filter(function (e) { return e.rank > 2; }), courses);

      // Redraw only when something visible changed (keeps keyboard focus where it is)
      var signature = summary + '#' + unread + '#' + dismissed + '#' + body;
      if (signature === lastDrawn) {
        return;
      }
      lastDrawn = signature;
      el.summary.textContent = summary;
      el.readAll.hidden = unread === 0;
      el.restore.hidden = dismissed === 0;
      el.restore.lastChild.textContent = 'Show dismissed (' + dismissed + ')';
      el.body.innerHTML = body;
    }

    function save(keys, action) {
      var state = EF.store.getState();
      var flags = nsel.nextFlags(state, latest, keys, action, EF.utils.nowISO());
      EF.store.updateNotificationState(flags);
    }

    function find(key) {
      return latest.filter(function (entry) { return entry.key === key; })[0] || null;
    }

    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');
      var key = target.getAttribute('data-key');
      var entry = key ? find(key) : null;

      if (action === 'open' && entry) {
        if (!entry.read) {
          save([entry.key], 'read');
        }
        if (entry.type === 'task') {
          EF.tasksUi.openDetails(page, entry.id);
        } else {
          EF.assignmentsUi.openDetails(ui, entry.id);
        }
        return;
      }

      if (action === 'read' && entry) {
        save([entry.key], 'read');
      } else if (action === 'dismiss' && entry) {
        save([entry.key], 'dismiss');
      } else if (action === 'read-all') {
        save(nsel.active(latest).map(function (e) { return e.key; }), 'read');
      } else if (action === 'restore') {
        save(latest.filter(function (e) { return e.dismissed; }).map(function (e) { return e.key; }), 'restore');
      } else {
        return;
      }
      // The button that was used has just disappeared, so keep keyboard focus on this screen
      el.title.focus();
    });

    current = { page: page, draw: draw };
    draw(nsel.build(EF.store.getState(), new Date()));
  }

  // ---------- keeping everything up to date ----------

  function refreshAll() {
    var list = nsel.build(EF.store.getState(), new Date());
    updateBadge(list);
    if (current && current.page.isConnected) {
      current.draw(list);
    }
  }

  // Store -> bell and screen (one subscription for the whole app)
  EF.store.subscribe(function (state, change) {
    var changed = change.changed;
    if (changed.indexOf('assignments') !== -1 || changed.indexOf('tasks') !== -1 ||
        changed.indexOf('courses') !== -1 || changed.indexOf('notificationState') !== -1) {
      refreshAll();
    }
  });

  // Coming back to the tab, and a light once-a-minute check (a due time can pass, or midnight can arrive)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      refreshAll();
    }
  });
  window.setInterval(function () {
    if (document.visibilityState === 'visible') {
      refreshAll();
    }
  }, CHECK_EVERY_MS);

  // When the app opens
  refreshAll();

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('notifications', {
    title: 'Notifications',
    render: render
  });
})();