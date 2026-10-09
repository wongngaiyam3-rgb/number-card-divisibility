'use client';
import {useEffect,useState} from 'react';
import TeacherPanel from './teacher-panel';
import {api,clearTeacherSession} from '@/lib/types';
export default function TeacherLogin({studentUrl='/',homeUrl=studentUrl}:{studentUrl?:string;homeUrl?:string}){
 const [ready,setReady]=useState(false),[loggedIn,setLoggedIn]=useState(false),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const expired=()=>{setLoggedIn(false);setPassword('');setError('登入已過期，請重新輸入老師密碼。');};window.addEventListener('teacher-session-expired',expired);void api('/api/teacher/session').then(()=>setLoggedIn(true)).catch(()=>{}).finally(()=>setReady(true));return()=>window.removeEventListener('teacher-session-expired',expired);},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/api/teacher/login',{password});setPassword('');setLoggedIn(true);}catch(e){setError(e instanceof Error?e.message:'未能登入，請再試一次。');}finally{setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await api('/api/teacher/logout',{});clearTeacherSession();setLoggedIn(false);}catch(e){setError(e instanceof Error?e.message:'未能登出，請再試一次。');}finally{setBusy(false);}}
 if(!ready)return <main className="page"><p role="status">正在檢查老師登入…</p></main>;
 if(loggedIn)return <><TeacherPanel studentUrl={studentUrl} homeUrl={homeUrl} onLogout={()=>void logout()}/>{error&&<p role="alert" className="connection-error">{error}</p>}</>;
 return <main className="page"><header><div className="brandmark" aria-hidden="true">÷</div><div><p className="eyebrow">老師專用</p><h1>比賽控制台</h1></div><a className="teacher-link" href={homeUrl}>學生入口</a></header><section className="panel teacher-login-panel"><p className="eyebrow">老師登入</p><h2>輸入老師密碼</h2><p className="instructions">登入後可以派發雙條件比賽、控制開始和暫停，查看學生的作答進度。</p><form onSubmit={e=>void login(e)}><label htmlFor="teacher-password">老師密碼</label><input id="teacher-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button className="primary full-width" disabled={busy}>{busy?'登入中…':'登入控制台'}</button></form>{error&&<p role="alert" className="connection-error">{error}</p>}</section></main>;
}
