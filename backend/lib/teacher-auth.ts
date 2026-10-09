export class TeacherAuthError extends Error {constructor(public status:number,message:string){super(message);}}
const encode=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encode.encode(value)));}
export function teacherToken(request:Request){return request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]||'';}
async function ownerScope(db:D1Database,email?:string){const row=await db.prepare('SELECT owner_id FROM competitions ORDER BY created_at ASC LIMIT 1').first<{owner_id:string}>();return row?.owner_id||`password:${email?.toLowerCase()||'teacher'}`;}
export async function authorizeTeacher(request:Request,db:D1Database,email?:string,requirePassword=false){
 const token=teacherToken(request);
 if(token){const session=await db.prepare('SELECT owner_id FROM teacher_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token),Date.now()).first<{owner_id:string}>();if(session)return session.owner_id;throw new TeacherAuthError(401,'登入已過期，請重新輸入老師密碼。');}
 const id=request.headers.get('oai-authenticated-user-id'),address=request.headers.get('oai-authenticated-user-email');
 if(!requirePassword&&email&&id&&address?.toLowerCase()===email.toLowerCase())return await ownerScope(db,email);
 throw new TeacherAuthError(401,'請先輸入老師密碼登入。');
}
export async function loginTeacher(request:Request,db:D1Database,password:unknown,configuration?:string,email?:string){
 if(!configuration)throw new TeacherAuthError(503,'老師登入尚未設定，請稍後再試。');
 let config:{salt:string;hash:string;iterations:number};try{config=JSON.parse(configuration);if(!/^[a-f0-9]{32}$/.test(config.salt)||!/^[a-f0-9]{64}$/.test(config.hash)||config.iterations!==100000)throw new Error();}catch{throw new TeacherAuthError(503,'老師登入暫時未能使用。');}
 const key=await digest('teacher-login:'+ (request.headers.get('cf-connecting-ip')||'unknown'));
 const now=Date.now(),windowMs=15*60*1000;
 const attempt=await db.prepare('INSERT INTO teacher_login_attempts (key, attempts, window_started) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_started <= ? THEN 1 ELSE attempts + 1 END, window_started = CASE WHEN window_started <= ? THEN excluded.window_started ELSE window_started END RETURNING attempts').bind(key,now,now-windowMs,now-windowMs).first<{attempts:number}>();
 if(!attempt||attempt.attempts>5)throw new TeacherAuthError(429,'嘗試次數太多，請於 15 分鐘後再登入。');
 const candidate=typeof password==='string'&&password.length<=128?password:'';
 const material=await crypto.subtle.importKey('raw',encode.encode(candidate),'PBKDF2',false,['deriveBits']);
 const salt=Uint8Array.from(config.salt.match(/../g)!,x=>parseInt(x,16));
 const derived=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:config.iterations},material,256));
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=derived.charCodeAt(i)^config.hash.charCodeAt(i);
 if(mismatch||!candidate)throw new TeacherAuthError(401,'密碼不正確，請再試一次。');
 const token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer),ownerId=await ownerScope(db,email);
 await db.batch([
  db.prepare('DELETE FROM teacher_sessions WHERE expires_at <= ?').bind(now),
  db.prepare('INSERT INTO teacher_sessions (token_hash, owner_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token),ownerId,now+8*60*60*1000),
  db.prepare('DELETE FROM teacher_login_attempts WHERE key = ? OR window_started <= ?').bind(key,now-windowMs)
 ]);
 return {teacherToken:token};
}
export async function logoutTeacher(request:Request,db:D1Database){const token=teacherToken(request);if(token)await db.prepare('DELETE FROM teacher_sessions WHERE token_hash = ?').bind(await digest(token)).run();return {ok:true};}
