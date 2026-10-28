/* =========================================================
   ANALYTICS SCREEN
   - Every number and chart comes from EF.analyticsSelectors,
     which works it out from the store each time. Nothing is saved.
   - Charts are plain SVG / CSS (no libraries, fully offline).
   - Colour is never the only clue: every chart has written
     labels and counts, and "tasks" / "remaining" use a striped
     pattern while "assignments" / "done" are solid.
   - The page only READS the store. It redraws when assignments,
     tasks or courses change, and when you return to the tab.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var asl = EF.analyticsSelectors;

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function pct(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  // ---------- summary cards ----------

  function statsHtml(data) {
    var c = data.counts;
    var t = data.tasks;
    var cards = [
      { icon: 'assignments', label: 'Total assignments', value: c.totalAssignments, note: 'All statuses' },
      { icon: 'check-circle', label: 'Completed', value: c.completed, note: 'Assignments marked Completed' },
      { icon: 'half-circle', label: 'In progress', value: c.inProgress, note: 'Assignments being worked on' },
      { icon: 'send', label: 'Submitted', value: c.submitted, note: 'Handed in, not yet Completed' },
      { icon: 'alert', label: 'Overdue', value: c.overdueAssignments,
        note: t.overdue > 0 ? 'Plus ' + plural(t.overdue, 'overdue task') : 'Assignments past due', alert: c.overdueAssignments + t.overdue > 0 },
      { icon: 'tasks', label: 'Total tasks', value: t.total, note: plural(t.remaining, 'task') + ' left' },
      { icon: 'check', label: 'Completed tasks', value: t.done, note: 'Marked Done' },
      { icon: 'analytics', label: 'Task completion rate', value: t.rate === null ? '\u2014' : t.rate + '%',
        note: t.total ? t.done + ' of ' + t.total + ' tasks done' : 'No tasks yet' }
    ];
    return cards.map(function (card) {
      return '<li class="card an-stat' + (card.alert ? ' an-stat--alert' : '') + '">' +
        '<span class="an-stat__icon" aria-hidden="true">' + icon(card.icon) + '</span>' +
        '<span class="an-stat__label">' + esc(card.label) + '</span>' +
        '<span class="an-stat__value">' + esc(card.value) + '</span>' +
        '<span class="an-stat__note">' + esc(card.note) + '</span>' +
      '</li>';
    }).join('');
  }

  // ---------- chart card shell ----------

  function chartCard(title, iconName, subtitle, bodyHtml) {
    return '<section class="card an-card">' +
      '<h2 class="an-card__title">' + icon(iconName) + esc(title) + '</h2>' +
      (subtitle ? '<p class="an-card__sub">' + esc(subtitle) + '</p>' : '') +
      bodyHtml +
    '</section>';
  }

  function emptyChart(text) {
    return '<p class="an-empty">' + icon('info') + '<span>' + esc(text) + '</span></p>';
  }

  // ---------- 1. status donut ----------

  function statusChartHtml(data) {
    var total = data.counts.totalAssignments;
    if (total === 0) {
      return emptyChart('Add an assignment to see how your work is spread across statuses.');
    }
    var used = data.statuses.filter(function (s) { return s.count > 0; }).length;
    var gap = used > 1 ? 0.8 : 0;
    var offset = 25;
    var rings = '';
    data.statuses.forEach(function (s) {
      if (s.count === 0) {
        return;
      }
      var length = (s.count / total) * 100;
      rings += '<circle class="an-seg an-seg--' + s.key + '" cx="21" cy="21" r="15.9155" fill="none" stroke-width="6"' +
        ' stroke-dasharray="' + Math.max(length - gap, 0.1).toFixed(2) + ' ' + (100 - Math.max(length - gap, 0.1)).toFixed(2) + '"' +
        ' stroke-dashoffset="' + offset.toFixed(2) + '"></circle>';
      offset -= length;
    });
    var summary = data.statuses.map(function (s) { return s.label + ' ' + s.count; }).join(', ');
    var legend = data.statuses.map(function (s) {
      return '<li><span class="an-swatch an-swatch--' + s.key + '" aria-hidden="true"></span>' +
        '<span class="an-legend__name">' + esc(s.label) + '</span>' +
        '<span class="an-legend__value">' + s.count + ' <small>(' + s.percent + '%)</small></span></li>';
    }).join('');
    return '<div class="an-donut-wrap">' +
      '<svg class="an-donut" viewBox="0 0 42 42" role="img" aria-label="' + esc('Assignments by status: ' + summary) + '">' +
        '<circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="6" class="an-donut__track"></circle>' + rings +
        '<text x="21" y="21.5" text-anchor="middle" class="an-donut__num">' + total + '</text>' +
        '<text x="21" y="26.5" text-anchor="middle" class="an-donut__cap">assignments</text>' +
      '</svg>' +
      '<ul class="an-legend">' + legend + '</ul>' +
    '</div>';
  }

  // ---------- 2. tasks done vs remaining ----------

  function taskChartHtml(data) {
    var t = data.tasks;
    if (t.total === 0) {
      return emptyChart('Add a task to see how many you have finished.');
    }
    var donePct = pct(t.done, t.total);
    return '<div class="an-split" role="img" aria-label="' + esc(t.done + ' of ' + t.total + ' tasks done, ' + t.remaining + ' remaining') + '">' +
        '<span class="an-split__done" style="width: ' + donePct + '%"></span>' +
        '<span class="an-split__left" style="width: ' + (100 - donePct) + '%"></span>' +
      '</div>' +
      '<ul class="an-legend an-legend--spaced">' +
        '<li><span class="an-swatch an-swatch--done" aria-hidden="true"></span><span class="an-legend__name">Done</span>' +
          '<span class="an-legend__value">' + t.done + ' <small>(' + donePct + '%)</small></span></li>' +
        '<li><span class="an-swatch an-swatch--left" aria-hidden="true"></span><span class="an-legend__name">Remaining</span>' +
          '<span class="an-legend__value">' + t.remaining + ' <small>(' + (100 - donePct) + '%)</small></span></li>' +
      '</ul>' +
      (t.overdue > 0 ? '<p class="an-note">' + icon('alert') + '<span>' + plural(t.overdue, 'remaining task') + ' overdue.</span></p>' : '');
  }

  // ---------- 3. priority bars ----------

  function priorityChartHtml(data) {
    var max = data.priorities.reduce(function (m, p) { return Math.max(m, p.count); }, 0);
    if (max === 0) {
      return emptyChart('Add an assignment to see its priority mix.');
    }
    return '<ul class="an-rows">' + data.priorities.map(function (p) {
      var width = p.count === 0 ? 0 : Math.max(pct(p.count, max), 4);
      return '<li class="an-row">' +
        '<span class="an-row__label">' + icon('flag') + esc(p.label) + '</span>' +
        '<span class="an-row__track" aria-hidden="true"><span class="an-row__fill an-row__fill--' + esc(p.key) + '" style="width: ' + width + '%"></span></span>' +
        '<span class="an-row__value">' + p.count + ' <small>(' + p.open + ' open)</small></span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  // ---------- 4. next 7 days ----------

  function daysChartHtml(data) {
    var max = data.days.reduce(function (m, d) { return Math.max(m, d.total); }, 0);
    var columns = data.days.map(function (d) {
      var label = d.longLabel + (d.isToday ? ' (today)' : '') + ': ' +
        plural(d.assignments, 'assignment') + ' and ' + plural(d.tasks, 'task') + ' due';
      return '<li class="an-day' + (d.isToday ? ' an-day--today' : '') + '" role="img" aria-label="' + esc(label) + '">' +
        '<span class="an-day__total">' + d.total + '</span>' +
        '<span class="an-day__bars" aria-hidden="true">' +
          (d.tasks ? '<span class="an-day__seg an-day__seg--tasks" style="height: ' + pct(d.tasks, max) + '%"></span>' : '') +
          (d.assignments ? '<span class="an-day__seg an-day__seg--assignments" style="height: ' + pct(d.assignments, max) + '%"></span>' : '') +
        '</span>' +
        '<span class="an-day__name">' + (d.isToday ? 'Today' : esc(d.weekday)) + '</span>' +
        '<span class="an-day__date">' + d.dayNumber + '</span>' +
      '</li>';
    }).join('');
    return (max === 0 ? emptyChart('Nothing unfinished is due in the next 7 days.') : '') +
      '<ul class="an-days" aria-label="Items due each day">' + columns + '</ul>' +
      '<ul class="an-legend an-legend--inline">' +
        '<li><span class="an-swatch an-swatch--assignments" aria-hidden="true"></span>Assignments (solid)</li>' +
        '<li><span class="an-swatch an-swatch--tasks" aria-hidden="true"></span>Tasks (striped)</li>' +
      '</ul>';
  }

  // ---------- courses ----------

  function courseTagHtml(course) {
    if (!course) {
      return '<span class="course-tag course-tag--none"><span class="course-tag__dot" aria-hidden="true"></span>No course</span>';
    }
    return '<span class="course-tag" style="--course-color: ' + esc(course.color) + '">' +
      '<span class="course-tag__dot" aria-hidden="true"></span>' + esc(course.name) +
      (course.archived ? ' <span class="course-tag__note">(archived)</span>' : '') + '</span>';
  }

  function coursesHtml(data) {
    if (data.courses.length === 0) {
      return emptyChart('Add a course and link assignments to it to compare your workload by course.');
    }
    return '<ul class="an-courses">' + data.courses.map(function (row) {
      var label = row.course ? row.course.name : 'No course';
      var percent = row.completion === null ? 0 : row.completion;
      return '<li class="an-course">' +
        '<div class="an-course__top">' + courseTagHtml(row.course) +
          '<span class="an-course__value">' + (row.completion === null ? 'No assignments' : percent + '% complete') + '</span></div>' +
        '<div class="progress" role="progressbar" aria-label="' + esc('Work completion for ' + label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '">' +
          '<div class="progress__bar" style="width: ' + percent + '%' + (percent === 100 ? '; --progress-color: var(--color-success)' : '') + '"></div>' +
        '</div>' +
        '<ul class="an-course__meta">' +
          '<li>' + icon('assignments') + plural(row.assignments, 'assignment') + ' (' + row.finished + ' finished)</li>' +
          '<li>' + icon('tasks') + plural(row.totalTasks, 'task') + ' (' + row.openTasks + ' open)</li>' +
          (row.overdue ? '<li class="an-course__alert">' + icon('alert') + row.overdue + ' overdue</li>' : '') +
        '</ul>' +
      '</li>';
    }).join('') + '</ul>';
  }

  // ---------- the screen ----------

  function emptyPageHtml() {
    return '<section class="card empty">' +
      '<div class="empty__icon">' + icon('analytics') + '</div>' +
      '<h2 class="empty__title">No data to analyse yet</h2>' +
      '<p class="empty__text">Add assignments and tasks and your charts will appear here automatically.</p>' +
      '<div class="cluster">' +
        '<a class="btn btn--primary" href="#/assignments">' + icon('assignments') + 'Go to Assignments</a>' +
        '<a class="btn btn--secondary" href="#/tasks">' + icon('tasks') + 'Go to Tasks</a>' +
      '</div>' +
    '</section>';
  }

  function pageHtml(data) {
    if (data.isEmpty) {
      return emptyPageHtml();
    }
    return '<section class="card an-insights" aria-labelledby="an-insights-title">' +
        '<h2 class="an-card__title" id="an-insights-title">' + icon('info') + 'What the numbers say</h2>' +
        '<ul class="an-insights__list">' + data.insights.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul>' +
      '</section>' +
      '<ul class="an-stats" aria-label="Summary">' + statsHtml(data) + '</ul>' +
      '<div class="an-grid">' +
        chartCard('Assignments by status', 'assignments', 'How much of your work is in each stage', statusChartHtml(data)) +
        chartCard('Task completion', 'tasks', 'Done compared with remaining', taskChartHtml(data)) +
        chartCard('Assignments by priority', 'flag', 'All assignments, and how many are still open', priorityChartHtml(data)) +
        chartCard('Next 7 days', 'calendar', 'Unfinished work due from today', daysChartHtml(data)) +
      '</div>' +
      chartCard('Workload by course', 'courses', 'Work completion = average progress of each course\u2019s assignments', coursesHtml(data));
  }

  function render(page) {
    page.innerHTML = '<div class="an-page" id="an-root"></div>';
    var root = page.querySelector('#an-root');
    var lastHtml = '';

    // Reads the store and redraws only if something visible changed
    function refresh() {
      var html = pageHtml(asl.build(EF.store.getState(), new Date()));
      if (html !== lastHtml) {
        lastHtml = html;
        root.innerHTML = html;
      }
    }

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

    // "Today" changes at midnight, so redraw when the tab is shown again
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
  EF.router.register('analytics', {
    title: 'Analytics',
    render: render
  });
})();