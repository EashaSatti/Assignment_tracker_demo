/* =========================================================
   CALENDAR SCREEN
   - Reads everything live from EF.store. Nothing is stored here.
   - Which dates have items, and their order, come from
     EF.calendarSelectors (derived every time).
   - It never changes data. Clicking an item opens the same
     details dialogs the Assignments and Tasks screens use.
   - The page frame is built once; only the grid and the
     selected-day list are redrawn, so the Previous / Next /
     Today buttons keep keyboard focus.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;
  var csel = EF.calendarSelectors;

  // ---------- small helpers ----------

  function plural(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  // ---------- small HTML builders (icon AND words, never colour alone) ----------

  function assignmentStatusBadge(status) {
    var icons = { not_started: 'circle', in_progress: 'half-circle', submitted: 'send', completed: 'check-circle' };
    var classes = { not_started: 'badge--not-started', in_progress: 'badge--in-progress', submitted: 'badge--submitted', completed: 'badge--completed' };
    return '<span class="badge ' + classes[status] + '">' + icon(icons[status]) + esc(asel.statusLabel(status)) + '</span>';
  }

  function taskStatusBadge(task) {
    var done = tsel.isDone(task);
    return '<span class="badge ' + (done ? 'badge--completed' : 'badge--not-started') + '">' +
      icon(done ? 'check-circle' : 'circle') + esc(tsel.statusLabel(task.status)) + '</span>';
  }

  function priorityBadge(priority) {
    return '<span class="badge badge--priority-' + esc(priority) + '">' + icon('flag') + esc(asel.priorityLabel(priority)) + ' priority</span>';
  }

  // Overdue / Due Today / upcoming. Finished items show their Submitted / Completed / Done badge instead.
  function deadlineBadge(info) {
    if (info.state === 'overdue') {
      return '<span class="badge badge--overdue">' + icon('alert') + esc(info.label) + '</span>';
    }
    if (info.state === 'today' || info.state === 'tomorrow') {
      return '<span class="badge badge--due-soon">' + icon('clock') + esc(info.label) + '</span>';
    }
    if (info.state === 'soon' || info.state === 'later') {
      return '<span class="badge badge--neutral">' + icon('clock') + esc(info.label) + '</span>';
    }
    return '';
  }

  function courseTagHtml(course) {
    if (!course) {
      return '<span class="course-tag course-tag--none"><span class="course-tag__dot" aria-hidden="true"></span>No course</span>';
    }
    return '<span class="course-tag" style="--course-color: ' + esc(course.color) + '">' +
      '<span class="course-tag__dot" aria-hidden="true"></span>' + esc(course.name) +
      (course.archived ? ' <span class="course-tag__note">(archived)</span>' : '') + '</span>';
  }

  // ---------- the selected-day list ----------

  function assignmentItemHtml(assignment, courses, now) {
    var course = assignment.courseId ? courses[assignment.courseId] || null : null;
    var info = asel.getDeadlineInfo(assignment, now);
    var finished = info.state === 'finished';
    return '<li class="cal-item' + (finished ? ' cal-item--finished' : '') + '"' + (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="cal-item__top">' +
        '<button type="button" class="link-btn cal-item__title" data-action="view" data-kind="assignment" data-id="' + esc(assignment.id) + '">' +
          '<span class="visually-hidden">Assignment: </span>' + esc(assignment.title) + '</button>' +
        '<span class="cal-item__when">' + deadlineBadge(info) + '</span>' +
      '</div>' +
      '<ul class="cal-item__meta">' +
        '<li>' + courseTagHtml(course) + '</li>' +
        (assignment.dueTime ? '<li>' + icon('clock') + '<span>Due at ' + esc(asel.formatDueTime(assignment.dueTime)) + '</span></li>' : '') +
        '<li>' + priorityBadge(assignment.priority) + '</li>' +
        '<li>' + assignmentStatusBadge(assignment.status) + '</li>' +
      '</ul>' +
    '</li>';
  }

  function taskItemHtml(task, courses, assignments, now) {
    var linked = task.assignmentId !== null ? assignments[task.assignmentId] || null : null;
    var courseId = tsel.effectiveCourseId(task, assignments);
    var course = courseId ? courses[courseId] || null : null;
    var info = tsel.getDeadlineInfo(task, now);
    var finished = tsel.isDone(task);
    return '<li class="cal-item' + (finished ? ' cal-item--finished' : '') + '"' + (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="cal-item__top">' +
        '<button type="button" class="link-btn cal-item__title" data-action="view" data-kind="task" data-id="' + esc(task.id) + '">' +
          '<span class="visually-hidden">Task: </span>' + esc(task.title) + '</button>' +
        '<span class="cal-item__when">' + deadlineBadge(info) + '</span>' +
      '</div>' +
      '<ul class="cal-item__meta">' +
        '<li>' + courseTagHtml(course) + '</li>' +
        (linked ? '<li>' + icon('assignments') + '<span>For: <button type="button" class="link-btn" data-action="view" data-kind="assignment" data-id="' +
          esc(linked.id) + '">' + esc(linked.title) + '</button></span></li>' : '') +
        '<li>' + priorityBadge(task.priority) + '</li>' +
        '<li>' + taskStatusBadge(task) + '</li>' +
      '</ul>' +
    '</li>';
  }

  function groupHtml(title, iconName, count, itemsHtml) {
    return '<section class="cal-day__group">' +
      '<h3 class="cal-day__group-title">' + icon(iconName) + esc(title) + ' <span class="cal-day__count">(' + count + ')</span></h3>' +
      '<ul class="cal-list">' + itemsHtml + '</ul>' +
    '</section>';
  }

  function emptyDayHtml() {
    return '<div class="dash-empty">' +
      '<span class="dash-empty__icon" aria-hidden="true">' + icon('calendar') + '</span>' +
      '<p class="dash-empty__title">Nothing due on this day</p>' +
      '<p class="dash-empty__text">No assignments or tasks have this due date. Pick another date, or add one from the Assignments or Tasks screen.</p>' +
    '</div>';
  }

  function dayBodyHtml(entry, state, now) {
    if (!entry || (entry.assignments.length === 0 && entry.tasks.length === 0)) {
      return emptyDayHtml();
    }
    var courses = tsel.mapById(state.courses);
    var assignments = tsel.mapById(state.assignments);
    var html = '';
    if (entry.assignments.length) {
      html += groupHtml('Assignments', 'assignments', entry.assignments.length, entry.assignments.map(function (assignment) {
        return assignmentItemHtml(assignment, courses, now);
      }).join(''));
    }
    if (entry.tasks.length) {
      html += groupHtml('Tasks', 'tasks', entry.tasks.length, entry.tasks.map(function (task) {
        return taskItemHtml(task, courses, assignments, now);
      }).join(''));
    }
    return html;
  }

  // ---------- the month grid ----------

  function cellHtml(cell, entry, context) {
    var summary = csel.summarizeDay(entry, context.now);
    var isToday = cell.date === context.today;
    var isSelected = cell.date === context.selected;

    var label = csel.formatLongDate(cell.date) + (isToday ? ' (today)' : '') + '. ';
    var parts = [];
    if (summary.assignments) { parts.push(plural(summary.assignments, 'assignment')); }
    if (summary.tasks) { parts.push(plural(summary.tasks, 'task')); }
    label += parts.length ? parts.join(', ') + (summary.overdue ? ', ' + summary.overdue + ' overdue' : '') : 'Nothing due';

    var marks = '';
    if (summary.assignments) {
      marks += '<span class="cal-mark cal-mark--assignment"><span class="cal-mark__shape"></span><span class="cal-mark__n">' + summary.assignments + '</span></span>';
    }
    if (summary.tasks) {
      marks += '<span class="cal-mark cal-mark--task"><span class="cal-mark__shape"></span><span class="cal-mark__n">' + summary.tasks + '</span></span>';
    }
    if (summary.overdue) {
      marks += '<span class="cal-mark cal-mark--overdue">!</span>';
    }

    return '<button type="button" class="cal-cell' +
        (cell.inMonth ? '' : ' cal-cell--outside') +
        (isToday ? ' cal-cell--today' : '') +
        (isSelected ? ' cal-cell--selected' : '') + '"' +
      ' data-action="select" data-date="' + cell.date + '"' +
      ' tabindex="' + (isSelected ? '0' : '-1') + '"' +
      ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"' +
      (isToday ? ' aria-current="date"' : '') +
      ' aria-label="' + esc(label) + '">' +
      '<span class="cal-cell__top"><span class="cal-cell__num">' + cell.day + '</span>' +
        (isToday ? '<span class="cal-cell__today">Today</span>' : '') + '</span>' +
      (marks ? '<span class="cal-cell__marks" aria-hidden="true">' + marks + '</span>' : '') +
    '</button>';
  }

  // ---------- the screen ----------

  function render(page) {
    page.innerHTML =
      '<div class="cal-page">' +
        '<section class="card cal" aria-labelledby="cal-heading">' +
          '<div class="cal__toolbar">' +
            '<div class="cal__nav">' +
              '<button type="button" class="icon-btn" data-action="prev" aria-label="Previous month">' + icon('chevron-left') + '</button>' +
              '<h2 class="cal__heading" id="cal-heading" aria-live="polite"></h2>' +
              '<button type="button" class="icon-btn" data-action="next" aria-label="Next month">' + icon('chevron-right') + '</button>' +
            '</div>' +
            '<button type="button" class="btn btn--secondary btn--sm" data-action="today">' + icon('calendar') + 'Today</button>' +
          '</div>' +
          '<div class="cal__weekdays" id="cal-weekdays" aria-hidden="true"></div>' +
          '<div class="cal__grid" id="cal-grid" role="group" aria-label="Month calendar. Use the arrow keys to move between days."></div>' +
          '<ul class="cal__legend" aria-label="Key">' +
            '<li><span class="cal-mark cal-mark--assignment"><span class="cal-mark__shape"></span></span>Assignments due</li>' +
            '<li><span class="cal-mark cal-mark--task"><span class="cal-mark__shape"></span></span>Tasks due</li>' +
            '<li><span class="cal-mark cal-mark--overdue">!</span>Something is overdue</li>' +
          '</ul>' +
        '</section>' +
        '<section class="card cal-day" aria-labelledby="cal-day-title">' +
          '<div class="cal-day__header">' +
            '<h2 class="cal-day__title" id="cal-day-title" tabindex="-1"></h2>' +
            '<p class="cal-day__summary" id="cal-day-summary" aria-live="polite"></p>' +
          '</div>' +
          '<div id="cal-day-body"></div>' +
        '</section>' +
      '</div>';

    var el = {
      heading: page.querySelector('#cal-heading'),
      weekdays: page.querySelector('#cal-weekdays'),
      grid: page.querySelector('#cal-grid'),
      dayTitle: page.querySelector('#cal-day-title'),
      daySummary: page.querySelector('#cal-day-summary'),
      dayBody: page.querySelector('#cal-day-body')
    };

    // The only things this screen remembers: which date is selected (the month shown follows it)
    var selected = asel.todayString(new Date());
    var ui = { page: page, resetFilters: function () {} };

    function focusSelected() {
      var button = el.grid.querySelector('[data-date="' + selected + '"]');
      if (button) {
        button.focus();
      }
    }

    // Reads the store and draws the changing parts. The store is only READ here.
    function refresh() {
      var now = new Date();
      var state = EF.store.getState();
      var weekStart = state.settings.weekStart;
      var today = asel.todayString(now);
      var index = csel.buildEventIndex(state);
      var entry = index[selected] || null;
      var summary = csel.summarizeDay(entry, now);

      el.heading.textContent = csel.monthTitle(selected);

      el.weekdays.innerHTML = csel.weekdayLabels(weekStart).map(function (day) {
        return '<span>' + esc(day.short) + '</span>';
      }).join('');

      // Keep keyboard focus on the selected day when the grid is redrawn from inside it
      var hadFocus = el.grid.contains(document.activeElement);
      var context = { now: now, today: today, selected: selected };
      el.grid.innerHTML = csel.getMonthGrid(selected, weekStart).map(function (cell) {
        return cellHtml(cell, index[cell.date], context);
      }).join('');
      if (hadFocus) {
        focusSelected();
      }

      el.dayTitle.textContent = csel.formatLongDate(selected) + (selected === today ? ' (Today)' : '');
      el.daySummary.textContent = summary.assignments + summary.tasks === 0
        ? 'Nothing due'
        : plural(summary.assignments, 'assignment') + ' and ' + plural(summary.tasks, 'task') + ' due' +
          (summary.overdue ? ' (' + summary.overdue + ' overdue)' : '');
      el.dayBody.innerHTML = dayBodyHtml(entry, state, now);
    }

    function select(key) {
      if (key) {
        selected = key;
        refresh();
      }
    }

    // ONE click listener for the whole screen (event delegation)
    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');

      if (action === 'select') {
        select(target.getAttribute('data-date'));
      } else if (action === 'prev') {
        select(csel.shiftMonthKey(selected, -1));
      } else if (action === 'next') {
        select(csel.shiftMonthKey(selected, 1));
      } else if (action === 'today') {
        select(asel.todayString(new Date()));
      } else if (action === 'view') {
        var id = target.getAttribute('data-id');
        if (target.getAttribute('data-kind') === 'task') {
          EF.tasksUi.openDetails(page, id);
        } else {
          EF.assignmentsUi.openDetails(ui, id);
        }
      }
    });

    // Keyboard: arrows move by day/week, Home/End jump to the start/end of the week, Page Up/Down change month
    el.grid.addEventListener('keydown', function (event) {
      if (!event.target.closest('[data-date]')) {
        return;
      }
      var weekStart = EF.store.getState().settings.weekStart;
      var position = csel.weekPosition(selected, weekStart);
      var next;
      switch (event.key) {
        case 'ArrowLeft': next = csel.addDays(selected, -1); break;
        case 'ArrowRight': next = csel.addDays(selected, 1); break;
        case 'ArrowUp': next = csel.addDays(selected, -7); break;
        case 'ArrowDown': next = csel.addDays(selected, 7); break;
        case 'Home': next = csel.addDays(selected, -position); break;
        case 'End': next = csel.addDays(selected, 6 - position); break;
        case 'PageUp': next = csel.shiftMonthKey(selected, -1); break;
        case 'PageDown': next = csel.shiftMonthKey(selected, 1); break;
        default: return;
      }
      event.preventDefault();
      if (next) {
        // The grid redraws and keeps focus because it was inside the grid
        select(next);
      }
    });

    // Store -> screen. The router throws this page away when you leave,
    // so we stop listening once it is no longer on screen.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
      var changed = change.changed;
      if (changed.indexOf('assignments') !== -1 || changed.indexOf('tasks') !== -1 ||
          changed.indexOf('courses') !== -1 || changed.indexOf('settings') !== -1) {
        refresh();
      }
    });

    // "Today" changes at midnight, so redraw when the tab is shown again (no timers)
    function onVisible() {
      if (!page.isConnected) {
        document.removeEventListener('visibilitychange', onVisible);
        return;
      }
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    refresh();
  }

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('calendar', {
    title: 'Calendar',
    render: render
  });
})();