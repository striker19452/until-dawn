import {PRODUCTION} from '../src/balance.js';
import {weather} from '../src/content.js';
import {facilityOutput} from '../src/rules.js';
import {buildingOperational} from '../src/building-health.js';

export function gardenStatus(b,s){
 if(!buildingOperational(b))return '菜畦已损毁，生长与收获暂停；重建后重新播种。';
 const age=b.age||0,output=facilityOutput(b,weather(s.day,s.seed));
 if(s.dayProduced)return age===0?'今日黄昏已收获，食物已入库；新一轮生长从明日开始。':`今日黄昏已生长，尚未成熟；还需${PRODUCTION.garden.cycle-age}次黄昏自动收获。`;
 return age>=PRODUCTION.garden.cycle-1?`今日准备入夜时自动收获：食物 +${output}（按今日天气）。`:`生长中：还需${PRODUCTION.garden.cycle-age===2?'两':PRODUCTION.garden.cycle-age}次黄昏结算；今日准备入夜只生长，不收获。按今日天气，每次收获食物 +${output}。`;
}

export function gardenHarvestSummary(s){
 // Read the saved production receipts, so later facility damage cannot change
 // the amount that was actually harvested before the night.
 const harvests=(s.jobGains||[]).map(line=>/^菜畦收获(\d+)食物$/.exec(line)).filter(Boolean);
 if(!s.dayProduced||!harvests.length)return '';
 return `今日菜畦收成：食物 +${harvests.reduce((sum,m)=>sum+Number(m[1]),0)} · ${harvests.length}块菜畦已收获入库。`;
}
