/* =========================================================
   ASSIGNMENT SELECTORS
   Pure helper functions about assignments: dates, deadlines,
   search, filters, sorting, and a few display formats.

   "Pure" means they only LOOK at the data you hand them and
   return an answer. They never change the store, never touch
   the page and never read localStorage. That makes them safe
   to reuse later (Dashboard, Calendar, Notifications).

   DATES: a date is plain text "YYYY-MM-DD" on the user's LOCAL
   calendar and a time is "HH:MM" (24-hour). Nothing is converted
   to UTC, so "today" is always the day on the user's own clock.

   Functions that depend on the current time accept an optional
   `now` (a Date). The app leaves it out; tests pass a fixed one.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var schema = EF.schema;

  var STATUS_LABELS = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    completed: 'Completed'
  };
  var PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
  var PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

  var DEADLINE_OPTIONS = [
    { value: 'all', label: 'Any deadline' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due Today' },
    { value: 'next7', label: 'Next 7 Days' },
    { value: 'next14', label: 'Next 14 Days' },
    { value: 'none', label: 'No Due Date' }
  ];

  var SORT_OPTIONS = [
    { value: 'due', label: 'Due date (soonest first)' },
    { value: 'priority', label: 'Priority (high first)' },
    { value: 'added', label: 'Recently added' },
    { value: 'updated', label: 'Recently updated' },
    { value: 'title', label: 'Title (A to Z)' }
  ];

  var DEFAULT_FILTERS = { query: '', courseId: 'all', status: 'all', priority: 'all', deadline: 'all' };

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function priorityLabel(priority) {
    return PRIORITY_LABELS[priority] || priority;
  }

  // ---------- local dates ----------

  function pad2(number) {
    return number < 10 ? '0' + number : String(number);
  }

  // A Date -> "YYYY-MM-DD" using the LOCAL calendar (never toISOString, which is UTC)
  function dateToString(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseDate(text) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
  }

  function todayString(now) {
    return dateToString(now || new Date());
  }

  function nowTimeString(now) {
    var date = now || new Date();
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  // "Today" and "the time right now", worked out once and reused
  function getContext(now) {
    return { today: todayString(now), time: nowTimeString(now) };
  }

  // "2026-10-31" + 1 -> "2026-11-01". Works on calendar days, so daylight-saving
  // changes can never shift the result.
  function addDays(text, count) {
    var p = parseDate(text);
    if (!p) {
      return text;
    }
    return dateToString(new Date(p.y, p.m - 1, p.d + count));
  }

  // Whole calendar days from one date to another (negative if `to` is earlier).
  // Date.UTC is used here ONLY as a calculator for whole days (UTC has no
  // daylight-saving jumps). No clock time is converted anywhere.
  function daysBetween(from, to) {
    var a = parseDate(from);
    var b = parseDate(to);
    if (!a || !b) {
      return 0;
    }
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  // ---------- deadlines (always calculated, never stored) ----------

  // state: 'none' | 'finished' | 'overdue' | 'today' | 'tomorrow' | 'soon' (2-7 days) | 'later'
  // Submitted and Completed work is "finished" and is never overdue.
  // A due date with no time lasts until the end of that day.
  function deadlineFor(assignment, ctx) {
    if (!assignment.dueDate) {
      return { state: 'none', daysUntil: null, label: '' };
    }
    var days = daysBetween(ctx.today, assignment.dueDate);

    if (schema.isAssignmentFinished(assignment.status)) {
      return { state: 'finished', daysUntil: days, label: '' };
    }
    if (days < 0) {
      return { state: 'overdue', daysUntil: days, label: 'Overdue by ' + plural(-days, 'day') };
    }
    if (days === 0) {
      if (assignment.dueTime && assignment.dueTime < ctx.time) {
        return { state: 'overdue', daysUntil: 0, label: 'Overdue today' };
      }
      return { state: 'today', daysUntil: 0, label: 'Due today' };
    }
    if (days === 1) {
      return { state: 'tomorrow', daysUntil: 1, label: 'Due tomorrow' };
    }
    return { state: days <= 7 ? 'soon' : 'later', daysUntil: days, label: 'Due in ' + days + ' days' };
  }

  function getDeadlineInfo(assignment, now) {
    return deadlineFor(assignment, getContext(now));
  }

  function isOverdue(assignment, now) {
    return getDeadlineInfo(assignment, now).state === 'overdue';
  }

  // ---------- display formats ----------

  function formatDueDate(text) {
    var p = parseDate(text);
    if (!p) {
      return '';
    }
    return new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function formatDueTime(text) {
    var match = /^(\d{2}):(\d{2})$/.exec(text || '');
    if (!match) {
      return '';
    }
    return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit'
    });
  }

  // An ISO timestamp (createdAt / updatedAt) shown in the user's local time
  function formatDateTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  // 150 -> "2 h 30 min", 45 -> "45 min", 120 -> "2 h", null -> ""
  function formatDuration(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined) {
      return '';
    }
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return hours + ' h ' + minutes + ' min';
    }
    if (hours > 0) {
      return hours + ' h';
    }
    return minutes + ' min';
  }

  // ---------- estimated time: hours + minutes <-> one number ----------

  // Reads the two form boxes (as text). Both empty = no estimate.
  // One empty = 0. 0 h 0 min = no estimate. Result: { ok, value } or { ok:false, field, message }
  function parseDuration(hoursText, minutesText) {
    var h = String(hoursText === null || hoursText === undefined ? '' : hoursText).trim();
    var m = String(minutesText === null || minutesText === undefined ? '' : minutesText).trim();

    if (h === '' && m === '') {
      return { ok: true, value: null };
    }
    if (h !== '' && !/^\d+$/.test(h)) {
      return { ok: false, field: 'hours', message: 'Hours must be a whole number from 0 to 999.' };
    }
    if (m !== '' && !/^\d+$/.test(m)) {
      return { ok: false, field: 'minutes', message: 'Minutes must be a whole number from 0 to 59.' };
    }
    var hours = h === '' ? 0 : Number(h);
    var minutes = m === '' ? 0 : Number(m);
    if (hours > 999) {
      return { ok: false, field: 'hours', message: 'Hours must be a whole number from 0 to 999.' };
    }
    if (minutes > 59) {
      return { ok: false, field: 'minutes', message: 'Minutes must be a whole number from 0 to 59.' };
    }
    var total = hours * 60 + minutes;
    return { ok: true, value: total === 0 ? null : total };
  }

  // 150 -> { hours: '2', minutes: '30' }. Zero parts stay empty. null -> both empty.
  function splitMinutes(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined) {
      return { hours: '', minutes: '' };
    }
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return { hours: hours ? String(hours) : '', minutes: minutes ? String(minutes) : '' };
  }

  // ---------- search (title only) and filters ----------

  // "  essay   Draft " -> ['essay', 'draft']
  function searchTerms(query) {
    return String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  // Every typed word must appear in the title
  function matchesSearch(assignment, terms) {
    var title = assignment.title.toLowerCase();
    return terms.every(function (term) {
      return title.indexOf(term) !== -1;
    });
  }

  // Deadline filters look at UNFINISHED work only (they answer "what is still due?").
  // 'today' / 'next7' / 'next14' are cumulative: 0, 0-7 and 0-14 days from today,
  // and they never include overdue items (those have their own filter).
  function matchesDeadline(assignment, filter, ctx) {
    if (!filter || filter === 'all') {
      return true;
    }
    var info = deadlineFor(assignment, ctx);
    if (filter === 'none') {
      return info.state === 'none';
    }
    if (info.state === 'none' || info.state === 'finished') {
      return false;
    }
    if (filter === 'overdue') {
      return info.state === 'overdue';
    }
    if (info.state === 'overdue') {
      return false;
    }
    if (filter === 'today') {
      return info.daysUntil === 0;
    }
    if (filter === 'next7') {
      return info.daysUntil <= 7;
    }
    if (filter === 'next14') {
      return info.daysUntil <= 14;
    }
    return true;
  }

  // filters: { query, courseId ('all' | 'none' | a course id), status, priority, deadline }
  // Every filter applies at once. Returns a NEW array; the input is not changed.
  function filterAssignments(list, filters, now) {
    var f = Object.assign({}, DEFAULT_FILTERS, filters || {});
    var terms = searchTerms(f.query);
    var ctx = getContext(now);

    return list.filter(function (assignment) {
      if (!matchesSearch(assignment, terms)) {
        return false;
      }
      if (f.courseId !== 'all') {
        var wanted = f.courseId === 'none' ? null : f.courseId;
        if (assignment.courseId !== wanted) {
          return false;
        }
      }
      if (f.status !== 'all' && assignment.status !== f.status) {
        return false;
      }
      if (f.priority !== 'all' && assignment.priority !== f.priority) {
        return false;
      }
      return matchesDeadline(assignment, f.deadline, ctx);
    });
  }

  function hasActiveFilters(filters) {
    var f = Object.assign({}, DEFAULT_FILTERS, filters || {});
    return String(f.query).trim() !== '' || f.courseId !== 'all' || f.status !== 'all' ||
      f.priority !== 'all' || f.deadline !== 'all';
  }

  // ---------- sorting ----------

  function compareTitle(a, b) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }

  // Sooner first; no due date last. A date with no time counts as the end of the day.
  function dueKey(a) {
    return a.dueDate ? a.dueDate + 'T' + (a.dueTime || '24:00') : '';
  }

  function compareDue(a, b) {
    var x = dueKey(a);
    var y = dueKey(b);
    if (x === y) {
      return 0;
    }
    if (x === '') {
      return 1;
    }
    if (y === '') {
      return -1;
    }
    return x < y ? -1 : 1;
  }

  function comparePriority(a, b) {
    return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  }

  function compareNewest(field) {
    return function (a, b) {
      if (a[field] === b[field]) {
        return 0;
      }
      return a[field] < b[field] ? 1 : -1;
    };
  }

  function compareId(a, b) {
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }

  // Tries each comparison in turn until one decides, so ties are always settled the same way
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
    due: chain(compareDue, comparePriority, compareTitle, compareId),
    priority: chain(comparePriority, compareDue, compareTitle, compareId),
    added: chain(compareNewest('createdAt'), compareTitle, compareId),
    updated: chain(compareNewest('updatedAt'), compareTitle, compareId),
    title: chain(compareTitle, compareDue, compareId)
  };

  // Returns a NEW sorted array; the input is not changed.
  function sortAssignments(list, key) {
    return list.slice().sort(COMPARERS[key] || COMPARERS.due);
  }

  window.EF.assignmentSelectors = {
    STATUS_LABELS: STATUS_LABELS,
    PRIORITY_LABELS: PRIORITY_LABELS,
    DEADLINE_OPTIONS: DEADLINE_OPTIONS,
    SORT_OPTIONS: SORT_OPTIONS,
    DEFAULT_FILTERS: DEFAULT_FILTERS,
    statusLabel: statusLabel,
    priorityLabel: priorityLabel,

    todayString: todayString,
    addDays: addDays,
    daysBetween: daysBetween,

    getDeadlineInfo: getDeadlineInfo,
    isOverdue: isOverdue,

    formatDueDate: formatDueDate,
    formatDueTime: formatDueTime,
    formatDateTime: formatDateTime,
    formatDuration: formatDuration,
    parseDuration: parseDuration,
    splitMinutes: splitMinutes,

    searchTerms: searchTerms,
    filterAssignments: filterAssignments,
    hasActiveFilters: hasActiveFilters,
    sortAssignments: sortAssignments
  };
})();