/* =========================================================
   ANALYTICS SELECTORS (pure functions - nothing is stored)
   Turns the saved data into the numbers the Analytics screen draws.

   RULES (same as the Dashboard, so the numbers always agree)
   - Overdue assignments / tasks: EXACTLY the "Overdue" deadline
     filter of the Assignments and Tasks screens (unfinished and past due).
   - Task completion rate: Done tasks / all tasks. No tasks = no rate.
   - Finished assignment: Submitted or Completed.
   - Course "work completion": the average of getAssignmentProgress()
     over ALL that course's assignments (finished ones count as 100%,
     the rest follow the linked-task progress rules).
   - A task counts for its assignment's course (effectiveCourseId).
   - Next 7 days: today and the 6 days after it. Only unfinished
     assignments and tasks that are not Done. Overdue work is reported
     separately, and items with no due date never appear.
   - Archived courses are kept (their work still exists); an archived
     course with no work at all is left out.
   Local "YYYY-MM-DD" dates only (see EF.calendarSelectors).
   Loads after assignment-, task- and calendar-selectors.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;
  var csel = EF.calendarSelectors;
  var schema = EF.schema;

  var STATUS_ORDER = ['not_started', 'in_progress', 'submitted', 'completed'];
  var PRIORITY_ORDER = ['high', 'medium', 'low'];
  var DAYS_AHEAD = 7;

  function percent(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function isFinished(assignment) {
    return schema.isAssignmentFinished(assignment.status);
  }

  function compareText(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  }

  // ---------- pieces ----------

  function getStatuses(assignments) {
    return STATUS_ORDER.map(function (key) {
      var count = assignments.filter(function (a) { return a.status === key; }).length;
      return { key: key, label: asel.statusLabel(key), count: count, percent: percent(count, assignments.length) };
    });
  }

  function getPriorities(assignments) {
    return PRIORITY_ORDER.map(function (key) {
      var group = assignments.filter(function (a) { return a.priority === key; });
      return {
        key: key,
        label: asel.priorityLabel(key),
        count: group.length,
        open: group.filter(function (a) { return !isFinished(a); }).length
      };
    });
  }

  function getTaskSummary(state, now) {
    var total = state.tasks.length;
    var done = state.tasks.filter(tsel.isDone).length;
    return {
      total: total,
      done: done,
      remaining: total - done,
      rate: total > 0 ? percent(done, total) : null,
      overdue: tsel.filterTasks(state.tasks, { deadline: 'overdue' }, state.assignments, now).length
    };
  }

  function getDays(state, now) {
    var today = asel.todayString(now);
    var names = csel.weekdayLabels('sunday');
    var days = [];
    for (var i = 0; i < DAYS_AHEAD; i++) {
      var date = csel.addDays(today, i);
      var parts = csel.parseKey(date);
      var assignments = state.assignments.filter(function (a) { return a.dueDate === date && !isFinished(a); }).length;
      var tasks = state.tasks.filter(function (t) { return t.dueDate === date && !tsel.isDone(t); }).length;
      days.push({
        date: date,
        isToday: i === 0,
        weekday: names[csel.weekdayOf(date)].short,
        dayNumber: parts.day,
        longLabel: csel.formatLongDate(date),
        assignments: assignments,
        tasks: tasks,
        total: assignments + tasks
      });
    }
    return days;
  }

  function getCourses(state, now) {
    var assignmentsById = tsel.mapById(state.assignments);
    var groups = state.courses.map(function (course) {
      return { id: course.id, course: course, assignments: [], tasks: [] };
    });
    var none = { id: null, course: null, assignments: [], tasks: [] };
    var byId = {};
    groups.forEach(function (group) { byId[group.id] = group; });

    state.assignments.forEach(function (assignment) {
      (byId[assignment.courseId] || none).assignments.push(assignment);
    });
    state.tasks.forEach(function (task) {
      var courseId = tsel.effectiveCourseId(task, assignmentsById);
      (byId[courseId] || none).tasks.push(task);
    });
    groups.push(none);

    return groups.filter(function (group) {
      return group.assignments.length + group.tasks.length > 0 || (group.course && !group.course.archived);
    }).map(function (group) {
      var progressSum = group.assignments.reduce(function (sum, a) {
        return sum + tsel.getAssignmentProgress(a, state.tasks).percent;
      }, 0);
      return {
        course: group.course,
        assignments: group.assignments.length,
        finished: group.assignments.filter(isFinished).length,
        overdue: group.assignments.filter(function (a) { return asel.getDeadlineInfo(a, now).state === 'overdue'; }).length,
        openTasks: group.tasks.filter(function (t) { return !tsel.isDone(t); }).length,
        totalTasks: group.tasks.length,
        completion: group.assignments.length ? Math.round(progressSum / group.assignments.length) : null
      };
    }).sort(function (a, b) {
      var aWork = a.assignments + a.totalTasks;
      var bWork = b.assignments + b.totalTasks;
      if (aWork !== bWork) { return bWork - aWork; }
      return compareText(a.course ? a.course.name : '~', b.course ? b.course.name : '~');
    });
  }

  // A few plain sentences about what the numbers mean
  function getInsights(data) {
    var lines = [];
    var overdue = data.counts.overdueAssignments + data.tasks.overdue;
    if (overdue > 0) {
      lines.push(plural(overdue, 'item') + ' overdue (' + plural(data.counts.overdueAssignments, 'assignment') +
        ', ' + plural(data.tasks.overdue, 'task') + '). Catch up on these first.');
    }

    var busiest = data.days.reduce(function (best, day) { return day.total > best.total ? day : best; }, data.days[0]);
    lines.push(busiest.total > 0
      ? 'Busiest day in the next 7 days: ' + busiest.longLabel + ' with ' + plural(busiest.total, 'item') + ' due.'
      : 'Nothing is due in the next 7 days.');

    if (data.tasks.total > 0) {
      lines.push('You have finished ' + data.tasks.done + ' of ' + plural(data.tasks.total, 'task') + ' (' + data.tasks.rate + '%).');
    }

    var highOpen = data.priorities[0].open;
    if (highOpen > 0) {
      lines.push(plural(highOpen, 'high-priority assignment') + (highOpen === 1 ? ' is' : ' are') + ' still open.');
    }

    var top = data.courses.filter(function (c) { return c.course && (c.assignments - c.finished + c.openTasks) > 0; })
      .sort(function (a, b) { return (b.assignments - b.finished + b.openTasks) - (a.assignments - a.finished + a.openTasks); })[0];
    if (top && lines.length < 5) {
      lines.push('Most open work: ' + top.course.name + ' (' + plural(top.assignments - top.finished, 'assignment') +
        ', ' + plural(top.openTasks, 'task') + ').');
    }
    return lines.slice(0, 5);
  }

  function build(state, now) {
    var assignments = state.assignments;
    var data = {
      isEmpty: assignments.length === 0 && state.tasks.length === 0,
      counts: {
        totalAssignments: assignments.length,
        completed: assignments.filter(function (a) { return a.status === 'completed'; }).length,
        inProgress: assignments.filter(function (a) { return a.status === 'in_progress'; }).length,
        submitted: assignments.filter(function (a) { return a.status === 'submitted'; }).length,
        overdueAssignments: asel.filterAssignments(assignments, { deadline: 'overdue' }, now).length
      },
      statuses: getStatuses(assignments),
      priorities: getPriorities(assignments),
      tasks: getTaskSummary(state, now),
      days: getDays(state, now),
      courses: getCourses(state, now)
    };
    data.insights = data.isEmpty ? [] : getInsights(data);
    return data;
  }

  EF.analyticsSelectors = { build: build };
})();