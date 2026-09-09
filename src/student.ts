import { courses, type JournalMessage } from './learning';

export type DegreeRequirement={id:string;label:string;credits:number;group:'general'|'major'|'elective'|'capstone'};
export type Major={id:string; title:string; degree:string; school:string; description:string; courseIds:string[]; outcomes:string[]; project:string; totalCredits:number; requirements:DegreeRequirement[]};

export const majors:Major[]=[
 {id:'music',title:'Music & songwriting',degree:'B.F.A. in Music & Songwriting',school:'School of Music',description:'Develop your voice through lyric craft, storytelling, and the visual world around a release.',courseIds:['songwriting','visual'],outcomes:['Write and revise original lyrics','Develop a release identity','Build an original song concept portfolio'],project:'An original lyric portfolio and release art-direction brief',totalCredits:120,requirements:[
  {id:'gened',label:'General education',credits:36,group:'general'},
  {id:'music-foundations',label:'Music foundations',credits:24,group:'major'},
  {id:'songwriting-core',label:'Songwriting & composition',credits:24,group:'major'},
  {id:'creative-direction',label:'Production & creative direction',credits:24,group:'major'},
  {id:'electives',label:'Creative electives',credits:6,group:'elective'},
  {id:'capstone',label:'Senior portfolio capstone',credits:6,group:'capstone'}
 ]},
 {id:'design',title:'Visual arts & creative direction',degree:'B.F.A. in Visual Arts & Creative Direction',school:'School of Visual Arts',description:'Build clear concepts and consistent visual systems for music, culture, and storytelling.',courseIds:['visual','film'],outcomes:['Write a focused creative brief','Create a visual identity system','Translate an idea into a shot plan'],project:'A visual identity brief and a six-shot campaign concept',totalCredits:120,requirements:[
  {id:'gened',label:'General education',credits:36,group:'general'},
  {id:'design-foundations',label:'Design foundations',credits:24,group:'major'},
  {id:'visual-systems',label:'Visual systems & identity',credits:24,group:'major'},
  {id:'creative-direction',label:'Creative direction studio',credits:24,group:'major'},
  {id:'electives',label:'Studio electives',credits:6,group:'elective'},
  {id:'capstone',label:'Senior portfolio capstone',credits:6,group:'capstone'}
 ]},
 {id:'film',title:'Film & digital storytelling',degree:'B.F.A. in Film & Digital Storytelling',school:'School of Film',description:'Shape scenes, frame meaningful images, and use sound to tell stories that move people.',courseIds:['film','songwriting'],outcomes:['Structure a scene around a turning point','Plan framing and sound','Develop a distinctive narrative voice'],project:'A short-film shot plan with an original narrative or lyric treatment',totalCredits:120,requirements:[
  {id:'gened',label:'General education',credits:36,group:'general'},
  {id:'film-studies',label:'Film & media foundations',credits:24,group:'major'},
  {id:'production',label:'Production craft',credits:24,group:'major'},
  {id:'storytelling',label:'Digital storytelling studio',credits:24,group:'major'},
  {id:'electives',label:'Production electives',credits:6,group:'elective'},
  {id:'capstone',label:'Senior film capstone',credits:6,group:'capstone'}
 ]}
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
 {id:'advising',icon:'✦',title:'Academic advising',description:'Degree planning, classes, and your next semester',prompt:'Help with academic planning for the learner’s selected Unity program. Stay focused on degree planning, class sequencing, workload, and study strategy. Do not claim that a schedule, registration, or institutional approval has been completed.'},
 {id:'major-change',icon:'⇄',title:'Change my major',description:'Compare programs and plan a program change',prompt:'Help the learner compare their current major with another Unity major. Explain how a different major would change their foundation path and degree plan. The learner can confirm a major change in the Program changes section of Student Services; do not claim the change happened until they use that control.'},
 {id:'admin',icon:'▣',title:'Registrar & enrollment',description:'Your profile, enrollment, and program information',prompt:'Help with the learner’s Unity profile, enrollment information, or self-service program records. Explain available self-service actions. Do not claim to change an account, enrollment status, or official record unless the learner uses a visible self-service control.'},
 {id:'records',icon:'▤',title:'Learning records',description:'Progress, practice grades, and your record',prompt:'Explain Unity learning records, practice GPA, and how to download a personal progress record. Clearly distinguish learning records from an official transcript.'},
 {id:'career',icon:'◎',title:'Career services',description:'Turn your major into a career plan',prompt:'Help the learner connect their Unity major, portfolio, and skills to career possibilities. Stay focused on career exploration, resumes, portfolios, internships, and job-search preparation. Do not claim to place the learner into a job or internship.'},
 {id:'graduation',icon:'◇',title:'Graduation planning',description:'Review degree requirements and capstone readiness',prompt:'Help the learner understand their degree audit, remaining requirement groups, and capstone planning. Do not claim the learner has officially graduated, been cleared for graduation, or earned a degree.'},
 {id:'technical',icon:'⌘',title:'Technical support',description:'Sign-in, saved work, or a connection issue',prompt:'Help troubleshoot a Unity technical issue. Ask what happened and suggest reversible steps. Do not request passwords, access tokens, or verification codes.'},
 {id:'academic',icon:'✎',title:'Tutoring & academic support',description:'A lesson, project, or practice question',prompt:'Help me understand a lesson, practice result, or creative project. Ask what I need and coach me through it.'},
 {id:'access',icon:'◉',title:'Accessibility services',description:'Reading support and a pace that fits',prompt:'Help me choose a comfortable learning approach: shorter explanations, plain language, extra examples, or breaks. Do not ask for a diagnosis or medical documentation, or claim to approve formal accommodations.'},
 {id:'funding',icon:'$',title:'Tuition & financial aid',description:'Funding and payment information',prompt:'Explain the financial-aid and payment information currently available in Unity. If a feature is not yet active, state that clearly. Do not promise funding or ask for bank account, card, or login details.'},
 {id:'devices',icon:'▱',title:'Device & setup help',description:'Browser and device guidance',prompt:'Help me use Unity on my existing device. Give practical browser and setup help without claiming a shipment exists.'},
 {id:'transfer',icon:'↗',title:'Transfer & prior learning',description:'Transfer-credit planning information',prompt:'Explain the transfer and prior-learning information currently represented in Unity. Do not promise transferability, invent partner schools, or issue an official evaluation.'},
 {id:'other',icon:'?',title:'Something else?',description:'Find your next step',prompt:'Ask what I need help with in Unity and offer an honest next step. Do not invent staff contact details, institutional services, or completed actions.'},
 {id:'feedback',icon:'♡',title:'Feedback & suggestions',description:'Keep ideas for improving your experience',prompt:'Help me articulate feedback about Unity. The conversation is saved to my account; do not claim it has been delivered to a human team unless that feature exists.'}
];
