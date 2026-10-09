import {env} from 'cloudflare:workers';
import TeacherLogin from '../teacher-login';
export const dynamic='force-dynamic';
export default async function TeacherPage(){
 return <TeacherLogin studentUrl={env.STUDENT_URL||'/'} homeUrl="/"/>;
}
