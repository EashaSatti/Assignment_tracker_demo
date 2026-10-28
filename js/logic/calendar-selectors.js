/* =========================================================
   CALENDAR SELECTORS (pure functions - nothing is stored)
   - Dates are plain local "YYYY-MM-DD" text. We never turn them
     into a Date at "midnight local" and back, so nothing can
     slip to the previous or next day.
   - Date.UTC is used ONLY as a whole-day calculator
     (a UTC day is always exactly 24 hours, so daylight-saving
     changes cannot move a date).
   - Items with no due date, or an invalid one, never appear.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var PRIORITY_RANK = { low: 1, medium: 2, high: 3 };
  var DAY_MS = 86400000;
  var MIN_YEAR = 1000;
  var MAX_YEAR = 9999;

  // ---------- plain date helpers ----------

  function pad(number, width) {
    var text = String(number);
    while (text.length < width) {
      text = '0' + text;
    }
    return text;
  }

  function toKey(year, month, day) {
    return pad(year, 4) + '-' + pad(month, 2) + '-' + pad(day, 2);
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInMonth(year, month) {
    if (month === 2) {
      return isLeapYear(year) ? 29 : 28;
    }
    return [4, 6, 9, 11].indexOf(month) !== -1 ? 30 : 31;
  }

  // "2028-02-29" -> { year, month, day }. Anything else (including 2027-02-29) -> null.
  function parseKey(text) {
    if (typeof text !== 'string') {
      return null;
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) {
      return null;
    }
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      return null;
    }
    return { year: year, month: month, day: day };
  }

  // 0 = Sunday ... 6 = Saturday
  function weekdayOf(key) {
    var parts = parseKey(key);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  }

  // Adds whole days to a date text. Returns null when the result leaves the supported years.
  function addDays(key, amount) {
    var parts = parseKey(key);
    if (!parts) {
      return null;
    }
    var moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
    var year = moved.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) {
      return null;
    }
    return toKey(year, moved.getUTCMonth() + 1, moved.getUTCDate());
  }

  // Same day number in the next/previous month; 31 Jan -> 28/29 Feb. Null when out of range.
  function shiftMonthKey(key, delta) {
    var parts = parseKey(key);
    if (!parts) {
      return null;
    }
    var index = parts.year * 12 + (parts.month - 1) + delta;
    var year = Math.floor(index / 12);
    var month = (index % 12) + 1;
    if (year < MIN_YEAR || year > MAX_YEAR) {
      return null;
    }
    return toKey(year, month, Math.min(parts.day, daysInMonth(year, month)));
  }

  function startIndex(weekStart) {
    return weekStart === 'sunday' ? 0 : 1;
  }

  // 0 = first column of the week, 6 = last column
  function weekPosition(key, weekStart) {
    return (weekdayOf(key) - startIndex(weekStart) + 7) % 7;
  }

  function monthTitle(key) {
    var parts = parseKey(key);
    return MONTHS[parts.month - 1] + ' ' + parts.year;
  }

  function formatLongDate(key) {
    var parts = parseKey(key);
    return WEEKDAYS[weekdayOf(key)] + ', ' + parts.day + ' ' + MONTHS[parts.month - 1] + ' ' + parts.year;
  }

  function weekdayLabels(weekStart) {
    var labels = [];
    for (var i = 0; i < 7; i++) {
      var name = WEEKDAYS[(startIndex(weekStart) + i) % 7];
      labels.push({ short: name.slice(0, 3), long: name });
    }
    return labels;
  }

  // The visible month as whole weeks: [{ date, day, inMonth }, ...] (a multiple of 7 cells)
  function getMonthGrid(key, weekStart) {
    var parts = parseKey(key);
    var first = toKey(parts.year, parts.month, 1);
    var offset = weekPosition(first, weekStart);
    var weeks = Math.ceil((offset + daysInMonth(parts.year, parts.month)) / 7);
    var base = Date.UTC(parts.year, parts.month - 1, 1 - offset);
    var cells = [];
    for (var i = 0; i < weeks * 7; i++) {
      var moved = new Date(base + i * DAY_MS);
      cells.push({
        date: toKey(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate()),
        day: moved.getUTCDate(),
        inMonth: moved.getUTCMonth() === parts.month - 1 && moved.getUTCFullYear() === parts.year
      });
    }
    return cells;
  }

  // ---------- events (derived from the store every time) ----------

  function compareText(a, b) {
    var left = String(a).toLowerCase();
    var right = String(b).toLowerCase();
    if (left < right) { return -1; }
    return left > right ? 1 : 0;
  }

  function compareAssignments(a, b) {
    var aDone = a.status === 'submitted' || a.status === 'completed';
    var bDone = b.status === 'submitted' || b.status === 'completed';
    if (aDone !== bDone) { return aDone ? 1 : -1; }
    var aTime = a.dueTime || '99:99';
    var bTime = b.dueTime || '99:99';
    if (aTime !== bTime) { return aTime < bTime ? -1 : 1; }
    var byPriority = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (byPriority) { return byPriority; }
    return compareText(a.title, b.title) || compareText(a.id, b.id);
  }

  function compareTasks(a, b) {
    var aDone = tsel.isDone(a);
    var bDone = tsel.isDone(b);
    if (aDone !== bDone) { return aDone ? 1 : -1; }
    var byPriority = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (byPriority) { return byPriority; }
    return compareText(a.title, b.title) || compareText(a.id, b.id);
  }

  // { 'YYYY-MM-DD': { assignments: [...], tasks: [...] } } - only dates that have something.
  function buildEventIndex(state) {
    var index = Object.create(null);

    function bucket(date) {
      if (!index[date]) {
        index[date] = { assignments: [], tasks: [] };
      }
      return index[date];
    }

    state.assignments.forEach(function (assignment) {
      if (parseKey(assignment.dueDate)) {
        bucket(assignment.dueDate).assignments.push(assignment);
      }
    });
    state.tasks.forEach(function (task) {
      if (parseKey(task.dueDate)) {
        bucket(task.dueDate).tasks.push(task);
      }
    });
    Object.keys(index).forEach(function (date) {
      index[date].assignments.sort(compareAssignments);
      index[date].tasks.sort(compareTasks);
    });
    return index;
  }

  // Small numbers for the dots on a calendar cell
  function summarizeDay(entry, now) {
    var summary = { assignments: 0, tasks: 0, overdue: 0 };
    if (!entry) {
      return summary;
    }
    summary.assignments = entry.assignments.length;
    summary.tasks = entry.tasks.length;
    entry.assignments.forEach(function (assignment) {
      if (asel.getDeadlineInfo(assignment, now).state === 'overdue') {
        summary.overdue++;
      }
    });
    entry.tasks.forEach(function (task) {
      if (tsel.getDeadlineInfo(task, now).state === 'overdue') {
        summary.overdue++;
      }
    });
    return summary;
  }

  EF.calendarSelectors = {
    parseKey: parseKey,
    isLeapYear: isLeapYear,
    daysInMonth: daysInMonth,
    weekdayOf: weekdayOf,
    addDays: addDays,
    shiftMonthKey: shiftMonthKey,
    weekPosition: weekPosition,
    monthTitle: monthTitle,
    formatLongDate: formatLongDate,
    weekdayLabels: weekdayLabels,
    getMonthGrid: getMonthGrid,
    buildEventIndex: buildEventIndex,
    summarizeDay: summarizeDay
  };
})();