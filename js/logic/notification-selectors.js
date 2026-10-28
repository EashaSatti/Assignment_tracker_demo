/* =========================================================
   NOTIFICATION SELECTORS (pure functions)
   - A notification is NEVER stored. It is worked out from the
     assignments and tasks and the current date every time.
   - Only two small lists are saved (state.notificationState):
     which notifications were read, and which were dismissed.
   - Each assignment/task gives AT MOST ONE notification, the most
     urgent one: Overdue > Due Today > Due Tomorrow >
     High Priority Soon > Upcoming (the next 2-7 days).
   - The saved key contains the item, the kind AND the due date/time,
     so a rescheduled item, or one that moves from "Due Tomorrow"
     to "Due Today", is a NEW notification again.
   - Items with no due date, and finished items, give nothing.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;

  var KIND_RANK = { overdue: 1, today: 2, tomorrow: 3, priority: 4, upcoming: 5 };
  var KIND_LABELS = {
    overdue: 'Overdue',
    today: 'Due Today',
    tomorrow: 'Due Tomorrow',
    priority: 'High Priority Soon',
    upcoming: 'Upcoming'
  };

  // Which kind (if any) a deadline gives. info comes from getDeadlineInfo().
  function kindFor(info, priority) {
    if (info.state === 'overdue') { return 'overdue'; }
    if (info.state === 'today') { return 'today'; }
    if (info.state === 'tomorrow') { return 'tomorrow'; }
    if (info.state === 'soon') { return priority === 'high' ? 'priority' : 'upcoming'; }
    return null; // none, finished, later
  }

  function makeKey(type, item, kind) {
    return type.charAt(0) + '|' + item.id + '|' + kind + '|' + item.dueDate + (item.dueTime ? ' ' + item.dueTime : '');
  }

  function compareText(a, b) {
    var left = String(a).toLowerCase();
    var right = String(b).toLowerCase();
    if (left < right) { return -1; }
    return left > right ? 1 : 0;
  }

  function compare(a, b) {
    if (a.rank !== b.rank) { return a.rank - b.rank; }
    if (a.dueDate !== b.dueDate) { return a.dueDate < b.dueDate ? -1 : 1; }
    var aTime = a.dueTime || '99:99';
    var bTime = b.dueTime || '99:99';
    if (aTime !== bTime) { return aTime < bTime ? -1 : 1; }
    return compareText(a.title, b.title) || compareText(a.key, b.key);
  }

  // Every current notification, including dismissed ones (they carry dismissed: true).
  function build(state, now) {
    var flags = state.notificationState || { read: {}, dismissed: {} };
    var assignmentsById = tsel.mapById(state.assignments);
    var list = [];

    function add(type, item, courseId, info) {
      var kind = kindFor(info, item.priority);
      if (!kind) {
        return;
      }
      var key = makeKey(type, item, kind);
      list.push({
        key: key,
        type: type,
        id: item.id,
        kind: kind,
        rank: KIND_RANK[kind],
        title: item.title,
        courseId: courseId || null,
        dueDate: item.dueDate,
        dueTime: item.dueTime || '',
        priority: item.priority,
        text: info.label,
        read: Object.prototype.hasOwnProperty.call(flags.read, key),
        dismissed: Object.prototype.hasOwnProperty.call(flags.dismissed, key)
      });
    }

    state.assignments.forEach(function (assignment) {
      add('assignment', assignment, assignment.courseId, asel.getDeadlineInfo(assignment, now));
    });
    state.tasks.forEach(function (task) {
      add('task', task, tsel.effectiveCourseId(task, assignmentsById), tsel.getDeadlineInfo(task, now));
    });

    return list.sort(compare);
  }

  function active(list) {
    return list.filter(function (entry) { return !entry.dismissed; });
  }

  function unreadCount(list) {
    return list.filter(function (entry) { return !entry.dismissed && !entry.read; }).length;
  }

  function dismissedCount(list) {
    return list.filter(function (entry) { return entry.dismissed; }).length;
  }

  // ---------- new saved flags (the caller saves them with EF.store.updateNotificationState) ----------
  // Keys of notifications that no longer exist are dropped, so the saved lists cannot grow forever.

  function keepCurrent(map, list) {
    var result = {};
    list.forEach(function (entry) {
      if (Object.prototype.hasOwnProperty.call(map, entry.key)) {
        result[entry.key] = map[entry.key];
      }
    });
    return result;
  }

  function nextFlags(state, list, keys, action, nowText) {
    var flags = state.notificationState || { read: {}, dismissed: {} };
    var read = keepCurrent(flags.read, list);
    var dismissed = keepCurrent(flags.dismissed, list);
    var wanted = {};
    keys.forEach(function (key) { wanted[key] = true; });

    list.forEach(function (entry) {
      if (!wanted[entry.key]) {
        return;
      }
      if (action === 'read' || action === 'dismiss') {
        read[entry.key] = read[entry.key] || nowText;
      }
      if (action === 'dismiss') {
        dismissed[entry.key] = nowText;
      }
      if (action === 'restore') {
        delete dismissed[entry.key];
      }
    });
    return { read: read, dismissed: dismissed };
  }

  EF.notificationSelectors = {
    KIND_LABELS: KIND_LABELS,
    build: build,
    active: active,
    unreadCount: unreadCount,
    dismissedCount: dismissedCount,
    nextFlags: nextFlags
  };
})();