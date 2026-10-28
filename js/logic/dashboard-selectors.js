/* =========================================================
   DASHBOARD SELECTORS
   Pure functions that turn the saved data into the numbers and
   lists the Dashboard shows. They only LOOK at the data you hand
   them: they never change the store, never touch the page and
   never read localStorage. Nothing here is stored anywhere.

   COUNTING RULES (the one place they are written down)
   - Total Assignments     every assignment. Assignments have no
                           "archived" flag; only courses do. An
                           assignment in an archived course is still
                           your assignment, and the Assignments screen
                           lists it too, so it is counted.
   - Pending Tasks         tasks that are not Done.
   - Due Soon              unfinished assignments due from today up to
                           7 days from today. Exactly the Assignments
                           screen's "Next 7 Days" deadline filter.
                           Overdue work is NOT included (it has its own
                           list), and neither is Submitted/Completed
                           work or work with no due date.
   - Completed Assignments status "Completed" only. "Submitted" is a
                           separate status and is reported separately.
   - Overdue               unfinished and past due (a due date with no
                           time lasts until the end of that day).
   - Average progress      the average of getAssignmentProgress() over
                           ACTIVE assignments (not Submitted/Completed).
                           Finished assignments are left out, because
                           they are always 100% and would hide how the
                           work still in front of you is going.

   All date maths comes from EF.assignmentSelectors (local calendar
   dates, never UTC). Search/filter rules are reused, not copied.

   Loads after assignment-selectors.js and task-selectors.js.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;
  var schema = EF.schema;

  var PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function isFinished(assignment) {
    return schema.isAssignmentFinished(assignment.status);
  }

  // ---------- counts ----------

  function getCounts(state, now) {
    var assignments = state.assignments;
    var tasks = state.tasks;

    function countAssignments(deadline) {
      return asel.filterAssignments(assignments, { deadline: deadline }, now).length;
    }
    function countTasks(deadline) {
      return tsel.filterTasks(tasks, { deadline: deadline }, assignments, now).length;
    }

    return {
      totalCourses: state.courses.length,
      totalAssignments: assignments.length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(function (task) { return !tsel.isDone(task); }).length,
      dueSoon: countAssignments('next7'),
      completedAssignments: assignments.filter(function (a) { return a.status === 'completed'; }).length,
      submittedAssignments: assignments.filter(function (a) { return a.status === 'submitted'; }).length,
      overdueAssignments: countAssignments('overdue'),
      overdueTasks: countTasks('overdue'),
      dueTodayAssignments: countAssignments('today'),
      dueTodayTasks: countTasks('today')
    };
  }

  // One friendly sentence about the current workload
  function workloadMessage(counts) {
    if (counts.totalAssignments === 0 && counts.totalTasks === 0) {
      return 'Add your first assignment or task to get started.';
    }
    var overdue = counts.overdueAssignments + counts.overdueTasks;
    var today = counts.dueTodayAssignments + counts.dueTodayTasks;

    if (overdue > 0) {
      return plural(overdue, 'overdue item') + ' to catch up on' +
        (today > 0 ? ', and ' + today + ' due today.' : '.');
    }
    if (today > 0) {
      return plural(today, 'item') + ' due today.';
    }
    if (counts.dueSoon > 0) {
      return plural(counts.dueSoon, 'assignment') + ' due in the next 7 days.';
    }
    if (counts.pendingTasks > 0) {
      return 'No deadlines close by. ' + plural(counts.pendingTasks, 'task') + ' left to do.';
    }
    return 'You are all caught up. Nice work!';
  }

  // ---------- assignment lists ----------

  // Unfinished and past due, most overdue first
  function getOverdueAssignments(assignments, now) {
    return asel.sortAssignments(asel.filterAssignments(assignments, { deadline: 'overdue' }, now), 'due');
  }

  // Unfinished, HAS a due date, not overdue: soonest first. Undated work never appears here.
  function getUpcomingAssignments(assignments, now) {
    var upcoming = assignments.filter(function (assignment) {
      var state = asel.getDeadlineInfo(assignment, now).state;
      return state === 'today' || state === 'tomorrow' || state === 'soon' || state === 'later';
    });
    return asel.sortAssignments(upcoming, 'due');
  }

  // ---------- tasks that need attention ----------

  function compareText(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  }

  // Unfinished tasks. Overdue first, then dated tasks soonest first, then tasks with no date
  // (highest priority first). Ties: priority, title, id.
  function getAttentionTasks(tasks, now) {
    function group(task) {
      var state = tsel.getDeadlineInfo(task, now).state;
      if (state === 'overdue') {
        return 0;
      }
      return task.dueDate ? 1 : 2;
    }

    return tasks.filter(function (task) {
      return !tsel.isDone(task);
    }).sort(function (a, b) {
      var byGroup = group(a) - group(b);
      if (byGroup) {
        return byGroup;
      }
      if (a.dueDate !== b.dueDate) {
        return a.dueDate < b.dueDate ? -1 : 1; // same group => both dated or both undated
      }
      var byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (byPriority) {
        return byPriority;
      }
      return compareText(a.title, b.title) || (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0));
    });
  }

  // ---------- progress ----------

  // Active = not Submitted/Completed. `average` is null when there is nothing active.
  // items: active assignments, soonest due first, each with its derived progress.
  function getProgressSummary(assignments, tasks, limit) {
    var active = assignments.filter(function (assignment) {
      return !isFinished(assignment);
    });
    var items = asel.sortAssignments(active, 'due').map(function (assignment) {
      return { assignment: assignment, progress: tsel.getAssignmentProgress(assignment, tasks) };
    });
    var sum = items.reduce(function (total, item) {
      return total + item.progress.percent;
    }, 0);

    return {
      activeCount: active.length,
      finishedCount: assignments.length - active.length,
      average: active.length === 0 ? null : Math.round(sum / active.length),
      items: typeof limit === 'number' ? items.slice(0, limit) : items
    };
  }

  // ---------- recently completed ----------

  // Real events only: every record that has a completedAt timestamp.
  // kind: 'assignment' | 'task'. Newest first.
  function getRecentlyCompleted(assignments, tasks, limit) {
    var events = [];
    assignments.forEach(function (assignment) {
      if (assignment.completedAt) {
        events.push({ kind: 'assignment', id: assignment.id, title: assignment.title,
          label: asel.statusLabel(assignment.status), at: assignment.completedAt });
      }
    });
    tasks.forEach(function (task) {
      if (task.completedAt) {
        events.push({ kind: 'task', id: task.id, title: task.title, label: 'Done', at: task.completedAt });
      }
    });
    events.sort(function (a, b) {
      if (a.at === b.at) {
        return a.id < b.id ? -1 : 1;
      }
      return a.at < b.at ? 1 : -1;
    });
    return typeof limit === 'number' ? events.slice(0, limit) : events;
  }

  window.EF.dashboardSelectors = {
    getCounts: getCounts,
    workloadMessage: workloadMessage,
    getOverdueAssignments: getOverdueAssignments,
    getUpcomingAssignments: getUpcomingAssignments,
    getAttentionTasks: getAttentionTasks,
    getProgressSummary: getProgressSummary,
    getRecentlyCompleted: getRecentlyCompleted
  };
})();