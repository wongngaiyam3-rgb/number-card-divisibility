import {env} from 'cloudflare:workers';
import {requireChatGPTUser} from '../chatgpt-auth';
import TeacherPanel from '../teacher-panel';
export const dynamic='force-dynamic';
export default async function TeacherPage(){
 const user=await requireChatGPTUser('/teacher');
 if(!env.TEACHER_EMAIL||user.email.toLowerCase()!==env.TEACHER_EMAIL.toLowerCase())return <main className="page"><div className="panel access-message"><h1>這是老師控制台</h1><p>請使用網站老師的 ChatGPT 帳戶登入。</p><a className="nav-link" href="/">返回學生入口</a></div></main>;
 return <TeacherPanel studentUrl={env.STUDENT_URL}/>;
}
