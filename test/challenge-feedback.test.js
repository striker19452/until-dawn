import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyChallenge,challengeProblems,challengeRequirements,resolveChallenge} from '../src/challenges.js';
const fixture=()=>({house:100,zones:[{id:'left',hp:54},{id:'right',hp:65}],challenge:{...dailyChallenge({day:2,flags:{}}),broken:[],newSevere:0,newDeaths:0}});
test('night two distinguishes repairable low durability from irreversible breach and injury',()=>{
 const b=fixture();assert.deepEqual(challengeProblems(b),[{text:'左栏耐久54，需至少55（还差1）',permanent:false}]);
 b.zones[0].hp=55;assert.deepEqual(challengeProblems(b),[]);
 b.challenge.broken=['right'];b.challenge.newSevere=1;
 const problems=challengeProblems(b);assert.equal(problems.length,2);assert.ok(problems.every(p=>p.permanent));
 assert.match(problems[1].text,/右栏曾被打穿/);assert.match(problems[0].text,/急救后也无法撤销/);
 resolveChallenge(b);assert.equal(b.challenge.status,'missed');assert.match(b.challenge.feedback,/右栏曾被打穿/);assert.match(b.challenge.feedback,/新增重伤/);
});
test('night two final feedback names each side below the required durability',()=>{
 const b=fixture();b.zones[1].hp=50;resolveChallenge(b);
 assert.equal(b.challenge.status,'missed');assert.match(b.challenge.feedback,/左栏耐久54/);assert.match(b.challenge.feedback,/右栏耐久50/);assert.match(b.challenge.feedback,/还差5/);
 b.zones.forEach(z=>z.hp=55);resolveChallenge(b);assert.equal(b.challenge.status,'cleared');
});
test('night three states the exclusion rule separately from advice and tracks even a cleared intrusion',()=>{
 const c=dailyChallenge({day:3,flags:{}}),b={house:100,challenge:{...c,spawned:1,entered:0,broken:[],newSevere:0,newDeaths:0},zones:[]};
 const rules=challengeRequirements(c).join('');
 assert.match(rules,/后左栏 · 攀爬者.*不能入院/);assert.match(rules,/入院即失败，之后击退也不算/);
 assert.match(rules,/无人死亡/);assert.match(rules,/急救不能撤销/);assert.match(rules,/不是撑满固定时间/);
 assert.match(c.hint,/到达后左栏后.*6秒/);assert.ok(!rules.includes('安装翻刺'));
 resolveChallenge(b);assert.equal(b.challenge.status,'cleared');
 b.challenge.entered=1;resolveChallenge(b);assert.equal(b.challenge.status,'missed');assert.ok(challengeProblems(b).some(p=>p.permanent&&p.text.includes('已入院')));
});
test('every daily challenge has explicit rules including the common survival and clearing conditions',()=>{
 for(let day=1;day<=28;day++){
  const rules=challengeRequirements(dailyChallenge({day,flags:{}}));
  assert.ok(rules.length>=3);assert.ok(rules.every(rule=>rule.length>0&&!rule.includes('undefined')));
 }
});
