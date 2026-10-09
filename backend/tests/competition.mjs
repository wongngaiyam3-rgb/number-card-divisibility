import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleCompetition} from '../lib/competition-server.ts';
import {generateRound,enumerate,checkAnswer} from '../lib/engine.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const db={prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
const origin='https://classroom.test',owner='teacher@example.test';
async function req(path,{method='GET',data,cookie,teacher=false,email=owner,originHeader=origin,cors=false,token}={}){
 const headers={};if(method==='POST')headers.origin=originHeader;if(cookie)headers.cookie=cookie;if(cors||method==='OPTIONS')headers.origin=originHeader;if(token)headers.authorization='Bearer '+token;if(teacher){headers['oai-authenticated-user-id']='teacher-user';headers['oai-authenticated-user-email']=email;}
 const response=await handleCompetition(new Request(origin+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),db,owner,cors?'https://wongngaiyam3-rgb.github.io':undefined);
 return {status:response.status,allowOrigin:response.headers.get('access-control-allow-origin'),data:response.status===204?null:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
assert.equal((await req('/api/teacher/competitions')).status,403);
assert.equal((await req('/api/teacher/competitions',{teacher:true,email:'student@example.test'})).status,403);
assert.equal((await req('/api/teacher/competitions',{method:'POST',teacher:true,originHeader:'https://other.test',data:{}})).status,403);
assert.equal((await req('/api/teacher/competitions',{method:'POST',teacher:true,data:{divisors:[2,2],length:3,cards:[0,2,3,5,7]}})).status,400);
assert.equal((await req('/api/teacher/competitions',{method:'POST',teacher:true,data:{divisors:[3,10],length:3,cards:[1,2,3,4,5]}})).status,400);
const created=await req('/api/teacher/competitions',{method:'POST',teacher:true,data:{divisors:[2,3],length:3,cards:[0,2,3,5,7]}});
assert.equal(created.status,200);const c=created.data.competition;assert.equal(c.status,'waiting');assert.match(c.code,/^[A-Z2-9]{6}$/);
const join=await req('/api/student/join',{method:'POST',data:{code:c.code,nickname:'4A 12'}});assert.equal(join.status,200);assert.deepEqual(join.data.competition.cards,[]);assert.ok(join.cookie);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value:'270'}})).status,409);
assert.equal((await req('/api/student/answer',{method:'POST',data:{value:'270'}})).status,401);
assert.equal((await req('/api/student/join',{method:'POST',data:{code:c.code,nickname:'4A 12'}})).status,409);
assert.equal((await req('/api/student/join',{method:'POST',cookie:join.cookie,data:{code:c.code,nickname:'4A 12'}})).status,200);
assert.equal((await req('/api/student/join',{method:'POST',cookie:join.cookie,data:{code:c.code,nickname:'another student'}})).status,409);
const other=await req('/api/student/join',{method:'POST',data:{code:c.code,nickname:'4B 13'}});assert.equal(other.status,200);
const control=(status)=>req(`/api/teacher/competitions/${c.id}`,{method:'POST',teacher:true,data:{status}});
assert.equal((await control('running')).status,200);
assert.deepEqual((await req('/api/student/state',{cookie:join.cookie})).data.competition.cards,[0,2,3,5,7]);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value:'230'}})).status,422);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value:'270'}})).status,200);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value:'270'}})).status,422);
assert.deepEqual((await req('/api/student/state',{cookie:other.cookie})).data.accepted,[]);
assert.equal((await control('paused')).status,200);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value:'720'}})).status,409);
assert.equal((await control('running')).status,200);
await Promise.all(['720','570','750'].map(value=>req('/api/student/answer',{method:'POST',cookie:join.cookie,data:{value}})));
assert.equal((await req('/api/student/state',{cookie:join.cookie})).data.accepted.length,3);
const dashboard=await req(`/api/teacher/competitions/${c.id}`,{teacher:true});assert.equal(dashboard.status,200);assert.equal(dashboard.data.participants.length,2);assert.equal(dashboard.data.participants.find(p=>p.nickname==='4A 12').answers.length,3);
assert.equal((await control('ended')).status,200);assert.equal((await control('running')).status,409);
assert.equal((await req('/api/student/answer',{method:'POST',cookie:other.cookie,data:{value:'270'}})).status,409);
assert.equal((await req('/api/student/join',{method:'POST',data:{code:c.code,nickname:'new student'}})).status,409);
assert.equal((await req('/api/student/state',{cookie:join.cookie})).data.accepted.length,3);

const ghOrigin='https://wongngaiyam3-rgb.github.io';
assert.equal((await req('/api/student/join',{method:'OPTIONS',cors:true,originHeader:ghOrigin})).status,204);
assert.equal((await req('/api/student/join',{method:'OPTIONS',cors:true,originHeader:'https://other.test'})).status,403);
assert.equal((await req('/api/teacher/competitions',{method:'POST',teacher:true,cors:true,originHeader:ghOrigin,data:{}})).status,403);
const crossCreated=await req('/api/teacher/competitions',{method:'POST',teacher:true,data:{divisors:[3,10],length:3,cards:[0,2,3,5,7]}});
const cross=await req('/api/student/join',{method:'POST',cors:true,originHeader:ghOrigin,data:{code:crossCreated.data.competition.code,nickname:'GH 01'}});
assert.equal(cross.status,200);assert.equal(cross.allowOrigin,ghOrigin);assert.match(cross.data.sessionToken,/^[a-f0-9]{64}$/);
const token=cross.data.sessionToken;
assert.equal((await req('/api/student/state',{cors:true,originHeader:ghOrigin,token})).status,200);
assert.equal((await req(`/api/teacher/competitions/${crossCreated.data.competition.id}`,{method:'POST',teacher:true,data:{status:'running'}})).status,200);
assert.equal((await req('/api/student/answer',{method:'POST',cors:true,originHeader:ghOrigin,token,data:{value:'230'}})).status,422);
assert.equal((await req('/api/student/answer',{method:'POST',cors:true,originHeader:ghOrigin,token,data:{value:'270'}})).status,200);
assert.deepEqual((await req('/api/student/state',{cors:true,originHeader:ghOrigin,token})).data.accepted,['270']);
assert.equal((await req('/api/student/answer',{method:'POST',cors:true,originHeader:'https://other.test',token,data:{value:'720'}})).status,403);

let count=0;for(const ds of [[2,3],[2,5],[2,10],[3,5],[3,10],[5,10]])for(const length of [3,4])for(let i=0;i<150;i++){const r=generateRound(ds,length);assert.equal(r.cards.length,5);assert.equal(new Set(r.cards).size,5);assert.ok(r.solutions.length>=3);for(const n of r.solutions){assert.ok(ds.every(d=>Number(n)%d===0));assert.ok(checkAnswer(n,r.cards,length,ds).ok);}count++;}
for(const ds of [[2,3],[2,5],[2,10],[3,5],[3,10],[5,10]])for(const length of [3,4])assert.ok(generateRound(ds,length,()=>0).solutions.length>=3);
assert.ok(!checkAnswer('230',[0,2,3,5,7],3,[2,3]).ok);
assert.ok(!checkAnswer('235',[0,2,3,5,7],3,[3,5]).ok);
assert.ok(!checkAnswer('570',[0,2,3,5,7],3,[3,10],['570']).ok);
console.log(`Passed: teacher authorization, joining, synchronized cards, dual-condition checks, duplicate prevention, pause/resume/end, atomic 3-answer limit, persisted results, ${count} generated rounds.`);
