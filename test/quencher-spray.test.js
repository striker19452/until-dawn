import test from 'node:test';
import assert from 'node:assert/strict';
import { quencherMouth,createSprayArc,sprayPoint,sprayFrame } from '../client/quencher-spray.js';

test('spray starts at the registered mouth and follows the actual mirrored and rotated sprite',()=>{
 const sprite={frame:{name:'9',cutWidth:362,cutHeight:362},x:220,y:300,originX:.5,originY:.65,scaleX:.25,scaleY:.25,flipX:false,rotation:0};
 const mouth=quencherMouth(sprite);assert.equal(mouth.x,240.5);assert.ok(Math.abs(mouth.y-268.675)<1e-8);
 sprite.flipX=true;const mirrored=quencherMouth(sprite);assert.equal(mirrored.x,199.5);assert.equal(mirrored.y,mouth.y);
 sprite.rotation=Math.PI/2;const rotated=quencherMouth(sprite);assert.ok(Math.abs(rotated.x-(220-(mouth.y-300)))<1e-8);assert.ok(Math.abs(rotated.y-279.5)<1e-8);
});

test('Bezier spray lands on the hearth from every direction and keeps the launch point fixed',()=>{
 for(const start of [{x:80,y:260},{x:390,y:260},{x:170,y:100},{x:310,y:100},{x:240,y:440}]){
  const arc=createSprayArc(start,{x:240,y:370}),original={...start};start.x+=50;
  assert.deepEqual(sprayPoint(arc,0),original);assert.deepEqual(sprayPoint(arc,1),{x:240,y:370});
  assert.ok(arc.control.y<Math.min(arc.start.y,arc.end.y));assert.ok(arc.duration>=.5&&arc.duration<=.95);
  const middle=sprayPoint(arc,.5);assert.ok(middle.y<(arc.start.y+arc.end.y)/2);
 }
});

test('spray has a moving droplet train, then a splash, and is deterministic at a paused game time',()=>{
 const arc=createSprayArc({x:150,y:120},{x:240,y:370});
 const first=sprayFrame(arc,.2),later=sprayFrame(arc,.3);assert.equal(first.phase,'flight');assert.equal(first.drops.length,5);assert.notDeepEqual(first.drops,later.drops);
 assert.deepEqual(sprayFrame(arc,.2),first);assert.ok(first.impactAge<0);
 const impact=sprayFrame(arc,arc.duration);assert.equal(impact.phase,'impact');assert.equal(impact.impactAge,0);assert.deepEqual({x:impact.drops[0].x,y:impact.drops[0].y},arc.end);
 const ended=sprayFrame(arc,arc.duration+.2);assert.equal(ended.drops.length,0);
 const reduced=sprayFrame(arc,.2,true);assert.equal(reduced.phase,'reduced');assert.deepEqual(reduced,sprayFrame(arc,.4,true));
});
