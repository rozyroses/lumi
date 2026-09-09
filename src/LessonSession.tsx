import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { type Course, type Lesson, type JournalMessage, lessonMarker, lessonOpening } from './learning';
type Props = {course: Course; lesson: Lesson; name?: string; completed: string[]; ready: boolean; saved: JournalMessage[]; onSave: (marker: string, title: string, messages: JournalMessage[])=>void; onReply: (messages: JournalMessage[], signal: AbortSignal)=>Promise<string>};
export default function LessonSession({course,lesson,name,completed,ready,saved,onSave,onReply}:Props){
 const marker=lessonMarker(course.id,lesson.title);
 const initial=lessonOpening(course,lesson,name,completed);
 const [messages,setMessages]=useState<JournalMessage[]>(saved.length?saved:initial);
 const [input,setInput]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const controller=useRef<AbortController|null>(null);const end=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages,busy]);
 // Cloud journals may arrive after the campus first renders. Do not replace a local turn in flight.
 useEffect(()=>{if(!controller.current&&saved.length) setMessages(saved);},[saved]);
 async function send(text:string,retry=false){
  if(busy||!ready||(!text.trim()&&!retry))return;
  const next=retry?messages:[...messages,{role:'user' as const,text:text.trim()}];
  setMessages(next);setInput('');setError('');setBusy(true);onSave(marker,`${course.code} · ${lesson.title}`,next);
  const request=new AbortController();controller.current=request;
  try{const reply=await onReply(next,request.signal);if(request.signal.aborted)return;const updated=[...next,{role:'lumi' as const,text:reply}];setMessages(updated);onSave(marker,`${course.code} · ${lesson.title}`,updated);}
  catch(e){if(!request.signal.aborted)setError('Lumi couldn’t connect. Your message is saved; try again, or use the lesson notes.');}
  finally{if(!request.signal.aborted){setBusy(false);controller.current=null;}}
 }
 return <section className="unity-session" aria-label="Lesson conversation with Lumi">
  <div className="unity-session-heading"><span>✦ LUMI / YOUR CREATIVE TUTOR</span><small>{lesson.minutes} min · at your pace</small></div>
  <div className="unity-session-thread" aria-live="polite">{messages.slice(1).map((message,i)=><div className={`unity-tutor-message ${message.role}`} key={i}>{message.role==='lumi'&&<span className="unity-tutor-avatar" aria-hidden="true">✦</span>}<div><ReactMarkdown>{message.text}</ReactMarkdown></div></div>)}{busy&&<div className="unity-tutor-busy" role="status">✦ Lumi is working on your reply…</div>}<div ref={end}/></div>
  {messages.length===initial.length&&<div className="unity-quick-replies">{['I’m brand new to this','Show me a creative example','Let’s try a practice question'].map(t=><button disabled={busy||!ready} key={t} onClick={()=>void send(t)}>{t}</button>)}</div>}
  {error&&<div className="unity-session-error" role="alert">{error}<button disabled={busy} onClick={()=>void send('',true)}>Try again</button></div>}
  <form className="unity-session-composer" onSubmit={e=>{e.preventDefault();void send(input);}}><label className="unity-sr-only" htmlFor="lesson-message">Message Lumi about this lesson</label><textarea id="lesson-message" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask a question, try an answer, or tell Lumi to slow down…" rows={2} maxLength={12000}/><button className="unity-primary" disabled={!input.trim()||busy||!ready} type="submit">Send ↑</button></form><p className="unity-session-note">Lumi is an AI tutor. Ask questions, check the lesson notes, and make the work your own.</p>
 </section>;
}
