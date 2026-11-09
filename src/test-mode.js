import {prepareRobotDemo} from './robot-demo.js';
import {initialCampaign,applyCampaignAction,makePerson,normalizeCampaign,RuleError} from './campaign.js';
import {ROLES,COMPANIONS,ZONES} from './content.js';
import {bossForDay} from './boss-content.js';
import {BUILDING_MAX_HP} from './building-health.js';
import {validateClientResult} from './client-result.js';
import {makeRobot} from './robots.js';

export const TEST_PRESETS={solo:'单人小院',crew:'五人小院','solo-robots':'单人 4 机器人',robots:'三类机器人演示'};
export function createTestSession({day,role='watchman',preset='crew',seed=417,id='local'}={}){
 if(!Number.isInteger(day)||day<1||day>28)throw new RuleError('测试关卡须为第1～28夜。');
 if(!Object.hasOwn(ROLES,role)||!Object.hasOwn(TEST_PRESETS,preset))throw new RuleError('请选择有效的测试职业和小院预设。');
 let state=applyCampaignAction(initialCampaign(seed),{type:'chooseRole',role});state.day=day;state.ap=6;state.beds=5;
 state.resources={food:80,water:80,materials:120,fuel:30,medicine:20,parts:20};state.house=100;
 state.zones.forEach(z=>Object.assign(z,{hp:100,traps:0,spikes:false,mesh:false,bell:false}));
 if(preset==='crew')for(const c of COMPANIONS.slice(0,4)){const p=makePerson(c.id,c.name,c.role,c.skill);p.story=1;p.joinedDay=day;state.people.push(p);state.flags.invited.push(c.id);}
 const mainZone=bossForDay(day)?.zone||'gate',zones=[mainZone,...ZONES.map(z=>z.id).filter(id=>id!==mainZone)];
 state.people.forEach((p,i)=>{p.fear=0;p.zone=zones[i];p.nightRole=p.id==='zhou'||p.id==='xu'?'support':'guard';});
 state.buildings=['garden','water','workshop','stove'].map((type,plot)=>({id:`test-${type}`,type,plot,level:1,age:0,branch:'normal',enabled:true,hp:BUILDING_MAX_HP}));
 state.flags.route='road';state.flags.campfireWood=1;state.logs=[`测试模式 · 第${day}夜 · ${TEST_PRESETS[preset]}`];
 if(preset==='robots')prepareRobotDemo(state);
 if(preset==='solo-robots'){
  Object.assign(state.buildings.find(b=>b.type==='workshop'),{level:2,branch:'steady'});
  for(const z of state.zones)z.bell=true;
  const patrols=[
   ['repair',['gate','left','backLeft','backRight','right']],
   ['defense',['left','backLeft','backRight','right','gate']],
   ['defense',['right','backRight','backLeft','left','gate']],
   ['dispatch',['backLeft','backRight','right','gate','left']],
  ];
  for(const [type,route] of patrols){
   const robot=makeRobot(state,type);
   robot.plan.route=route;
   state.robots.push(robot);
  }
 }
 const dawn=normalizeCampaign(structuredClone(state));state=applyCampaignAction(state,{type:'prepare'});
 return {options:{day,role,preset,seed},dawn,snapshot:{runId:`test-${id}`,revision:0,state}};
}

// These operations never receive a formal save, database, or network callback.
export function testAction(session,action){
 const current=session.snapshot.state;let state;
 if(action.type==='restart')throw new RuleError('请使用“重开本关”重新测试。');
 if(action.type==='retryDay'){
  if(!['report','failed','rescued'].includes(current.phase))throw new RuleError('夜战结束后才能重试当天。');
  state=normalizeCampaign(structuredClone(session.dawn));state.phase='day';
 }else state=applyCampaignAction(current,action);
 return {...session,dawn:action.type==='nextDay'?structuredClone(state):session.dawn,snapshot:{...session.snapshot,state,revision:session.snapshot.revision+1}};
}

export function finishTestNight(session,result){
 if(session.snapshot.state.phase!=='ready')throw new RuleError('测试夜战已经结算。');
 const state=validateClientResult(session.snapshot.state,structuredClone(result));
 return {...session,snapshot:{...session.snapshot,state,revision:session.snapshot.revision+1}};
}
