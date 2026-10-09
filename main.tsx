import {createRoot} from 'react-dom/client';
import StudentApp from './app/student-app';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<StudentApp/>);
