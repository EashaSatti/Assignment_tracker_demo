/* =========================================================
   DASHBOARD SCREEN
   - Reads everything live from EF.store. Nothing is stored here.
   - Every number and list comes from EF.dashboardSelectors
     (the counting rules are documented in that file).
   - It never changes data by itself. Buttons call the same
     functions the Assignments and Tasks screens use
     (EF.assignmentsUi / EF.tasksUi), so there is one form and
     one "mark done" rule for the whole app.
   - The page is built once; only the changing parts are redrawn,
     so buttons you just used keep keyboard focus.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;
  var dsel = EF.dashboardSelectors;

  var UPCOMING_LIMIT = 5;
  var OVERDUE_LIMIT = 3;
  var TASK_LIMIT = 5;
  var PROGRESS_LIMIT = 4;
  var RECENT_LIMIT = 5;

  // ---------- small helpers ----------

  function plural(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  function greeting(now) {
    var hour = now.getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    return hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  function dueText(item) {
    if (!item.dueDate) {
      return 'No due date';
    }
    return asel.formatDueDate(item.dueDate) + (item.dueTime ? ' at ' + asel.formatDueTime(item.dueTime) : '');
  }

  // ---------- small HTML builders (icon AND words, never colour alone) ----------

  function statusBadge(status) {
    var icons = { not_started: 'circle', in_progress: 'half-circle', submitted: 'send', completed: 'check-circle' };
    var classes = { not_started: 'badge--not-started', in_progress: 'badge--in-progress', submitted: 'badge--submitted', completed: 'badge--completed' };
    return '<span class="badge ' + classes[status] + '">' + icon(icons[status]) + esc(asel.statusLabel(status)) + '</span>';
  }

  function priorityBadge(priority) {
    return '<span class="badge badge--priority-' + esc(priority) + '">' + icon('flag') + esc(asel.priorityLabel(priority)) + ' priority</span>';
  }

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

  function progressBarHtml(percent, label) {
    return '<div class="progress-row">' +
      '<div class="progress" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '">' +
        '<div class="progress__bar" style="width: ' + percent + '%' + (percent === 100 ? '; --progress-color: var(--color-success)' : '') + '"></div>' +
      '</div>' +
      '<span class="progress-row__value">' + percent + '%</span>' +
    '</div>';
  }

  function emptyHtml(iconName, title, text) {
    return '<div class="dash-empty">' +
      '<span class="dash-empty__icon" aria-hidden="true">' + icon(iconName) + '</span>' +
      '<p class="dash-empty__title">' + esc(title) + '</p>' +
      '<p class="dash-empty__text">' + esc(text) + '</p>' +
    '</div>';
  }

  // ---------- the changing parts ----------

  function statsHtml(counts) {
    var overdueTasksNote = counts.overdueTasks > 0 ? plural(counts.overdueTasks, 'task') + ' overdue' : 'Not done yet';
    var cards = [
      { go: 'assignments-all', icon: 'assignments', label: 'Total Assignments', value: counts.totalAssignments,
        note: 'Across all courses', hint: 'View all assignments' },
      { go: 'tasks-todo', icon: 'tasks', label: 'Pending Tasks', value: counts.pendingTasks,
        note: overdueTasksNote, hint: 'View tasks that are not done', danger: counts.overdueTasks > 0 },
      { go: 'assignments-soon', icon: 'clock', label: 'Due Soon', value: counts.dueSoon,
        note: 'In the next 7 days', hint: 'View assignments due in the next 7 days' },
      { go: 'assignments-completed', icon: 'check-circle', label: 'Completed Assignments', value: counts.completedAssignments,
        note: counts.submittedAssignments > 0 ? 'Plus ' + counts.submittedAssignments + ' submitted' : 'Marked Completed',
        hint: 'View completed assignments' }
    ];
    return cards.map(function (card) {
      return '<button type="button" class="card dash-stat' + (card.danger ? ' dash-stat--alert' : '') + '" data-action="go" data-go="' + card.go + '"' +
          ' aria-label="' + esc(card.label + ': ' + card.value + '. ' + card.note + '. ' + card.hint) + '">' +
        '<span class="dash-stat__icon" aria-hidden="true">' + icon(card.icon) + '</span>' +
        '<span class="stat">' +
          '<span class="stat__label">' + esc(card.label) + '</span>' +
          '<span class="stat__value">' + card.value + '</span>' +
        '</span>' +
        '<span class="dash-stat__note">' + (card.danger ? icon('alert') : '') + esc(card.note) + '</span>' +
      '</button>';
    }).join('');
  }

  function assignmentRowHtml(assignment, courses, now) {
    var course = assignment.courseId ? courses[assignment.courseId] || null : null;
    var info = asel.getDeadlineInfo(assignment, now);
    return '<li class="dash-item"' + (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="dash-item__top">' +
        '<button type="button" class="link-btn dash-item__title" data-action="view" data-kind="assignment" data-id="' + esc(assignment.id) + '">' +
          esc(assignment.title) + '</button>' +
        '<span class="dash-item__when">' + deadlineBadge(info) + '</span>' +
      '</div>' +
      '<ul class="dash-item__meta">' +
        '<li>' + courseTagHtml(course) + '</li>' +
        '<li>' + icon('calendar') + '<span><span class="visually-hidden">Due: </span>' + esc(dueText(assignment)) + '</span></li>' +
        '<li>' + priorityBadge(assignment.priority) + '</li>' +
        '<li>' + statusBadge(assignment.status) + '</li>' +
      '</ul>' +
    '</li>';
  }

  function deadlinesHtml(state, courses, now) {
    var overdue = dsel.getOverdueAssignments(state.assignments, now);
    var upcoming = dsel.getUpcomingAssignments(state.assignments, now);
    var html = '';

    if (overdue.length > 0) {
      html += '<div class="dash-group dash-group--overdue">' +
        '<h3 class="dash-group__title">' + icon('alert') + 'Overdue <span class="dash-group__count">' + overdue.length + '</span></h3>' +
        '<ul class="dash-list">' + overdue.slice(0, OVERDUE_LIMIT).map(function (assignment) {
          return assignmentRowHtml(assignment, courses, now);
        }).join('') + '</ul>' +
        (overdue.length > OVERDUE_LIMIT
          ? '<p class="dash-more">+ ' + (overdue.length - OVERDUE_LIMIT) + ' more overdue on the Assignments screen</p>' : '') +
      '</div>';
    }

    if (upcoming.length > 0) {
      html += '<div class="dash-group">' +
        (overdue.length > 0 ? '<h3 class="dash-group__title">' + icon('clock') + 'Coming up</h3>' : '') +
        '<ul class="dash-list">' + upcoming.slice(0, UPCOMING_LIMIT).map(function (assignment) {
          return assignmentRowHtml(assignment, courses, now);
        }).join('') + '</ul>' +
        (upcoming.length > UPCOMING_LIMIT
          ? '<p class="dash-more">+ ' + (upcoming.length - UPCOMING_LIMIT) + ' more with due dates</p>' : '') +
      '</div>';
    } else if (overdue.length === 0) {
      html += state.assignments.length === 0
        ? emptyHtml('assignments', 'No assignments yet', 'Add an assignment with a due date and it will appear here.')
        : emptyHtml('check-circle', 'No upcoming deadlines', 'Nothing unfinished has a due date. Add one to an assignment to see it here.');
    }
    return html;
  }

  function taskRowHtml(task, assignments, now) {
    var assignment = task.assignmentId !== null ? assignments[task.assignmentId] || null : null;
    var courseId = tsel.effectiveCourseId(task, assignments);
    var course = courseId ? EF.store.getCourse(courseId) : null;
    var info = tsel.getDeadlineInfo(task, now);
    var title = esc(task.title);
    return '<li class="dash-item dash-item--task"' + (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="dash-item__top">' +
        '<div class="dash-item__lead">' +
          '<input type="checkbox" class="task-check" data-action="toggle-task" data-id="' + esc(task.id) + '" aria-label="Mark as done: ' + title + '">' +
          '<button type="button" class="link-btn dash-item__title" data-action="view" data-kind="task" data-id="' + esc(task.id) + '">' + title + '</button>' +
        '</div>' +
        '<span class="dash-item__when">' + deadlineBadge(info) + '</span>' +
      '</div>' +
      '<ul class="dash-item__meta">' +
        '<li>' + courseTagHtml(course) + '</li>' +
        (assignment
          ? '<li>' + icon('assignments') + '<span><span class="visually-hidden">Assignment: </span>' + esc(assignment.title) + '</span></li>'
          : '') +
        '<li>' + icon('calendar') + '<span><span class="visually-hidden">Due: </span>' + esc(task.dueDate ? asel.formatDueDate(task.dueDate) : 'No due date') + '</span></li>' +
        '<li>' + priorityBadge(task.priority) + '</li>' +
        '<li><span class="badge badge--not-started">' + icon('circle') + 'To Do</span></li>' +
      '</ul>' +
    '</li>';
  }

  function tasksHtml(state, assignments, now) {
    var tasks = dsel.getAttentionTasks(state.tasks, now);
    if (tasks.length === 0) {
      return state.tasks.length === 0
        ? emptyHtml('tasks', 'No tasks yet', 'Break an assignment into small steps and they will show up here.')
        : emptyHtml('check-circle', 'All tasks are done', 'Nothing left to do. Enjoy the break!');
    }
    return '<ul class="dash-list">' + tasks.slice(0, TASK_LIMIT).map(function (task) {
      return taskRowHtml(task, assignments, now);
    }).join('') + '</ul>' +
    (tasks.length > TASK_LIMIT ? '<p class="dash-more">+ ' + (tasks.length - TASK_LIMIT) + ' more to do on the Tasks screen</p>' : '');
  }

  function progressHtml(state) {
    var summary = dsel.getProgressSummary(state.assignments, state.tasks, PROGRESS_LIMIT);
    if (state.assignments.length === 0) {
      return emptyHtml('assignments', 'No progress to show', 'Add an assignment and tick off its tasks to see your progress.');
    }
    if (summary.activeCount === 0) {
      return emptyHtml('check-circle', 'Everything is finished',
        'All ' + plural(summary.finishedCount, 'assignment') + ' are submitted or completed.');
    }
    return '<div class="dash-progress__headline">' +
        '<span class="dash-progress__value">' + summary.average + '%</span>' +
        '<span class="dash-progress__caption">average across ' + plural(summary.activeCount, 'active assignment') + '</span>' +
      '</div>' +
      progressBarHtml(summary.average, 'Average progress of active assignments') +
      '<p class="dash-note">Average of the assignments not yet submitted or completed. ' +
        (summary.finishedCount > 0 ? plural(summary.finishedCount, 'finished assignment') + ' not included.' : '') + '</p>' +
      '<ul class="dash-list dash-list--tight">' + summary.items.map(function (item) {
        var a = item.assignment;
        var p = item.progress;
        var note = p.total > 0 ? p.done + ' of ' + plural(p.total, 'task') + ' done' : 'No tasks linked';
        return '<li class="dash-item dash-item--progress">' +
          '<button type="button" class="link-btn dash-item__title" data-action="view" data-kind="assignment" data-id="' + esc(a.id) + '">' + esc(a.title) + '</button>' +
          progressBarHtml(p.percent, 'Progress for ' + a.title) +
          '<p class="dash-note">' + esc(note) + '</p>' +
        '</li>';
      }).join('') + '</ul>' +
      (summary.activeCount > PROGRESS_LIMIT ? '<p class="dash-more">+ ' + (summary.activeCount - PROGRESS_LIMIT) + ' more active</p>' : '');
  }

  function recentHtml(state) {
    var events = dsel.getRecentlyCompleted(state.assignments, state.tasks, RECENT_LIMIT);
    if (events.length === 0) {
      return emptyHtml('check', 'Nothing finished yet', 'Tasks you tick off and assignments you submit will be listed here.');
    }
    return '<ul class="dash-list dash-list--tight">' + events.map(function (event) {
      return '<li class="dash-recent">' +
        '<span class="dash-recent__icon" aria-hidden="true">' + icon(event.kind === 'task' ? 'tasks' : 'assignments') + '</span>' +
        '<span class="dash-recent__text">' +
          '<span class="dash-recent__title">' + esc(event.title) + '</span>' +
          '<span class="dash-recent__when">' + esc(event.kind === 'task' ? 'Task' : 'Assignment') + ' · ' + esc(event.label) + ' · ' + esc(asel.formatDateTime(event.at)) + '</span>' +
        '</span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  // ---------- the screen ----------

  function cardShell(id, title, iconName, viewAllGo, viewAllLabel, extraClass) {
    return '<section class="card dash-card' + (extraClass ? ' ' + extraClass : '') + '" aria-labelledby="' + id + '-title">' +
      '<div class="dash-card__header">' +
        '<h2 class="dash-card__title" id="' + id + '-title" tabindex="-1">' + icon(iconName) + esc(title) + '</h2>' +
        (viewAllGo ? '<button type="button" class="btn btn--ghost btn--sm" data-action="go" data-go="' + viewAllGo + '">' + esc(viewAllLabel) + '</button>' : '') +
      '</div>' +
      '<div class="dash-card__body" id="' + id + '-body"></div>' +
    '</section>';
  }

  function render(page) {
    page.innerHTML =
          '<div id="dash-onboarding"></div>' +
      '<section class="card dash-hero" aria-labelledby="dash-greeting">' +
        '<p class="dash-hero__date" id="dash-date"></p>' +
        '<h2 class="dash-hero__title" id="dash-greeting"></h2>' +
        '<p class="dash-hero__message" id="dash-message" aria-live="polite"></p>' +
      '</section>' +

      '<div class="dash-stats" id="dash-stats"></div>' +

      '<div class="dash-grid">' +
        '<div class="dash-main">' +
          cardShell('dash-deadlines', 'Upcoming deadlines', 'calendar', 'assignments-all', 'View all assignments') +
          cardShell('dash-tasks', 'Tasks needing attention', 'tasks', 'tasks-all', 'View all tasks') +
        '</div>' +
        '<div class="dash-side">' +
          '<section class="card dash-card" aria-labelledby="dash-actions-title">' +
            '<div class="dash-card__header"><h2 class="dash-card__title" id="dash-actions-title" tabindex="-1">' + icon('plus') + 'Quick actions</h2></div>' +
            '<div class="dash-actions">' +
              '<button type="button" class="btn btn--primary" data-action="add-assignment">' + icon('plus') + 'Add Assignment</button>' +
              '<button type="button" class="btn btn--secondary" data-action="add-task">' + icon('plus') + 'Add Task</button>' +
              '<button type="button" class="btn btn--ghost" data-action="go" data-go="courses">' + icon('courses') + 'View Courses</button>' +
              '<button type="button" class="btn btn--ghost" data-action="go" data-go="assignments-all">' + icon('assignments') + 'View All Assignments</button>' +
              '<button type="button" class="btn btn--ghost" data-action="go" data-go="tasks-all">' + icon('tasks') + 'View All Tasks</button>' +
            '</div>' +
          '</section>' +
          cardShell('dash-progress', 'Overall progress', 'half-circle', null, '') +
          cardShell('dash-recent', 'Recently completed', 'check-circle', null, '') +
        '</div>' +
      '</div>';

    var el = {
      date: page.querySelector('#dash-date'),
      greeting: page.querySelector('#dash-greeting'),
      message: page.querySelector('#dash-message'),
      stats: page.querySelector('#dash-stats'),
      deadlines: page.querySelector('#dash-deadlines-body'),
      tasks: page.querySelector('#dash-tasks-body'),
      progress: page.querySelector('#dash-progress-body'),
      recent: page.querySelector('#dash-recent-body')
    };

        EF.onboarding.mount(page.querySelector('#dash-onboarding'), page);
        
    // The page asks for the same things the Assignments/Tasks screens use
    var ui = { page: page, resetFilters: function () {} };

    // Reads the store and draws the changing parts. The store is only READ here.
    function refresh() {
      var now = new Date();
      var state = EF.store.getState();
      var counts = dsel.getCounts(state, now);
      var courses = tsel.mapById(state.courses);
      var assignments = tsel.mapById(state.assignments);

      el.date.textContent = asel.formatDueDate(asel.todayString(now));
      el.greeting.textContent = greeting(now);
      el.message.textContent = dsel.workloadMessage(counts);
      el.stats.innerHTML = statsHtml(counts);
      el.deadlines.innerHTML = deadlinesHtml(state, courses, now);
      el.tasks.innerHTML = tasksHtml(state, assignments, now);
      el.progress.innerHTML = progressHtml(state);
      el.recent.innerHTML = recentHtml(state);
    }

    // Where each "go" button leads. A filter is applied only through the filter functions
    // the Assignments and Tasks screens provide, so the list you land on matches the number you clicked.
    var DESTINATIONS = {
      'assignments-all': function () { EF.assignmentsUi.showFilter({}); },
      'assignments-soon': function () { EF.assignmentsUi.showFilter({ deadline: 'next7' }); },
      'assignments-completed': function () { EF.assignmentsUi.showFilter({ status: 'completed' }); },
      'tasks-all': function () { EF.tasksUi.showFilter({}); },
      'tasks-todo': function () { EF.tasksUi.showFilter({ status: 'todo' }); },
      'courses': function () { window.location.hash = '#/courses'; }
    };

    // ONE click listener for the whole screen (event delegation)
    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');
      var id = target.getAttribute('data-id');

      if (action === 'go') {
        var go = DESTINATIONS[target.getAttribute('data-go')];
        if (go) {
          go();
        }
      } else if (action === 'add-assignment') {
        EF.assignmentsUi.openForm(ui);
      } else if (action === 'add-task') {
        EF.tasksUi.openForm({ page: page });
      } else if (action === 'view') {
        if (target.getAttribute('data-kind') === 'task') {
          EF.tasksUi.openDetails(page, id);
        } else {
          EF.assignmentsUi.openDetails(ui, id);
        }
      } else if (action === 'toggle-task') {
        // The one and only "mark done" rule lives on the Tasks screen
        EF.tasksUi.toggle(id);
        // The ticked task leaves this list, so move keyboard focus to the section heading
        var heading = page.querySelector('#dash-tasks-title');
        if (heading) {
          heading.focus();
        }
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
      if (changed.indexOf('assignments') !== -1 || changed.indexOf('tasks') !== -1 || changed.indexOf('courses') !== -1) {
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
  EF.router.register('dashboard', {
    title: 'Dashboard',
    render: render
  });
})();