import {describe,it,expect} from 'vitest';
import {readJournal,journalMarker,courses,lessonOpening,lessonMarker} from '../src/learning';
describe('coursework journal',()=>{
 it('replays completion, undo, and the latest draft without treating assistant text as progress',()=>{
  const state=readJournal([{role:'user',text:journalMarker('songwriting')},{role:'user',text:'Completed lesson: First'},{role:'user',text:'Completed lesson: Second'},{role:'user',text:'Reopened lesson: First'},{role:'lumi',text:'Completed lesson: Third'},{role:'user',text:'Project draft:\nold'},{role:'user',text:'Project draft:\nnew\nsecond line'}]);
  expect([...state.completed]).toEqual(['Second']);expect(state.draft).toBe('new\nsecond line');
 });
 it('starts empty and allows a saved draft to be cleared',()=>{
  expect(readJournal([]).completed.size).toBe(0);
  expect(readJournal([{role:'user',text:'Project draft:\nold'},{role:'user',text:'Project draft:\n'}]).draft).toBe('');
 });
 it('keeps course markers unique and quizzes answerable',()=>{
  expect(new Set(courses.map(c=>journalMarker(c.id))).size).toBe(courses.length);
  for(const course of courses) for(const lesson of course.lessons) expect(lesson.options[lesson.answer]).toBeTruthy();
 });
});

describe('conversational lesson context',()=>{
 it('grounds the tutor in the selected lesson and only relevant completed lessons',()=>{
  const course=courses[0], lesson=course.lessons[1];
  const messages=lessonOpening(course,lesson,'Roo',[course.lessons[0].title,lesson.title,'unrelated']);
  expect(messages[0].text.startsWith(lessonMarker(course.id,lesson.title))).toBe(true);
  expect(messages[0].text).toContain(lesson.body[0]);
  expect(messages[0].text).toContain('Previously completed lessons: '+course.lessons[0].title);
  expect(messages[0].text).not.toContain('unrelated');
  expect(messages[1].text).toContain('Welcome, Roo');
  expect(messages[1].text).toContain('1 other lesson complete');
 });
 it('welcomes a new learner without inventing progress',()=>{
  const messages=lessonOpening(courses[0],courses[0].lessons[0],undefined,[]);
  expect(messages[1].text).toContain('start with the foundations');
  expect(messages[0].text).toContain('none recorded');
 });
});
