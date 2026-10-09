export type Competition={id:string;code:string;divisors:number[];length:number;cards:number[];status:'waiting'|'running'|'paused'|'ended';createdAt:number};
export type StudentState={competition:Competition;nickname:string;accepted:string[]};
export type Participant={id:string;nickname:string;answers:string[]};
export const statuses={waiting:'等待老師開始',running:'比賽進行中',paused:'老師已暫停',ended:'比賽已結束'};
export const API_BASE='https://number-card-divisibility.ilovetsr089.chatgpt.site';
export const TEACHER_URL=API_BASE+'/teacher';
const key='number-card-participant-session';
let memoryToken='';
function getToken(){try{return localStorage.getItem(key)||memoryToken;}catch{return memoryToken;}}
function saveToken(token:string){memoryToken=token;try{if(token)localStorage.setItem(key,token);else localStorage.removeItem(key);}catch{}}
export async function api<T=unknown>(path:string,data?:unknown):Promise<T>{
 const token=getToken(),headers:Record<string,string>={};if(data!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(API_BASE+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 const value=await response.json() as {message?:string;sessionToken?:string};if(!response.ok)throw Object.assign(new Error(value.message||'暫時未能連線，請再試一次。'),{status:response.status});if(value.sessionToken)saveToken(value.sessionToken);if(path==='/api/student/leave')saveToken('');return value as T;
}
