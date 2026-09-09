import { courses, type JournalMessage } from './learning';
export type Major = {id:string; title:string; school:string; description:string; courseIds:string[]; outcomes:string[]; project:string};
export const majors:Major[]=[
 {id:'music',title:'Music & songwriting',school:'School of Music',description:'Develop your voice through lyric craft, storytelling, and the visual world around a release.',courseIds:['songwriting','visual'],outcomes:['Write and revise original lyrics','Develop a release identity','Build an original song concept portfolio'],project:'An original lyric portfolio and release art-direction brief'},
 {id:'design',title:'Visual arts & creative direction',school:'School of Visual Arts',description:'Build clear concepts and consistent visual systems for music, culture, and storytelling.',courseIds:['visual','film'],outcomes:['Write a focused creative brief','Create a visual identity system','Translate an idea into a shot plan'],project:'A visual identity brief and a six-shot campaign concept'},
 {id:'film',title:'Film & digital storytelling',school:'School of Film',description:'Shape scenes, frame meaningful images, and use sound to tell stories that move people.',courseIds:['film','songwriting'],outcomes:['Structure a scene around a turning point','Plan framing and sound','Develop a distinctive narrative voice'],project:'A short-film shot plan with an original narrative or lyric treatment'}
];
export type StudentJournal={messages:JournalMessage[]};
export const PROFILE_MARKER='[Unity student profile]';
export function getMajor(journals:StudentJournal[], fallback?:string){
 const raw=journals.find(j=>j.messages[0]?.text===PROFILE_MARKER)?.messages[1]?.text;
 try{const id=raw?JSON.parse(raw).majorId:fallback;return majors.find(m=>m.id===id)||null;}catch{return majors.find(m=>m.id===fallback)||null;}
}
export type Attempt={id:string;courseId:string;correct:number;total:number;at:number};
export function attemptsFrom(journals:StudentJournal[]):Attempt[]{return journals.flatMap(j=>{
 if(!j.messages[0]?.text.startsWith('[Unity practice: '))return [];
 try{const a=JSON.parse(j.messages[1]?.text);return typeof a.id==='string'&&courses.some(c=>c.id===a.courseId)&&Number.isInteger(a.correct)&&Number.isInteger(a.total)&&a.total>0&&a.correct>=0&&a.correct<=a.total&&Number.isFinite(a.at)?[a as Attempt]:[];}catch{return [];}
}).sort((a,b)=>b.at-a.at);}
export function gradeFor(percent:number){return percent>=90?{letter:'A',points:4}:percent>=80?{letter:'B',points:3}:percent>=70?{letter:'C',points:2}:percent>=60?{letter:'D',points:1}:{letter:'F',points:0};}
export function gradeSummary(attempts:Attempt[],courseIds:string[]){
 const rows=courseIds.map(id=>{const best=attempts.filter(a=>a.courseId===id).sort((a,b)=>b.correct/b.total-a.correct/a.total||b.at-a.at)[0];return {course:courses.find(c=>c.id===id)!,best,grade:best?gradeFor(best.correct/best.total*100):null};}).filter(r=>r.course);
 const graded=rows.filter(r=>r.grade);return {rows,gpa:graded.length?graded.reduce((n,r)=>n+r.grade!.points,0)/graded.length:null};
}
export const services=[
 {id:'admin',icon:'▣',title:'Administrative assistance',description:'Your profile, major, and learning plan',prompt:'Help me with my Unity profile or major selection. Explain available self-service actions. Do not claim to change an account or enrollment.'},
 {id:'records',icon:'▤',title:'Learning records',description:'Progress, practice grades, and your record',prompt:'Explain Unity learning records, practice GPA, and how to download a personal progress record. These are self-study records, not official transcripts or identity verification.'},
 {id:'technical',icon:'⌘',title:'Technical support',description:'Sign-in, saved work, or a connection issue',prompt:'Help troubleshoot a Unity technical issue. Ask what happened and suggest reversible steps. Do not request passwords, access tokens, or verification codes.'},
 {id:'academic',icon:'✦',title:'Academic assistance',description:'A lesson, project, or practice question',prompt:'Help me understand a lesson, practice result, or creative project. Ask what I need and coach me through it.'},
 {id:'access',icon:'◉',title:'Accessibility',description:'Reading support and a pace that fits',prompt:'Help me choose a comfortable learning approach: shorter explanations, plain language, extra examples, or breaks. Do not ask for a diagnosis or medical documentation, or claim to approve formal accommodations.'},
 {id:'funding',icon:'◇',title:'Funding & payments',description:'Service information',prompt:'Unity does not currently offer financial aid, scholarships, or tuition payment processing. Clearly state that limitation. Do not promise funding or ask for financial account details.'},
 {id:'devices',icon:'▱',title:'Device & setup help',description:'Browser and device guidance',prompt:'Help me use Unity on my existing device. Unity does not ship or loan laptops. Give practical browser and setup help without claiming a shipment exists.'},
 {id:'transfer',icon:'⇄',title:'Credit transfer',description:'Service information',prompt:'Unity does not currently provide accredited credits or credit-transfer agreements. Clearly state that limitation; do not promise transferability or issue an official evaluation.'},
 {id:'other',icon:'?',title:'Something else?',description:'Find your next step',prompt:'Ask what I need help with in Unity and offer an honest next step. Do not invent staff contact details, institutional services, or completed actions.'},
 {id:'feedback',icon:'♡',title:'Feedback & suggestions',description:'Keep ideas for improving your experience',prompt:'Help me articulate feedback about Unity. The conversation is saved to my account; it is not sent to a human team. Do not claim it has been delivered.'}
];
