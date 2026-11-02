// Numeric rules shared by simulation and generated help. Keep this module free
// of campaign/content/UI imports so descriptions cannot create an import cycle.
export const CAMPAIGN_RULES={ap:6,maxPeople:5};
export const PRODUCTION={
 garden:{cycle:2,base:3,perLevel:1,yieldBonus:1,rainBonus:1,hotBonus:-1,steady:5},
 water:{base:2,perLevel:1,yieldBonus:0,rainBonus:1,hotBonus:-1,steady:3},
 workshop:{normal:2,yield:3,without:1,cost:2,steadyCost:1},
 generator:{normal:{fuel:1,parts:1,water:1,exposure:1},yield:{fuel:2,parts:2,water:2,exposure:2},steady:{fuel:1,parts:1,water:1,exposure:0}},
 infirmary:{normal:3,yield:6,steady:3,steadyFear:4},
 watchtower:{normal:25,yield:45,steady:35,steadyFog:45,fogFactor:.7},
 stove:{normal:1,yield:2,steady:1,fear:6,mengFear:2,steadyFatigue:6},
 exchange:{limit:2,yieldLimit:3,foodCost:3,materials:4,steadyMaterials:5,medicineCost:4,steadyMedicineCost:3,medicine:1,partsCost:1,food:4,water:2,steadyWater:3}
};
export const RATIONS={baseFood:1,workFood:1,nightFood:1,baseWater:1,hotPeoplePerWater:3,minimumFood:1,cookSavingPerPerson:1,shortageDamage:10};
export const DAY_ACTIONS={
 build:{ap:2},upgrade:{ap:2,cost:{materials:4,parts:1}},beds:{ap:2,cost:{materials:5},steps:[2,3,5]},
 repair:{ap:1,cost:{materials:2},hero:35,companion:25,perSkill:5},
 house:{ap:1,cost:{materials:2},health:30},
 rest:{ap:2,health:10,fatigue:28,fear:22},
 trap:{ap:1,cost:{materials:2},amount:1},fuel:{ap:1,cost:{materials:1},gain:{fuel:3}},
 medicine:{ap:1,cost:{materials:1,water:1,fuel:1},gain:{medicine:1}},
 treatment:{ap:1,medicine:1,severeMedicine:2,discount:1,skill:2,health:30,severeHealth:42,fear:12},
 firstAid:{ap:1,cost:{materials:1,water:1},days:1},dismiss:{food:1,water:1},demolish:{ap:1,recovery:.5}
};
export const WORK={farm:{skill:2,normal:2,skilled:3},water:3,forage:4,careHealth:7,careFear:6,restHealth:5,restFatigue:22,restFear:8,fatigue:10,repairCost:1,scoutRange:12,scoutExposure:1};
export const GROWTH={initial:2,step:.08,max:3,story:.5,guard:.07,guardWork:3};
export const COMBAT={
 strike:{base:7,perSkill:3,stamina:7,minimumStamina:8,progress:3,work:2},
 repair:{health:23,perSkill:3,seconds:5,skillSpeed:.5,maxSkillSpeed:1.5},
 trap:{max:3,damage:18,stun:2,rammerStun:3},
 brace:{minimumStamina:24,finishStamina:18,cooldown:8,fenceFactor:.45},
 throw:{damage:10,stun:2},bait:{seconds:12,range:200,stun:1},compact:{factor:.35,damage:15,stun:4},
 fire:{damageFactor:.7,rammerFactor:.85,climbFactor:.65,stamina:2,normalStamina:1.6,fear:.04},
 spikes:{damage:1.25,rammerDamage:.7},meshClimbFactor:.35,bellRange:18,
 houseDamage:1.8,bossHouseFactor:2,callLimit:2,spray:{protectedLoss:9,loss:18,protectedWet:4,wet:8},
 workStamina:2,sleepFear:.035,severeHealth:20,rescueDays:1
};
export const NIGHT_ACTIONS={
 costs:{repair:{materials:1},barricade:{materials:1},addWood:{materials:1},throw:{materials:1},bait:{food:1}},
 times:{barricade:4,fire:4,stoke:2,addWood:4,extinguish:4,throw:2,bait:3,compact:5,clearWet:4,aid:6},
 aidKitTime:4,hold:8,houseHealth:20
};
export const RECOVERY={morningHealth:4,morningFear:4,workFatigue:.22,maxWorkFatigue:38,nightCalm:8};
export const STORY_RULES={meal:{day:8,ap:1,cost:{food:2},fear:18,mengFear:24,fatigue:12,mengFatigue:16},delegate:{day:10,ap:0,cost:{materials:2}},kit:{day:17,ap:1,cost:{materials:1}},salvage:{day:19,ap:1,cost:{parts:2},gain:{materials:4,fuel:3}},signal:{day:24,ap:1,cost:{fuel:2,parts:1},exposure:2},letter:{day:27,ap:1,cost:{}},personal:{ap:1,fear:15}};
export const EXPOSURE={max:6,extraCap:3,morning:1};
export const CHALLENGE_REWARD={materials:1,fear:4};
export const facilityYield=(b,w)=>{const c=PRODUCTION[b.type];return b.branch==='steady'?c.steady:c.base+(b.level-1)*c.perLevel+(b.branch==='yield'?c.yieldBonus:0)+(w==='rain'?c.rainBonus:w==='hot'?c.hotBonus:0);};
export const generatorOutput=branch=>PRODUCTION.generator[branch]||PRODUCTION.generator.normal;
export const workshopOutput=building=>building?PRODUCTION.workshop[building.branch==='yield'?'yield':'normal']:PRODUCTION.workshop.without;
export const workshopCost=branch=>branch==='steady'?PRODUCTION.workshop.steadyCost:PRODUCTION.workshop.cost;
export const repairHealth=(skill,hero=false)=>DAY_ACTIONS.repair[hero?'hero':'companion']+Math.floor(skill)*DAY_ACTIONS.repair.perSkill;
export const nightRepairHealth=skill=>COMBAT.repair.health+Math.floor(skill)*COMBAT.repair.perSkill;
export const strikeDamage=skill=>COMBAT.strike.base+Math.floor(skill)*COMBAT.strike.perSkill;

export const nightActionCost=(person,type)=>type==='aid'?{medicine:person.skills.medical>=DAY_ACTIONS.treatment.skill?DAY_ACTIONS.treatment.severeMedicine-DAY_ACTIONS.treatment.discount:DAY_ACTIONS.treatment.severeMedicine}:{...(NIGHT_ACTIONS.costs[type]||{})};
export const BOSS_RULES={
 exposedFactor:1.5,exposedStun:1.5,
 bastion:{charge:5,armor:.35,afterHit:7,afterCounter:8,braceStun:1},
 brood:{hatch:8,limit:2,interval:16,sealDamage:16,sealStun:2},
 cinder:{siphon:8,armor:.5,drain:2,afterBurst:8,afterCounter:10},
 twin:{splitRatio:.5,window:12,revives:2,splitStun:1}
};
