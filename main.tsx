import {createRoot} from 'react-dom/client';
import StudentApp from './app/student-app';
import TeacherLogin from './app/teacher-login';
import './app/globals.css';
const home='/number-card-divisibility/';
const isTeacher=window.location.pathname.replace(/index\.html$/,'').replace(/\/+$/,'').endsWith('/teacher');
createRoot(document.getElementById('root')!).render(isTeacher?<TeacherLogin studentUrl={new URL(home,window.location.origin).toString()} homeUrl={home}/>:<StudentApp/>);
