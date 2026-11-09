import {makeRobot,defaultRobotPlan} from './robots.js';

// Explicit test preset only: the ordinary campaign and night schedule stay intact.
export function prepareRobotDemo(state){
 state.testScenario='robots';state.people[0].nightRole='sleep';
 const workshop=state.buildings.find(b=>b.type==='workshop');workshop.level=2;workshop.branch='steady';
 const routes={repair:['left','gate','right','backRight','backLeft'],defense:['right','gate','left','backLeft','backRight'],dispatch:['gate','backLeft','right','backRight','left']};
 for(const type of ['repair','defense','dispatch']){const r=makeRobot(state,type);r.plan={...defaultRobotPlan(),route:routes[type],wait:type==='defense'?10:1,repairBelow:85,materials:18};state.robots.push(r);}
 for(const z of state.zones)z.bell=true;
 state.zones.find(z=>z.id==='gate').hp=42;
 state.logs.push('机器人演示：正门受损，三台机器按规划协作；6秒左栏、30秒右栏、54秒正门、78秒后左栏来敌。主角在屋内休息。');
}
export function configureRobotDemoBattle(base,b){
 if(base.testScenario!=='robots')return;
 b.boss=null;b.challenge=null;b.autoPause=false;
 b.schedule=[{at:6,type:'walker',zone:'left'},{at:30,type:'walker',zone:'right'},{at:54,type:'walker',zone:'gate'},{at:78,type:'walker',zone:'backLeft'}];
 b.reason='三类机器人演示已就绪。点击继续：先修正门，6秒后左栏铃响，观察调度与防卫。';
 b.log.push('演示只使用真实巡逻、视野、铃绳、修补和攻击规则。可暂停查看；夜间模式与巡逻规划已锁定，刷新重开。');
}
