/* =========================================================
   SAMPLE DATA (pure functions - nothing here touches the page or the store)

   Builds example courses, assignments and tasks so a new user can explore.
   - The caller adds them ONLY after the user clicks "Load sample data"
     and confirms.
   - Sample records are ordinary records. They are recognisable by name:
     courses start with "Sample \u2013 " and assignments with "Sample: ".
   - EVERY sample assignment and task belongs to a sample course, so
     deleting the three sample courses (choosing "delete their items")
     removes all of the sample data and nothing else.
   - Dates are worked out from today's LOCAL date as plain
     "YYYY-MM-DD" text (EF.calendarSelectors.addDays), so they never
     shift because of time zones.
   - addTo() returns a NEW state: the user's own records are copied
     unchanged and only appended to.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var asel = EF.assignmentSelectors;
  var csel = EF.calendarSelectors;

  var COURSE_PREFIX = 'Sample \u2013 ';
  var ASSIGNMENT_PREFIX = 'Sample: ';
  var DAY_MS = 86400000;

  // Already in the planner? (also used to stop a second load)
  function isLoaded(state) {
    return state.courses.some(function (course) { return course.name.indexOf(COURSE_PREFIX) === 0; }) ||
      state.assignments.some(function (assignment) { return assignment.title.indexOf(ASSIGNMENT_PREFIX) === 0; });
  }

  // d = days from today (negative = in the past)
  function definitions(today) {
    function day(d) { return csel.addDays(today, d); }

    var courses = [
      { key: 'bio', name: COURSE_PREFIX + 'Biology 101', instructor: 'Dr. Rivera', room: 'Science 204', color: '#2F7D5B' },
      { key: 'lit', name: COURSE_PREFIX + 'English Literature', instructor: 'Prof. Chen', room: 'Humanities 12', color: '#8A4FB0' },
      { key: 'cal', name: COURSE_PREFIX + 'Calculus II', instructor: 'Dr. Okafor', room: 'Math 310', color: '#3B63C9' }
    ];

    var assignments = [
      { key: 'lab', course: 'bio', title: 'Lab Report \u2013 Cell Division', due: day(-2), time: '', priority: 'high', status: 'in_progress', minutes: 180,
        description: 'Write up the microscope lab: observations, diagrams and a short discussion.' },
      { key: 'essay', course: 'lit', title: 'Essay \u2013 Themes in Hamlet', due: day(0), time: '17:00', priority: 'high', status: 'in_progress', minutes: 240,
        description: '1,500 words on one major theme, with at least three quotations.' },
      { key: 'pset', course: 'cal', title: 'Problem Set 6', due: day(1), time: '', priority: 'medium', status: 'not_started', minutes: 90,
        description: 'Integration techniques, questions 1\u201310.' },
      { key: 'reading', course: 'lit', title: 'Reading Response', due: day(3), time: '', priority: 'low', status: 'not_started', minutes: 45,
        description: 'A short reflection on this week\u2019s chapters.' },
      { key: 'present', course: 'bio', title: 'Group Presentation', due: day(6), time: '09:30', priority: 'medium', status: 'in_progress', minutes: 120,
        description: 'Ten-minute talk on ecosystems with your group.' },
      { key: 'study', course: 'cal', title: 'Midterm Study Plan', due: day(12), time: '', priority: 'high', status: 'not_started', minutes: 300,
        description: 'Prepare for the midterm exam.' },
      { key: 'quiz', course: 'bio', title: 'Quiz 3 Corrections', due: day(-5), time: '', priority: 'low', status: 'submitted', minutes: 30, doneAgo: 4,
        description: 'Corrected answers handed in.' },
      { key: 'poetry', course: 'lit', title: 'Poetry Analysis', due: day(-8), time: '', priority: 'medium', status: 'completed', minutes: 120, doneAgo: 7,
        description: 'Analysis of two poems. Marked and returned.' },
      { key: 'extra', course: 'cal', title: 'Extra Credit Idea', due: '', time: '', priority: 'low', status: 'not_started', minutes: null,
        description: 'An assignment with no due date. It never shows on the Calendar.' }
    ];

    // assignment: linked task (takes the assignment's course). course: standalone task.
    var tasks = [
      { assignment: 'lab', title: 'Collect microscope observations', due: day(-4), priority: 'medium', done: true, doneAgo: 4 },
      { assignment: 'lab', title: 'Draw and label the diagrams', due: day(-3), priority: 'medium', done: true, doneAgo: 3 },
      { assignment: 'lab', title: 'Write the discussion section', due: day(-1), priority: 'high', done: false },
      { assignment: 'essay', title: 'Choose a thesis statement', due: day(-1), priority: 'medium', done: true, doneAgo: 2 },
      { assignment: 'essay', title: 'Outline three main arguments', due: day(0), priority: 'medium', done: false },
      { assignment: 'essay', title: 'Write the first draft', due: day(0), priority: 'high', done: false },
      { assignment: 'essay', title: 'Proofread and check quotations', due: day(0), priority: 'medium', done: false },
      { assignment: 'pset', title: 'Attempt questions 1\u20135', due: day(0), priority: 'medium', done: false },
      { assignment: 'pset', title: 'Attempt questions 6\u201310', due: day(1), priority: 'medium', done: false },
      { assignment: 'present', title: 'Make the slides', due: day(2), priority: 'medium', done: true, doneAgo: 1 },
      { assignment: 'present', title: 'Rehearse with the group', due: day(4), priority: 'medium', done: false },
      { assignment: 'present', title: 'Print the handout', due: day(5), priority: 'low', done: false },
      { assignment: 'study', title: 'List the topics to review', due: day(7), priority: 'medium', done: false },
      { assignment: 'study', title: 'Work through a past paper', due: day(10), priority: 'high', done: false },
      { assignment: 'study', title: 'Make a one-page summary', due: day(11), priority: 'low', done: false },
      { course: 'cal', title: 'Review lecture notes', due: day(2), priority: 'medium', done: false },
      { course: 'bio', title: 'Buy a lab notebook', due: day(0), priority: 'low', done: false },
      { course: 'cal', title: 'Email Dr. Okafor about office hours', due: day(-1), priority: 'medium', done: false },
      { course: 'lit', title: 'Print the syllabus', due: '', priority: 'low', done: true, doneAgo: 3 }
    ];

    return { courses: courses, assignments: assignments, tasks: tasks };
  }

  // Returns { state, counts } - a NEW state with the samples appended
  function addTo(state, now) {
    var def = definitions(asel.todayString(now));

    function stamp(daysAgo) {
      return new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
    }

    var courseIds = {};
    var assignmentIds = {};

    var courses = def.courses.map(function (item) {
      var id = EF.utils.generateId('c');
      courseIds[item.key] = id;
      return {
        id: id, name: item.name, instructor: item.instructor, color: item.color, room: item.room,
        notes: 'Sample course added by "Load sample data".', archived: false,
        createdAt: stamp(14), updatedAt: stamp(14)
      };
    });

    var assignments = def.assignments.map(function (item) {
      var id = EF.utils.generateId('a');
      assignmentIds[item.key] = id;
      var finished = item.status === 'submitted' || item.status === 'completed';
      return {
        id: id, title: ASSIGNMENT_PREFIX + item.title, courseId: courseIds[item.course], description: item.description,
        dueDate: item.due, dueTime: item.time, priority: item.priority, status: item.status, manualProgress: 0,
        estimatedMinutes: item.minutes, notes: 'Sample assignment.',
        createdAt: stamp(14), updatedAt: finished ? stamp(item.doneAgo) : stamp(1), completedAt: finished ? stamp(item.doneAgo) : null
      };
    });

    var tasks = def.tasks.map(function (item) {
      var linked = item.assignment !== undefined;
      return {
        id: EF.utils.generateId('t'), title: item.title,
        courseId: linked ? null : courseIds[item.course], assignmentId: linked ? assignmentIds[item.assignment] : null,
        dueDate: item.due, priority: item.priority, status: item.done ? 'done' : 'todo', estimatedMinutes: null, notes: 'Sample task.',
        createdAt: stamp(14), updatedAt: item.done ? stamp(item.doneAgo) : stamp(1), completedAt: item.done ? stamp(item.doneAgo) : null
      };
    });

    var next = Object.assign({}, state, {
      courses: state.courses.concat(courses),
      assignments: state.assignments.concat(assignments),
      tasks: state.tasks.concat(tasks)
    });
    return { state: next, counts: { courses: courses.length, assignments: assignments.length, tasks: tasks.length } };
  }

  // Numbers for the confirmation text (no ids are created)
  function describe() {
    var def = definitions('2000-01-01');
    return { courses: def.courses.length, assignments: def.assignments.length, tasks: def.tasks.length };
  }

  EF.sampleData = { isLoaded: isLoaded, addTo: addTo, describe: describe };
})();