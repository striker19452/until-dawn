import test from 'node:test';import assert from 'node:assert/strict';
import {creatureActionAim,facingToward,facingFlip,SPRAY_FACING_SECONDS} from '../client/creature-facing.js';
import {animateBoss} from '../client/boss-motion.js';
const battle=()=>({elapsed:10,events:[],people:[{id:'hero',x:160,y:410,dead:false}],indoorPeople:{},fires:[{id:'central',x:240,y:390}],boss:null});
const enemy=(extra={})=>({id:'one',type:'quencher',x:400,y:310,mode:'attack',zone:'right',progress:2,hp:100,stun:0,...extra});

test('a stationary quencher faces the real fire while winding up, regardless of its earlier movement',()=>{
 for(const [x,expected]of [[70,1],[400,-1]]){const b=battle(),e=enemy({x}),aim=creatureActionAim(b,e);assert.equal(aim.reason,'spray-windup');assert.equal(aim.id,'central');assert.equal(aim.x,240);assert.equal(facingToward(e,aim,-expected),expected);}
 const e=enemy({mode:'approach'});assert.equal(creatureActionAim(battle(),e),null);
});

test('an emitted spray keeps its launch direction through flight, then yields to a new close-range target',()=>{
 const b=battle(),e=enemy({mode:'inside',attackTarget:{kind:'person',id:'hero'}});b.people[0].x=450;b.events=[{type:'wet',enemyId:'one',targetId:'central',x:240,y:390,time:10}];
 const aim=creatureActionAim(b,e,10.4);assert.equal(aim.reason,'spray');assert.equal(facingToward(e,aim,1),-1);b.fires[0].x=500;assert.equal(creatureActionAim(b,e,10.4).x,240,'a launched glob keeps the actual event destination');assert.equal(SPRAY_FACING_SECONDS,1.1);
 const later=creatureActionAim(b,e,11.2);assert.equal(later.reason,'melee');assert.equal(facingToward(e,later,-1),1);
 e.stun=2;assert.equal(creatureActionAim(b,e,10.4).reason,'spray');e.hp=0;assert.equal(creatureActionAim(b,e,10.4),null);
});

test('all ordinary and boss bodies face their single person target, including a changed target across the body',()=>{
 for(const type of ['walker','climber','rammer','caller','burrower','quencher','skitter','bastion','broodmother','cinderwhale','twinvein']){
  const b=battle(),e=enemy({type,mode:'inside',attackTarget:{kind:'person',id:'hero'}});assert.equal(facingToward(e,creatureActionAim(b,e),1),-1,type);b.people[0].x=450;assert.equal(facingToward(e,creatureActionAim(b,e),-1),1,type);b.indoorPeople.hero=true;assert.equal(creatureActionAim(b,e),null,type);
 }
});

test('melee impacts and demolition use the actual target, while travelling uses movement facing',()=>{
 const b=battle(),e=enemy({mode:'inside',attackTarget:{kind:'structure',id:'garden'},targetPoint:{x:380,y:310}});assert.equal(creatureActionAim(b,e).reason,'demolish');assert.equal(facingToward(e,creatureActionAim(b,e),1),-1);e.targetPoint.x=300;assert.equal(creatureActionAim(b,e),null);
 b.events=[{type:'enemy-hit',enemyId:'one',targetKind:'structure',targetId:'garden',x:450,y:320,time:10}];assert.equal(creatureActionAim(b,e).reason,'impact');assert.equal(facingToward(e,creatureActionAim(b,e),-1),1);assert.equal(creatureActionAim(b,e,11),null);
});

test('wall attacks and climbing or digging look into the relevant surface from both sides',()=>{
 for(const [zone,x,y,face]of [['left',70,310,1],['right',410,310,-1],['backLeft',145,170,1],['backRight',335,170,-1]])for(const type of ['walker','climber','burrower','rammer','bastion']){const b=battle(),e=enemy({zone,x,y,type});const a=creatureActionAim(b,e);assert.equal(a.reason,'wall');assert.equal(facingToward(e,a,-face),face);}
});

function object(facing,actionFacing){const sprite={displayWidth:156,displayHeight:100,scaleX:1,scaleY:1,setFlipX(v){this.flipX=v;return this;},setOrigin(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y){this.scaleX=x;this.scaleY=y;return this;},setAngle(){return this;},setAlpha(){return this;}};return {sprite,x:400,y:310,facing,actionFacing,baseFacing:-1,moving:false};}
test('siphon aims at the actual fire and the boss pose no longer overrides action-facing with zone-facing',()=>{
 const b=battle();b.boss={phase:'siphon',clock:2};const e=enemy({type:'cinderwhale',boss:true,zone:'left'}),aim=creatureActionAim(b,e);assert.equal(aim.reason,'siphon');const o=object(1,facingToward(e,aim,1));animateBoss(o,b,e,10,true);assert.equal(o.sprite.flipX,false);assert.equal(o.bossVisual.facing,-1);
 b.fires[0].x=450;const right=object(-1,facingToward(e,creatureActionAim(b,e),-1));animateBoss(right,b,e,10,true);assert.equal(right.sprite.flipX,true);assert.equal(right.bossVisual.facing,1);
 b.boss.phase='exposed';assert.equal(creatureActionAim(b,e),null);const moving=object(-1,null);e.mode='inside';animateBoss(moving,b,e,10,true);assert.equal(moving.sprite.flipX,false);
});

test('mirrored art sheets use their own natural facing and near-vertical targets do not jitter',()=>{
 for(const base of [undefined,1,-1])for(const face of [-1,1])assert.equal(facingFlip(base,face),base===-1?face===1:face===-1);
 assert.equal(facingToward({x:240},{x:241},-1),-1);assert.equal(facingToward({x:240},{x:239},1),1);assert.equal(facingToward({x:240},{x:243},-1),1);assert.equal(facingToward({x:240},null,-1),-1);
});

test('ordinary control and dormant boss poses are not turned by a stale target',()=>{
 for(const extra of [{stun:1},{bossDormant:true},{hp:0}])assert.equal(creatureActionAim(battle(),enemy(extra)),null);
});
