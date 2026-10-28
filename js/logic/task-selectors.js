/* =========================================================
   TASK SELECTORS
   Pure helper functions about tasks, and about the PROGRESS
   of an assignment (which is worked out from its tasks).

   "Pure" means they only LOOK at the data you hand them and
   return an answer. They never change the store, never touch
   the page and never read localStorage.

   Progress is DERIVED, never stored:
     - Submitted / Completed assignment  -> 100%
     - has linked tasks                  -> done tasks / all tasks
     - no tasks, Not Started             -> 0%
     - no tasks, otherwise               -> the saved manualProgress

   A task linked to an assignment has no course of its own.
   Its course is always its assignment's course ("effective course").

   Loads after assignment-selectors.js, which it reuses for dates,
   deadlines and the search/filter rules.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var schema = EF.schema;

  var STATUS_LABELS = { todo: 'To Do', done: 'Done' };
  var PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

  var SORT_OPTIONS = [
    { value: 'due', label: 'Due date (soonest first)' },
    { value: 'priority', label: 'Priority (high first)' },
    { value: 'added', label: 'Recently added' },
    { value: 'title', label: 'Title (A to Z)' }
  ];

  var DEFAULT_FILTERS = { query: '', status: 'all', courseId: 'all', assignmentId: 'all', priority: 'all', deadline: 'all' };

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function isDone(task) {
    return schema.isTaskFinished(task.status);
  }

  // ---------- course and assignment lookups ----------

  function mapById(list) {
    var map = Object.create(null);
    list.forEach(function (item) {
      map[item.id] = item;
    });
    return map;
  }

  // The course a task belongs to: its assignment's course, or its own when it has no assignment.
  function effectiveCourseId(task, assignmentsById) {
    if (task.assignmentId !== null) {
      var assignment = assignmentsById[task.assignmentId];
      return assignment ? assignment.courseId : null;
    }
    return task.courseId;
  }

  function tasksOfAssignment(assignmentId, tasks) {
    return tasks.filter(function (task) {
      return task.assignmentId === assignmentId;
    });
  }

  // ---------- progress ----------

  // Returns { percent (0-100), done, total, source: 'status' | 'tasks' | 'manual' | 'none' }
  function getAssignmentProgress(assignment, tasks) {
    var linked = tasksOfAssignment(assignment.id, tasks);
    var done = linked.filter(isDone).length;
    var total = linked.length;

    if (schema.isAssignmentFinished(assignment.status)) {
      return { percent: 100, done: done, total: total, source: 'status' };
    }
    if (total > 0) {
      return { percent: Math.round((done / total) * 100), done: done, total: total, source: 'tasks' };
    }
    if (assignment.status === 'not_started') {
      return { percent: 0, done: 0, total: 0, source: 'none' };
    }
    return { percent: assignment.manualProgress, done: 0, total: 0, source: 'manual' };
  }

  // ---------- deadlines (reuses the assignment rules) ----------

  // A task has a due DATE only, and it is "finished" once Done.
  function asAssignmentLike(task, assignmentsById) {
    return {
      title: task.title,
      courseId: effectiveCourseId(task, assignmentsById),
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: '',
      status: isDone(task) ? 'completed' : 'not_started'
    };
  }

  function getDeadlineInfo(task, now) {
    return asel.getDeadlineInfo(asAssignmentLike(task, {}), now);
  }

  // ---------- search and filters ----------

  // filters: { query, status ('all'|'todo'|'done'), courseId ('all'|'none'|id) [effective course],
  //            assignmentId ('all'|'none'|id), priority, deadline }
  // Search, course, priority and deadline use the SAME rules as the Assignments screen.
  function filterTasks(list, filters, assignments, now) {
    var f = Object.assign({}, DEFAULT_FILTERS, filters || {});
    var byId = mapById(assignments);
    var shared = { query: f.query, courseId: f.courseId, priority: f.priority, deadline: f.deadline };

    return list.filter(function (task) {
      if (f.status !== 'all' && task.status !== f.status) {
        return false;
      }
      if (f.assignmentId !== 'all') {
        var wanted = f.assignmentId === 'none' ? null : f.assignmentId;
        if (task.assignmentId !== wanted) {
          return false;
        }
      }
      return asel.filterAssignments([asAssignmentLike(task, byId)], shared, now).length === 1;
    });
  }

  function hasActiveFilters(filters) {
    var f = Object.assign({}, DEFAULT_FILTERS, filters || {});
    return String(f.query).trim() !== '' || f.status !== 'all' || f.courseId !== 'all' ||
      f.assignmentId !== 'all' || f.priority !== 'all' || f.deadline !== 'all';
  }

  // ---------- sorting ----------

  function compareTitle(a, b) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }

  // Open tasks before finished ones
  function compareOpenFirst(a, b) {
    return (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0);
  }

  // Sooner first; no due date last
  function compareDue(a, b) {
    if (a.dueDate === b.dueDate) {
      return 0;
    }
    if (a.dueDate === '') {
      return 1;
    }
    if (b.dueDate === '') {
      return -1;
    }
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  function comparePriority(a, b) {
    return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  }

  function compareNewest(a, b) {
    if (a.createdAt === b.createdAt) {
      return 0;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  }

  function compareId(a, b) {
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }

  function chain() {
    var comparers = arguments;
    return function (a, b) {
      for (var i = 0; i < comparers.length; i += 1) {
        var result = comparers[i](a, b);
        if (result) {
          return result;
        }
      }
      return 0;
    };
  }

  var COMPARERS = {
    due: chain(compareOpenFirst, compareDue, comparePriority, compareTitle, compareId),
    priority: chain(compareOpenFirst, comparePriority, compareDue, compareTitle, compareId),
    added: chain(compareNewest, compareTitle, compareId),
    title: chain(compareTitle, compareDue, compareId)
  };

  // Returns a NEW sorted array; the input is not changed.
  function sortTasks(list, key) {
    return list.slice().sort(COMPARERS[key] || COMPARERS.due);
  }

  window.EF.taskSelectors = {
    STATUS_LABELS: STATUS_LABELS,
    SORT_OPTIONS: SORT_OPTIONS,
    DEFAULT_FILTERS: DEFAULT_FILTERS,
    statusLabel: statusLabel,
    isDone: isDone,

    mapById: mapById,
    effectiveCourseId: effectiveCourseId,
    tasksOfAssignment: tasksOfAssignment,
    getAssignmentProgress: getAssignmentProgress,
    getDeadlineInfo: getDeadlineInfo,

    filterTasks: filterTasks,
    hasActiveFilters: hasActiveFilters,
    sortTasks: sortTasks
  };
})();