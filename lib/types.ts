export type Competition={id:string;code:string;divisors:number[];length:number;cards:number[];status:'waiting'|'running'|'paused'|'ended';createdAt:number};
export type StudentState={competition:Competition;nickname:string;accepted:string[]};
export type Participant={id:string;nickname:string;answers:string[]};
export const statuses={waiting:'等待老師開始',running:'比賽進行中',paused:'老師已暫停',ended:'比賽已結束'};
export const API_BASE='https://number-card-divisibility.ilovetsr089.chatgpt.site';
export const TEACHER_URL='/number-card-divisibility/teacher/';
const key='number-card-participant-session';
let memoryToken='';
function getToken(){try{return localStorage.getItem(key)||memoryToken;}catch{return memoryToken;}}
function saveToken(token:string){memoryToken=token;try{if(token)localStorage.setItem(key,token);else localStorage.removeItem(key);}catch{}}
const teacherKey='number-card-teacher-session';
let teacherMemory='';
function teacherCredential(){try{return sessionStorage.getItem(teacherKey)||teacherMemory;}catch{return teacherMemory;}}
export function clearTeacherSession(){teacherMemory='';try{sessionStorage.removeItem(teacherKey);}catch{}}
function storeTeacherSession(token:string){teacherMemory=token;try{sessionStorage.setItem(teacherKey,token);}catch{}}
export async function api<T=unknown>(path:string,data?:unknown):Promise<T>{
 const isTeacher=path.startsWith('/api/teacher/'),token=isTeacher?teacherCredential():getToken();
 const headers:Record<string,string>={};if(data!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(API_BASE+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 const value=await response.json() as {message?:string;sessionToken?:string;teacherToken?:string};
 if(!response.ok){if(isTeacher&&response.status===401&&path!=='/api/teacher/login'){clearTeacherSession();window.dispatchEvent(new Event('teacher-session-expired'));}throw Object.assign(new Error(value.message||'暫時未能連線，請再試一次。'),{status:response.status});}
 if(value.teacherToken)storeTeacherSession(value.teacherToken);
 if(value.sessionToken)saveToken(value.sessionToken);if(path==='/api/student/leave')saveToken('');
 return value as T;
}
