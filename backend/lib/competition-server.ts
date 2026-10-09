import {checkAnswer,enumerate} from './engine.mjs';
type Competition={id:string;code:string;owner_id:string;divisors:string;length:number;cards:string;status:string;created_at:number;started_at:number|null};
type Participant={id:string;competition_id:string;nickname:string};
class RequestError extends Error {constructor(public status:number,message:string){super(message);}}
function json(data:unknown,status=200,headers:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});}
function unpack(row:Competition,showCards=true){return {id:row.id,code:row.code,divisors:JSON.parse(row.divisors),length:row.length,cards:showCards?JSON.parse(row.cards):[],status:row.status,createdAt:row.created_at};}
function teacher(request:Request,email:string|undefined){const id=request.headers.get('oai-authenticated-user-id'),address=request.headers.get('oai-authenticated-user-email');if(!email||!id||address?.toLowerCase()!==email.toLowerCase())throw new RequestError(403,'只有老師帳戶可以派發或控制比賽。');return id;}
async function payload(request:Request){if(Number(request.headers.get('content-length')||0)>4096)throw new RequestError(413,'資料過長。');const raw=await request.text();if(raw.length>4096)throw new RequestError(413,'資料過長。');try{return JSON.parse(raw);}catch{throw new RequestError(400,'無法讀取資料，請再試一次。');}}
async function hash(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function sessionToken(request:Request){const bearer=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];return bearer||request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('competition_session='))?.slice('competition_session='.length)||'';}
function cookie(token:string,request:Request,remove=false){return `competition_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${remove?0:604800}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function getParticipant(db:D1Database,request:Request){const token=sessionToken(request);if(!/^[a-f0-9]{64}$/.test(token))throw new RequestError(401,'請先輸入參賽代碼加入比賽。');const p=await db.prepare('SELECT id, competition_id, nickname FROM participants WHERE token_hash = ?').bind(await hash(token)).first<Participant>();if(!p)throw new RequestError(401,'請重新加入比賽。');return p;}
async function studentState(db:D1Database,p:Participant){const c=await db.prepare('SELECT * FROM competitions WHERE id = ?').bind(p.competition_id).first<Competition>();if(!c)throw new RequestError(404,'找不到這場比賽。');const a=await db.prepare('SELECT value FROM answers WHERE participant_id = ? ORDER BY submitted_at, value').bind(p.id).all<{value:string}>();return {competition:unpack(c,c.status!=='waiting'),nickname:p.nickname,accepted:a.results.map(x=>x.value)};}
async function processCompetition(request:Request,db:D1Database,teacherEmail:string|undefined,studentOrigin?:string){
 try{
 const path=new URL(request.url).pathname,method=request.method;
 const externalStudent=!!studentOrigin&&request.headers.get('origin')===studentOrigin&&path.startsWith('/api/student/');
 if(method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin&&!externalStudent)throw new RequestError(403,'請從比賽網站提交。');
 if(path==='/api/student/state'&&method==='GET')return json(await studentState(db,await getParticipant(db,request)));
 if(path==='/api/student/leave'&&method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',request,true)});
 if(path==='/api/student/join'&&method==='POST'){
  const data=await payload(request),code=String(data.code||'').trim().toUpperCase(),nickname=String(data.nickname||'').trim();
  if(!/^[A-Z2-9]{6}$/.test(code))throw new RequestError(400,'參賽代碼是 6 個英文字母或數字。');if(nickname.length<1||nickname.length>24)throw new RequestError(400,'請填寫 1–24 字的參賽名稱，例如 4A 12。');
  const c=await db.prepare('SELECT * FROM competitions WHERE code = ?').bind(code).first<Competition>();if(!c)throw new RequestError(404,'找不到這個代碼，請向老師確認。');if(c.status==='ended')throw new RequestError(409,'這場比賽已經結束。');
  if(sessionToken(request)){try{const existing=await getParticipant(db,request);if(existing.competition_id===c.id){if(existing.nickname===nickname)return json({...await studentState(db,existing),...(externalStudent?{sessionToken:sessionToken(request)}:{})});throw new RequestError(409,'這部裝置已有參賽者。請先退出比賽，再用另一個名稱加入。');}}catch(error){if(error instanceof RequestError&&error.status===409)throw error;}}
  const nameUsed=await db.prepare('SELECT id FROM participants WHERE competition_id = ? AND nickname = ?').bind(c.id,nickname).first();if(nameUsed)throw new RequestError(409,'這個參賽名稱已有人使用，請使用班別和學號作名稱。');
  const id=crypto.randomUUID(),token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  try{await db.prepare('INSERT INTO participants (id, competition_id, nickname, token_hash, joined_at) VALUES (?, ?, ?, ?, ?)').bind(id,c.id,nickname,await hash(token),Date.now()).run();}catch(error){if(String(error).includes('UNIQUE'))throw new RequestError(409,'這個參賽名稱已有人使用。');throw error;}
  return json({...await studentState(db,{id,competition_id:c.id,nickname}),...(externalStudent?{sessionToken:token}:{})},200,{'Set-Cookie':cookie(token,request)});
 }
 if(path==='/api/student/answer'&&method==='POST'){
  const p=await getParticipant(db,request),data=await payload(request),state=await studentState(db,p);
  if(state.competition.status!=='running')throw new RequestError(409,state.competition.status==='paused'?'老師已暫停比賽，請等待繼續。':'比賽尚未開始或已結束。');
  if(state.accepted.length>=3)throw new RequestError(409,'你已完成 3 個答案。');
  const result=checkAnswer(typeof data.value==='string'?data.value:'',state.competition.cards,state.competition.length,state.competition.divisors,state.accepted);
  if(!result.ok)return json({message:result.message},422);
  const inserted=await db.prepare("INSERT OR IGNORE INTO answers (participant_id, value, submitted_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM answers WHERE participant_id = ?) < 3 AND EXISTS (SELECT 1 FROM competitions WHERE id = ? AND status = 'running')").bind(p.id,result.value,Date.now(),p.id,p.competition_id).run();
  if(!inserted.meta.changes)throw new RequestError(409,'比賽狀態已改變或答案已記錄，請稍候再試。');
  return json({...await studentState(db,p),message:result.message});
 }
 if(path.startsWith('/api/teacher/')){
  const ownerId=teacher(request,teacherEmail);
  if(path==='/api/teacher/competitions'&&method==='GET'){const r=await db.prepare('SELECT * FROM competitions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 30').bind(ownerId).all<Competition>();return json({competitions:r.results.map(c=>unpack(c))});}
  if(path==='/api/teacher/competitions'&&method==='POST'){
   const data=await payload(request),ds=data.divisors,cards=data.cards,length=data.length;
   if(!Array.isArray(ds)||ds.length!==2||new Set(ds).size!==2||!ds.every(d=>[2,3,5,10].includes(d)))throw new RequestError(400,'請選擇兩項不同的整除條件。');
   if(![3,4].includes(length)||!Array.isArray(cards)||cards.length!==5||new Set(cards).size!==5||!cards.every(d=>Number.isInteger(d)&&d>=0&&d<=9)||enumerate(cards,length,ds).length<3)throw new RequestError(400,'數卡必須能組成至少 3 個符合兩項條件的答案。請重新產生數卡。');
   const id=crypto.randomUUID(),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';
   for(let attempt=0;attempt<8;attempt++){code=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>alphabet[b%alphabet.length]).join('');if(!await db.prepare('SELECT id FROM competitions WHERE code = ?').bind(code).first())break;if(attempt===7)throw new RequestError(503,'未能產生代碼，請重試。');}
   await db.prepare("INSERT INTO competitions (id, code, owner_id, divisors, length, cards, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?)").bind(id,code,ownerId,JSON.stringify([...ds].sort((a,b)=>a-b)),length,JSON.stringify(cards),Date.now()).run();return json({competition:unpack((await db.prepare('SELECT * FROM competitions WHERE id = ?').bind(id).first<Competition>())!)});
  }
  const match=path.match(/^\/api\/teacher\/competitions\/([a-f0-9-]+)$/);if(match){
   const c=await db.prepare('SELECT * FROM competitions WHERE id = ? AND owner_id = ?').bind(match[1],ownerId).first<Competition>();if(!c)throw new RequestError(404,'找不到這場比賽。');
   if(method==='GET'){
    const r=await db.prepare('SELECT p.id, p.nickname, a.value FROM participants p LEFT JOIN answers a ON a.participant_id = p.id WHERE p.competition_id = ? ORDER BY p.joined_at, a.submitted_at').bind(c.id).all<{id:string;nickname:string;value:string|null}>();
    const group=new Map<string,{id:string;nickname:string;answers:string[]}>();for(const row of r.results){if(!group.has(row.id))group.set(row.id,{id:row.id,nickname:row.nickname,answers:[]});if(row.value)group.get(row.id)!.answers.push(row.value);}return json({competition:unpack(c),participants:[...group.values()]});
   }
   if(method==='POST'){
    const data=await payload(request),next=data.status,transitions:Record<string,string[]>={waiting:['running','ended'],running:['paused','ended'],paused:['running','ended'],ended:[]};
    if(!transitions[c.status]?.includes(next))throw new RequestError(409,'這個狀態不能切換，請重新整理比賽。');
    const updated=await db.prepare("UPDATE competitions SET status = ?, started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN ? ELSE started_at END WHERE id = ? AND owner_id = ? AND status = ?").bind(next,next,Date.now(),c.id,ownerId,c.status).run();if(!updated.meta.changes)throw new RequestError(409,'比賽狀態已改變，請重新整理。');return json({ok:true});
   }
  }
 }
 return json({message:'找不到這個功能。'},404);
 }catch(error){if(error instanceof RequestError)return json({message:error.message},error.status);console.error('Competition request failed',error);return json({message:'暫時未能連線，資料尚未確認儲存。請稍後重試。'},503);}
}

export async function handleCompetition(request:Request,db:D1Database,teacherEmail:string|undefined,studentOrigin?:string){
 const origin=request.headers.get('origin'),external=!!studentOrigin&&origin===studentOrigin&&new URL(request.url).pathname.startsWith('/api/student/');
 if(request.method==='OPTIONS')return external?new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':studentOrigin!,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}}):json({message:'不允許從這個網站連線。'},403);
 const response=await processCompetition(request,db,teacherEmail,studentOrigin);
 if(!external)return response;
 const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',studentOrigin!);headers.set('Vary','Origin');return new Response(response.body,{status:response.status,headers});
}
