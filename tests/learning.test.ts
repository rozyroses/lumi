import {describe,it,expect} from 'vitest';
import {readJournal,journalMarker,courses} from '../src/learning';
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
