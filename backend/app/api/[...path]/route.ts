import {env} from 'cloudflare:workers';
import {getRawDb} from '@/db';
import {handleCompetition} from '@/lib/competition-server';
export const dynamic='force-dynamic';
async function dispatch(request:Request){try{return await handleCompetition(request,getRawDb(),env.TEACHER_EMAIL,env.STUDENT_URL?new URL(env.STUDENT_URL).origin:undefined);}catch(error){console.error(error);return Response.json({message:'比賽服務暫時未能連線，請稍後再試。'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export const GET=dispatch;
export const POST=dispatch;
export const OPTIONS=dispatch;
