export function createScene(root){
 const q=sel=>root.querySelector(sel);let s=null;let paintSeed=9;const design={warmth:70};
 function rand(){paintSeed=(paintSeed*1664525+1013904223)>>>0;return paintSeed/4294967296;}
 function draw(){
 if(!s)return; const canvas=q('#fl-yard'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);if(!w||!h)return;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.scale(w/400,h/286);paintSeed=9;
 const night=['wave1','event','wave2'].includes(s.phase),dusk=s.phase==='dusk';
 const poly=(pts,fill,stroke='#353e31',width=1.4)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const line=(pts,color='#4e5847',width=1)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
 const ellipse=(x,y,rx,ry,fill)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();};
 const wash=c.createLinearGradient(0,0,0,286);wash.addColorStop(0,night?'#273b3b':dusk?'#77786a':'#81917f');wash.addColorStop(1,night?'#29382f':'#65735a');c.fillStyle=wash;c.fillRect(0,0,400,286);
 poly([[0,32],[30,15],[63,32],[96,12],[138,28],[175,8],[216,30],[260,14],[300,35],[350,17],[400,30],[400,80],[0,80]],night?'#253434':'#586a60',null);
 poly([[13,16],[51,16],[53,48],[12,48]],'#4c5d55',null);line([[20,20],[22,39],[43,39]],'#354a43');line([[350,0],[348,74]],'#3a5147',3);line([[320,18],[378,14]],'#344d44',2);line([[0,7],[160,18],[348,16],[400,25]],'#43574f');
 poly([[35,92],[322,70],[382,215],[80,264],[24,217]],night?'#485242':'#869071');
 poly([[37,93],[322,70],[325,85],[39,111]],'#6a6c56');poly([[321,70],[380,205],[368,208],[312,87]],'#6c715a');
 for(let x=45;x<308;x+=17)line([[x,92-(x-45)*.075],[x+1,105-(x-45)*.075]],'#404d3b',2);
 for(let i=0;i<260;i++){const x=35+rand()*330,y=85+rand()*170;c.fillStyle=rand()>.5?'#263b2217':'#f5e3b017';c.fillRect(x,y,1+rand()*5,1+rand()*2);}
 poly([[159,123],[226,115],[267,219],[228,232]],night?'#686b50':'#b8ad82',null);
 for(let i=0;i<22;i++){const x=187+rand()*56,y=139+rand()*92;ellipse(x,y,6,2,'#7f806342');}
 ellipse(185,122,86,18,'#243e3030');
 poly([[116,66],[233,57],[260,113],[139,128]],'#b8af86');poly([[233,57],[260,75],[260,113],[233,115]],'#8c9271');
 poly([[105,66],[165,29],[245,39],[267,75],[178,63]],'#6b6551');poly([[105,66],[178,63],[245,39],[165,29]],'#7c7561');
 for(let i=0;i<12;i++)line([[113+i*9,64-i*.3],[168+i*6,34+i*.5]],'#444e4150');
 line([[108,68],[176,66],[268,77]],'#3e4b3b',3);poly([[148,89],[175,86],[176,121],[149,125]],'#5f6449');
 const glow=(x,y,r)=>{const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,'#edbe6578');g.addColorStop(1,'#e7b45b00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
 glow(210,91,design.warmth*.65);poly([[195,80],[222,78],[223,100],[196,103]],'#e9c17b');line([[208,80],[210,101]],'#796343',2);line([[197,90],[222,88]],'#796343',2);poly([[243,88],[254,90],[254,102],[244,100]],'#d3b76d');
 poly([[220,35],[222,12],[233,12],[236,39]],'#78765f');line([[227,9],[223,2],[230,-4]],'#e1d6b766',5);
 poly([[56,165],[121,150],[145,190],[77,208]],s.garden?'#665b3c':'#6e7557');
 for(let i=0;i<4;i++)line([[63+i*6,169+i*8],[123+i*5,155+i*9]],s.garden?'#a19767':'#526344',3);
 if(s.planted){for(let i=0;i<13;i++){const x=71+rand()*58,y=167+rand()*25;line([[x,y+3],[x,y-3]],'#455c35',2);ellipse(x-2,y-2,3,1,'#84915b');}}
 poly([[283,159],[327,153],[341,171],[293,180]],'#b3a079');line([[295,178],[295,200]],'#5f5d43',4);line([[332,172],[334,192]],'#5f5d43',4);line([[299,165],[319,161]],'#515b45',3);poly([[309,156],[321,153],[322,158],[310,161]],'#7d8871');
 line([[67,126],[107,124],[128,127]],'#5b664f');line([[68,124],[66,145]],'#4c5845',2);line([[127,126],[129,145]],'#4c5845',2);poly([[82,126],[95,127],[96,142],[83,140]],'#b7b19a');poly([[106,126],[117,127],[121,140],[109,140]],'#8b9b88');
 const person=(x,y,coat)=>{ellipse(x,y+12,9,3,'#34483250');poly([[x-6,y-2],[x+5,y-2],[x+7,y+10],[x-7,y+10]],coat);ellipse(x,y-7,4,5,'#c8b58d');line([[x-4,y+10],[x-4,y+15]],'#3a4435',3);line([[x+4,y+10],[x+4,y+15]],'#3a4435',3);};
 person(night?233:188,night?217:157,'#596f5a');if(s.recruited)person(night?267:112,night?211:151,'#939472');
 ellipse(224,169,13,8,'#a29870');ellipse(224,167,11,6,'#64684e');ellipse(224,165,7,4,'#b8a575');line([[222,155],[225,147],[223,140]],'#ede2ba70',3);glow(224,167,design.warmth*.32);
 poly([[23,208],[179,244],[179,263],[26,226]],'#706a50');poly([[277,231],[378,200],[380,221],[276,250]],'#746d51');
 for(let x=29;x<170;x+=12){const y=210+(x-29)*.23;line([[x,y],[x+1,y+17]],'#494e3c',2);}for(let x=284;x<377;x+=12){const y=230-(x-284)*.31;line([[x,y],[x,y+17]],'#494e3c',2);}
 poly([[180,244],[274,232],[274,252],[180,264]],s.gate>=60?'#9a845b':'#73664b');
 line([[181,249],[273,237]],'#484d37',2);line([[181,260],[273,248]],'#484d37',2);
 if(s.gate>=60){line([[182,244],[272,251]],'#514f36',5);line([[184,261],[268,234]],'#b39b68',4);}else{line([[218,242],[212,255]],'#2f3e2e',3);line([[240,236],[245,250]],'#2f3e2e',2);}
 if(s.trap){line([[204,235],[224,228],[242,231]],'#cdc19b',2);ellipse(219,231,4,2,'#474d37');}
 if(night){c.fillStyle='#132c3a36';c.fillRect(0,0,400,286);glow(210,91,design.warmth);glow(224,167,design.warmth*.45);if(s.phase!=='wave2'){ellipse(52,250,10,5,'#162922');line([[46,252],[44,258]],'#172c25',2);ellipse(350,245,11,5,'#162922');}}
 // Fine dry-brush grain keeps the scene textured without sacrificing labels.
 for(let i=0;i<550;i++){c.fillStyle=i%2?'#f3e1b808':'#1f372109';c.fillRect(rand()*400,rand()*286,rand()*3+1,1);}
 }

 const observer=new ResizeObserver(draw);observer.observe(q('.fl-scene'));return {render(state){s=state;draw();},destroy(){observer.disconnect();}};
}
