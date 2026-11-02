export const DEATH_CAUSES=['attack','shortage','search','deadline','health'];
export function markDead(person,cause='health'){
 if(person.dead)return false;
 person.health=0;person.dead=true;person.deathCause=cause;person.deadline=null;person.extended=false;person.stamina=0;return true;
}
export function deathReason(person){
 const name=person.id==='hero'?'主角':person.name;
 const cause=person.deathCause||(person.health<=0?'health':'deadline');
 return {attack:`${name}受到攻击，健康归零。`,shortage:`${name}因食物或净水不足，健康归零。`,search:`${name}搜索受伤，健康归零。`,deadline:`${name}未能在重伤期限内获救治。`,health:`${name}健康归零。`}[cause]||`${name}已死亡。`;
}
