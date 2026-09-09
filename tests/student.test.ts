import {describe,it,expect} from 'vitest';
import {getMajor,PROFILE_MARKER,attemptsFrom,gradeFor,gradeSummary,type Attempt} from '../src/student';
const attempt=(id:string,courseId:string,correct:number,total=10):Attempt=>({id,courseId,correct,total,at:123});
describe('student learning records',()=>{
 it('uses signup metadata then honors a saved major choice',()=>{
  expect(getMajor([],'music')?.id).toBe('music');
  expect(getMajor([{messages:[{role:'user',text:PROFILE_MARKER},{role:'user',text:'{"majorId":"film"}'}]}],'music')?.id).toBe('film');
  expect(getMajor([],'nonexistent')).toBe(null);
 });
 it('ignores malformed practice data and unrelated conversations',()=>{
  const journals=[{messages:[{role:'user' as const,text:'[Unity practice: valid]'},{role:'user' as const,text:JSON.stringify(attempt('a','film',8))}]},{messages:[{role:'user' as const,text:'[Unity practice: invalid]'},{role:'user' as const,text:'{"correct":99}'}]},{messages:[{role:'user' as const,text:'regular chat'},{role:'user' as const,text:JSON.stringify(attempt('b','film',10))}]}];
  expect(attemptsFrom(journals).map(a=>a.id)).toEqual(['a']);
 });
 it.each([[90,'A',4],[80,'B',3],[70,'C',2],[60,'D',1],[59,'F',0]])('maps %s percent to the published scale',(score,letter,points)=>{
  expect(gradeFor(Number(score))).toEqual({letter,points});
 });
 it('excludes missing courses, retains the best attempt, and scopes GPA to the major',()=>{
  const data=[attempt('a','songwriting',9),attempt('b','songwriting',5),attempt('c','film',7),attempt('d','visual',0)];
  const summary=gradeSummary(data,['songwriting','film']);
  expect(summary.gpa).toBe(3);expect(summary.rows[0].best?.id).toBe('a');
  expect(gradeSummary(data,['visual']).gpa).toBe(0);
  expect(gradeSummary([],['songwriting','film']).gpa).toBe(null);
  expect(gradeSummary([attempt('a','songwriting',9)],['songwriting','film']).gpa).toBe(4);
 });
});
