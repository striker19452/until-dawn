import {bossStatus} from '../src/bosses.js';
import {ZONES} from '../src/content.js';
import {createSprayArc,sprayPoint} from './quencher-spray.js';
import {BOSS_TWIN_FORMS} from '../src/boss-content.js';

const clamp=n=>Math.max(0,Math.min(1,n));
function ring(g,x,y,w,h,color,alpha=.8,line=2){g.lineStyle(line,color,alpha);g.strokeEllipse(x,y,w,h);}
function particles(g,p,t,color,count=9,radius=27,alpha=.8){
 for(let i=0;i<count;i++){const a=i*Math.PI*2/count,travel=(t+i*.137)%1;
  g.fillStyle(color,alpha*(1-travel));g.fillCircle(p.x+Math.cos(a)*radius*travel,p.y+Math.sin(a)*radius*travel*.45-travel*9,1.2+i%3*.6);
 }
}
function shock(g,p,age,color,reduced){
 const progress=reduced?.55:clamp(age/.9),fade=1-clamp(age/1.2);
 ring(g,p.x,p.y,28+progress*105,10+progress*38,color,fade,3);
 ring(g,p.x,p.y,15+progress*62,6+progress*23,0xffeed0,fade*.65,1);
 for(let i=0;i<10;i++){const angle=i*Math.PI/5,r=12+progress*(24+i%3*12);
  const x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r*.38-Math.sin(progress*Math.PI)*15;
  g.fillStyle(i%2?color:0xd2bb91,fade*.85);g.fillRect(x,y,3+i%2*2,2);
 }
}
export function drawBossFeedback(g,b,tokens,toArt,t,reduced,text,used,ground=g){
 const state=bossStatus(b);if(!state)return null;
 const objects=b.enemies.filter(e=>e.boss||e.bossBrood).map(e=>({e,obj:tokens.get('e-'+e.id)})).filter(q=>q.obj);
 const mother=objects.find(q=>q.e.boss),visuals=[],links=[];let siphon=null;
 for(const {e,obj}of objects){
  const v=obj.bossVisual;if(!v)continue;const {cx:x,cy:y,width:w,height:h}=v,foot=y+h*.48;
  ground.fillStyle(0x151b1a,e.bossDormant?.18:.32);ground.fillEllipse(x,foot,w*.68,h*.16);
  if(obj.moving&&!reduced){for(let i=0;i<3;i++){const a=(t*1.5+i/3)%1;ground.fillStyle(0xb6a17d,(1-a)*.22);ground.fillEllipse(x+(i-1)*w*.21,foot+a*7,7+a*13,3+a*5);}}
  visuals.push({id:e.id,phase:v.phase,roll:v.roll,center:{x,y},foot,weakPoint:null});
  if(e.bossBrood)continue;
  if(state.phase==='exposed'){
   const pulse=reduced?.6:(Math.sin(t*7)+1)/2,belly={x:x+(e.type==='bastion'?w*.04:0),y:y-h*.08};
   const weak=visuals.at(-1);weak.weakPoint=belly;
   if(e.type==='bastion'&&v.roll>.65){
    // Lit, segmented underside follows the overturned body, with scrambling legs.
    g.fillStyle(0x783c24,.65*v.roll);g.fillEllipse(belly.x,belly.y,w*.36,h*.28);
    g.fillStyle(0xf3ba71,(.55+pulse*.16)*v.roll);g.fillEllipse(belly.x,belly.y,w*.31,h*.23);
    g.lineStyle(1.4,0x6b402b,.85);for(let i=-2;i<=2;i++)g.lineBetween(belly.x+i*w*.05,belly.y-h*.085,belly.x+i*w*.05+3,belly.y+h*.085);
    if(!reduced)for(let i=0;i<3;i++){const dx=(i-1)*w*.22,wiggle=Math.sin(t*12+i*2)*4;g.lineStyle(2.5,0xd6b682,.85);g.lineBetween(x+dx,y-h*.27,x+dx+wiggle,y-h*.42-3);}
   }
   ring(g,belly.x,belly.y,w*.4+pulse*5,h*.32+pulse*3,0xffdf8e,.8,2.4);
   particles(g,belly,reduced?.4:t*.6,0xffdf94,6,26,.7);
   text('boss-weak-'+e.id,e.type==='bastion'?'翻倒露腹 · 伤害×1.5':'脱膜虚弱 · 伤害×1.5',x,y-h*.5-38,0xffd994,used,11);
  }
  if(state.phase==='charge'&&e.mode==='attack'){
   const p=toArt(ZONES.find(z=>z.id===e.zone)),progress=clamp(state.progress);
   const start={x,y:y-h*.4};
   g.lineStyle(3,0xef9860,.4+progress*.4);g.lineBetween(start.x,start.y,p.x,p.y+13);
   ring(ground,p.x,p.y+14,48+progress*34,16+progress*12,0xffab6f,.6+progress*.3,2.5);
   for(let i=0;i<3;i++){const f=(i+(reduced?.5:t*2%1))/4,q={x:start.x+(p.x-start.x)*f,y:start.y+(p.y+13-start.y)*f};
    g.lineStyle(2,0xffc380,.75);g.lineBetween(q.x-5,q.y+4,q.x,q.y-2);g.lineBetween(q.x,q.y-2,q.x+5,q.y+4);
   }
   if(progress>.65)particles(g,{x,y:foot},reduced?.4:t*2,0xc4a27c,8,32,.8);
  }
  if(e.type==='broodmother'&&state.phase!=='exposed'){
   const pulse=reduced?.6:(Math.sin(t*4)+1)/2,egg={x:x+(obj.sprite.flipX?-1:1)*w*.13,y:y+h*.1};
   g.fillStyle(0xc5ecab,.1+pulse*.1);g.fillEllipse(egg.x,egg.y,w*.42,h*.47);
   for(let i=0;i<3;i++){const dx=(i-1)*w*.08;ring(g,egg.x+dx,egg.y,9+pulse*2,14+pulse*3,0xe4f2ac,.4+pulse*.35,1);}
   particles(g,{x,y:y-h*.3},reduced?.3:t*.4,0xcfea9d,7,30,.6);
  }
  if(e.type==='cinderwhale'&&state.phase==='siphon'){
   const p=clamp(state.progress),pulse=reduced?.5:(Math.sin(t*9)+1)/2;
   g.fillStyle(0xf9b75f,.1+p*.16);g.fillEllipse(x,y,w*(.25+p*.12),h*.55);
   ring(g,x,y,w*.31,h*.5,0xffce77,.3+p*.55,1.6);
   if(p>.7)particles(g,{x,y},reduced?.4:t*1.5,0xffd88b,9,40,.9);
  }
  if(e.type==='twinvein'){
   const colors=e.bossForm>0?[BOSS_TWIN_FORMS[e.bossForm-1].color]:BOSS_TWIN_FORMS.map(f=>f.color);
   for(const [i,color]of colors.entries()){const px=x+(i-(colors.length-1)/2)*w*.24,pulse=reduced?.5:(Math.sin(t*5+i*Math.PI)+1)/2;
    g.fillStyle(color,e.bossDormant?.06:.15+pulse*.15);g.fillCircle(px,y,8+pulse*4);ring(g,px,y,13+pulse*5,17+pulse*6,color,e.bossDormant?.25:.9,1.6);
   }
  }
 }
 for(const m of state.mounds){
  const p=toArt(ZONES.find(z=>z.id===m.zone)),progress=clamp(1-m.left/8),pulse=reduced?.5:(Math.sin(t*(4+progress*6))+1)/2,size=22+progress*16;
  ground.fillStyle(0x344335,.7);ground.fillEllipse(p.x,p.y,size*1.9,size*.7);
  ground.fillStyle(0x87915e,.65);ground.fillEllipse(p.x,p.y-2,size*1.45,size*.65);
  ring(g,p.x,p.y,size*1.7+pulse*4,size*.7,0xdce6a3,.55+pulse*.4);
  g.lineStyle(2,0xe1edaa,.9);for(let i=-1;i<=1;i++){g.lineBetween(p.x+i*10-5,p.y+3,p.x+i*10,p.y-7-progress*5);g.lineBetween(p.x+i*10,p.y-7-progress*5,p.x+i*10+6,p.y-2);}
  particles(g,{x:p.x,y:p.y-5},reduced?.4:t*.65,0xdcea9d,7,size,.8);
  if(mother){const v=mother.obj.bossVisual;if(v){g.lineStyle(1.2,0xc3dba2,.26);g.lineBetween(v.cx,v.cy,p.x,p.y);}}
  text('boss-mound-'+m.id,`鼓包 ${m.left.toFixed(1)}秒`,p.x,p.y-26-progress*4,0xe4edb2,used,11);
 }
 if(state.phase==='siphon'&&mother){
  const f=b.fires.find(f=>f.id==='central'),v=mother.obj.bossVisual;
  if(f&&v){const a=toArt(f),mouth={x:v.cx+(mother.obj.sprite.flipX?1:-1)*v.width*.39,y:v.cy-v.height*.04};
   siphon={enemyId:mother.e.id,source:{x:a.x,y:a.y-17},mouth};
   const arc=createSprayArc(siphon.source,mouth);g.lineStyle(7,0xe99a50,.12+state.progress*.1);g.beginPath();g.moveTo(arc.start.x,arc.start.y);
   for(let i=1;i<=24;i++){const q=sprayPoint(arc,i/24);g.lineTo(q.x,q.y);}g.strokePath();
   g.lineStyle(1.6,0xffd88c,.7);g.beginPath();g.moveTo(arc.start.x,arc.start.y);for(let i=1;i<=24;i++){const q=sprayPoint(arc,i/24);g.lineTo(q.x,q.y);}g.strokePath();
   for(let i=0;i<10;i++){const f=reduced?i/10:(t*.7+i/10)%1,q=sprayPoint(arc,f);g.fillStyle(i%2?0xffdd97:0xf4a34f,.9);g.fillCircle(q.x,q.y,1.7+f*1.6);}
   ring(g,mouth.x,mouth.y,14,12,0xffdc9a,.85);
  }
 }
 const twins=objects.filter(q=>q.e.boss);
 if(state.id==='twinvein'&&b.boss.split&&twins.length>1){
  for(let first=0;first<twins.length;first++)for(let second=first+1;second<twins.length;second++){
   const a=twins[first].obj.bossVisual,c=twins[second].obj.bossVisual;if(!a||!c)continue;
   links.push({from:twins[first].e.id,to:twins[second].e.id});
   for(const [j,color]of [BOSS_TWIN_FORMS[twins[first].e.bossForm-1].color,BOSS_TWIN_FORMS[twins[second].e.bossForm-1].color].entries()){
    g.lineStyle(state.downLeft!==null?2.3:1.5,color,.6);g.beginPath();g.moveTo(a.cx,a.cy);
    for(let i=1;i<=30;i++){const f=i/30,wave=reduced?0:Math.sin(f*Math.PI*4+t*4+j*Math.PI)*Math.sin(f*Math.PI)*6;g.lineTo(a.cx+(c.cx-a.cx)*f,a.cy+(c.cy-a.cy)*f+wave);}g.strokePath();
    for(let i=0;i<4;i++){const f=reduced?(i+.5)/4:(t*.4+i/4+j*.1)%1;g.fillStyle(color,.9);g.fillCircle(a.cx+(c.cx-a.cx)*f,a.cy+(c.cy-a.cy)*f,2.2);}
   }
  }
  const points=twins.map(q=>q.obj.bossVisual).filter(Boolean);
  if(state.downLeft!==null&&points.length)text('boss-link',`同灭窗口 ${state.downLeft.toFixed(1)}秒`,points.reduce((n,p)=>n+p.cx,0)/points.length,points.reduce((n,p)=>n+p.cy,0)/points.length-16,0xffd994,used,11);
 }
 for(const event of b.events){
  const age=t-event.time;if(age<0||age>1.2||!event.type.startsWith('boss-'))continue;
  const victim=objects.find(q=>q.e.id===event.enemyId),v=victim?.obj.bossVisual;
  const p=event.type==='boss-impact'?toArt(event.target||ZONES.find(z=>z.id===event.zone)):v?{x:v.cx,y:v.cy+v.height*.4}:toArt(event);
  if(['boss-impact','boss-break','boss-hatch','boss-burst','boss-split','boss-down','boss-revive','boss-defeat'].includes(event.type)){
   const color=event.type==='boss-burst'?0xffbb69:event.type==='boss-split'||event.type==='boss-revive'?0xc4b4eb:event.type==='boss-hatch'?0xd2e3a1:0xf2d19a;
   shock(g,p,age,color,reduced);
   if(event.type==='boss-burst'&&event.target){const target=toArt(event.target);shock(g,target,Math.max(0,age-.2),0xf4bd72,reduced);}
  }
 }
 return {...state,visuals,siphon,links};
}
