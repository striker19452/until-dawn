import { createBattle, stepBattle, battleCommand } from './battle.js';
import { settleNight } from './campaign.js';

export const localNightId=base=>`local-${base.runId}-${base.revision}`;

// No network, storage or wall-clock catch-up. The worker owns the entire night,
// including food, injuries, challenges and the final result.
export function createLocalNight(base,{now=()=>performance.now(),emit=()=>{}}={}){
 const battle=createBattle(base.state,localNightId(base));
 let last=now(),accumulator=0,speed=1,lastSent=-Infinity,result=null,steps=0;
 const seen=new Map();
 function publish(){if(battle.finished&&!result)result=settleNight(base.state,battle);emit({type:'state',battle,result,steps});lastSent=now();}
 function tick(){const time=now(),dt=Math.max(0,Math.min(.25,(time-last)/1000));last=time;
  if(battle.paused||battle.finished){accumulator=0;return;}
  accumulator+=dt*speed;
  while(accumulator>=.05&&!battle.paused&&!battle.finished){stepBattle(battle,.05);accumulator-=.05;steps++;}
  if(battle.paused||battle.finished)accumulator=0;
  if(time-lastSent>=100||battle.paused||battle.finished)publish();
 }
 function command(action,id){
  if(id&&seen.has(id)){if(seen.get(id)!==JSON.stringify(action))throw Error('同一指令编号不能用于不同操作。');return;}
  if(action.type==='speed'){if(![.5,1,2].includes(action.value))throw Error('速度无效。');speed=action.value;}
  else battleCommand(battle,action);
  if(id){seen.set(id,JSON.stringify(action));if(seen.size>600)seen.delete(seen.keys().next().value);}
  last=now();if(battle.paused)accumulator=0;publish();
 }
 publish();
 return {tick,command,publish,get battle(){return battle;},get result(){return result;},get steps(){return steps;}};
}
