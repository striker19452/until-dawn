import test from 'node:test';
import assert from 'node:assert/strict';
import { artPoint,structureState,unitOccluders,unitOcclusionLayers,fenceProjection,projectSurfacePoint,unprojectSurfacePoint } from '../client/scene-layout.js';

const house={id:'house',depth:282,occludes:true,polygon:[{x:130,y:120},{x:350,y:120},{x:350,y:282},{x:130,y:282}]};
const body=(x,y)=>({left:x-15,top:y-65,width:30,height:65});
test('units behind a building get contours, units in front or beside it keep their body',()=>{
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[house]),['house']);
 assert.deepEqual(unitOccluders({x:240,y:310},body(240,310),[house]),[]);
 assert.deepEqual(unitOccluders({x:90,y:215},body(90,215),[house]),[]);
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[{...house,covers:()=>false}]),[],'transparent roof corners do not hide a unit');
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[{...house,occludes:false}]),[],'destroyed structures do not hide units');
});
test('every gate durability transition selects a distinct state and repairs restore it',()=>{
 assert.deepEqual([100,99,35,0,20,100].map(hp=>structureState(hp,100)),['intact','damaged','damaged','destroyed','damaged','intact']);
 assert.equal(structureState(120,120),'intact');
});
test('independent fence anchors match the clean background openings and retain the front gate',()=>{
 assert.deepEqual(artPoint({x:240,y:475}),{x:240,y:468});
 assert.deepEqual(artPoint({x:145,y:170}),{x:168.75,y:126});
 assert.deepEqual(artPoint({x:335,y:170}),{x:311.25,y:126});
});

test('side wall projection preserves vertical posts and maps alpha samples back to their source',()=>{
 for(const [zone,expected] of [['left',{x:5,y:-35}],['right',{x:5,y:15}]]){
  const projection=fenceProjection(zone),top=projectSurfacePoint({x:25,y:-10},projection),foot=projectSurfacePoint({x:25,y:0},projection);
  assert.deepEqual(top,expected);assert.equal(top.x,foot.x);assert.equal(foot.y-top.y,10);
  assert.deepEqual(unprojectSurfacePoint(expected,projection),{x:25,y:-10});
 }
 assert.equal(fenceProjection('backLeft'),null);
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[{...house,depthAt:()=>180}]),[],'sloping wall uses its local baseline instead of the center depth');
});

test('a thin side panel between body probes still reveals the obstructed unit',()=>{
 const panel={id:'left-door',occludes:true,depth:282,polygon:[{x:243,y:150},{x:245,y:150},{x:245,y:270},{x:243,y:270}],covers:p=>p.y>155};
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[panel]),['left-door']);
 assert.deepEqual(unitOccluders({x:240,y:215},body(240,215),[{...panel,covers:()=>false}]),[]);
});

test('partial occlusion includes tiny body overlaps and clips side walls by each column depth',()=>{
 const corner={...house,polygon:[{x:254,y:200},{x:260,y:200},{x:260,y:220},{x:254,y:220}]};
 assert.deepEqual(unitOcclusionLayers({x:240,y:215},body(240,215),[corner]).map(c=>c.id),['house'],'even a narrow hand overlap needs a pixel mask');
 const sloping={...house,depth:200,depthAt:p=>200+(p.x-240)*5};
 assert.deepEqual(unitOcclusionLayers({x:240,y:215},body(240,215),[sloping]).map(c=>c.id),['house'],'the right-hand columns can be in front while the center is behind');
 assert.deepEqual(unitOcclusionLayers({x:240,y:310},body(240,310),[house]),[]);
 assert.deepEqual(unitOcclusionLayers({x:90,y:215},body(90,215),[house]),[]);
});
