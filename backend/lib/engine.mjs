export const rules={2:'看個位：個位是 0、2、4、6 或 8，就能被 2 整除。',3:'把各位數字相加：總和能被 3 整除，這個數也能被 3 整除。',5:'看個位：個位是 0 或 5，就能被 5 整除。',10:'看個位：個位是 0，就能被 10 整除。'};
export const conditions=value=>Array.isArray(value)?value:[value];
export const conditionLabel=value=>conditions(value).join(' 和 ');
export const ruleText=value=>conditions(value).map(d=>rules[d]).join(' ');
export function enumerate(cards,length,divisor){
  const answers=[];
  function walk(prefix,remaining){
    if(prefix.length===length){const n=Number(prefix);if(conditions(divisor).every(d=>n%d===0))answers.push(prefix);return;}
    for(let i=0;i<remaining.length;i++){const d=remaining[i];if(!prefix&&d===0)continue;walk(prefix+d,remaining.filter((_,j)=>j!==i));}
  }
  walk('',cards);return answers;
}
export function generateRound(divisor,length,random=Math.random){
  for(let attempt=0;attempt<100;attempt++){
    const pool=Array.from({length:10},(_,i)=>i);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const cards=pool.slice(0,5),solutions=enumerate(cards,length,divisor);
    if(solutions.length>=3)return {cards,solutions};
  }
  const cards=[0,2,3,5,7];return {cards,solutions:enumerate(cards,length,divisor)};
}
export function checkAnswer(raw,cards,length,divisor,accepted=[]){
  const value=raw.trim();
  if(!/^\d+$/.test(value))return {ok:false,message:'請用數卡上的數字組數。'};
  if(value.length!==length)return {ok:false,message:`這回合要組成${length===3?'三':'四'}位數，請使用 ${length} 張數卡。`};
  if(value[0]==='0')return {ok:false,message:'首位不能是 0。試試把 0 放在其他位置。'};
  const used=new Set();
  for(const digit of value){if(!cards.includes(Number(digit)))return {ok:false,message:`這組數卡沒有 ${digit}，請使用畫面上的數卡。`};if(used.has(digit))return {ok:false,message:`${digit} 這張數卡用了兩次，每個答案中每張卡只可用一次。`};used.add(digit);}
  if(accepted.includes(value))return {ok:false,message:'這個答案已經記錄了。試試換個排列，找另一個答案。'};
  const n=Number(value);
  const failed=conditions(divisor).filter(d=>n%d!==0);
  if(failed.length)return {ok:false,message:`${value} 不能被 ${failed.join('、')} 整除。${conditions(divisor).length===2?'兩項條件都要符合。':''}再想一想，或查看提示。`};
  return {ok:true,value,quotient:n/conditions(divisor)[0],message:`答對了！${conditions(divisor).map(d=>`${value} ÷ ${d} = ${n/d}`).join('；')}，都沒有餘數。`};
}
export function observation(cards,length,divisor,example){
  const ds=conditions(divisor),endConditions=ds.filter(d=>d!==3);
  const end=endConditions.length?`這組數卡中的 ${cards.filter(d=>endConditions.every(c=>d%c===0)).join('、')} 可以放在個位。`:'';
  if(ds.includes(3)){const digits=[...example].map(Number);return `${end}可以先選 ${digits.join('、')} 這 ${length===3?'三':'四'}張卡。${digits.join(' + ')} = ${digits.reduce((a,b)=>a+b,0)}，總和能被 3 整除。它們可以怎樣排列？`;}
  return `${end}先選好最後一張卡，再選其他數卡放在前面。`;
}
export function workedExample(value,divisor){
  const ds=conditions(divisor),proof=ds.includes(3)?`各位數字相加：${[...value].join(' + ')} = ${[...value].reduce((sum,d)=>sum+Number(d),0)}。`:'';
  return `例如 ${value}。${proof}${ds.map(d=>`${value} ÷ ${d} = ${Number(value)/d}`).join('；')}，沒有餘數。換個排列，你能找出另一個答案嗎？`;
}
