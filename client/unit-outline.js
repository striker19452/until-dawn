// Clip the current walk frame against the actual foreground structure alpha.
// Exposed body pixels stay solid; only the hidden portion becomes a ghost.
export function createUnitOutlines(scene){
 const cache=new Map(),units=new Set();let serial=0;
 function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
 function frameFor(sprite,color,selected){
  const frame=sprite.frame,key=`${sprite.texture.key}:${frame.name}:${color}`;
  if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
  const width=frame.cutWidth,height=frame.cutHeight,body=canvas(width,height),ctx=body.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(frame.source.image,frame.cutX,frame.cutY,width,height,0,0,width,height);
  const pixels=ctx.getImageData(0,0,width,height).data,ink=canvas(width,height),paint=ink.getContext('2d');
  paint.drawImage(body,0,0);paint.globalCompositeOperation='source-in';paint.fillStyle=color;paint.fillRect(0,0,width,height);
  const name=`unit-contour-${++serial}`,texture=scene.textures.createCanvas(name,width,height),out=texture.context;
  const radius=selected?9:5,diagonal=selected?6:3;out.globalAlpha=selected?.95:.7;
  for(const [dx,dy] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-diagonal,-diagonal],[diagonal,-diagonal],[-diagonal,diagonal],[diagonal,diagonal]])out.drawImage(ink,dx,dy);
  out.globalAlpha=1;out.globalCompositeOperation='destination-out';out.drawImage(ink,0,0);out.globalCompositeOperation='source-over';texture.refresh();
  const ghost=canvas(width,height),g=ghost.getContext('2d');g.drawImage(texture.getSourceImage(),0,0);g.globalAlpha=.075;g.drawImage(ink,0,0);
  const entry={name,body,pixels,ghost,border:texture.getSourceImage()};cache.set(key,entry);
  if(cache.size>64){const oldest=cache.keys().next().value;scene.textures.remove(cache.get(oldest).name);cache.delete(oldest);}
  return entry;
 }
 function align(image,sprite,depth,width=sprite.frame.cutWidth,height=sprite.frame.cutHeight){
  image.setOrigin(sprite.originX,sprite.originY).setPosition(sprite.x,sprite.y).setScale(sprite.scaleX*sprite.frame.cutWidth/width,sprite.scaleY*sprite.frame.cutHeight/height).setFlipX(sprite.flipX).setAngle(sprite.angle).setAlpha(sprite.alpha).setDepth(depth);
 }
 function clip(obj,layers,entry,selected){
  const sprite=obj.sprite,frame=sprite.frame,width=Math.ceil(frame.cutWidth/2),height=Math.ceil(frame.cutHeight/2);
  if(!obj.occlusionTexture){obj.occlusionTexture=scene.textures.createCanvas(`unit-contour-clipped-${++serial}`,width,height);obj.occlusionMask=canvas(width,height);obj.occlusionGhost=canvas(width,height);units.add(obj);}
  if(obj.occlusionTexture.width!==width||obj.occlusionTexture.height!==height){obj.occlusionTexture.setSize(width,height);obj.occlusionMask.width=width;obj.occlusionMask.height=height;obj.occlusionGhost.width=width;obj.occlusionGhost.height=height;}
  const mask=obj.occlusionMask.getContext('2d',{willReadFrequently:true});mask.clearRect(0,0,width,height);mask.save();
  // Invert the displayed frame transform, including mirrored UVs and walk lean.
  mask.scale(width/frame.cutWidth,height/frame.cutHeight);
  if(sprite.flipX){mask.translate(frame.cutWidth,0);mask.scale(-1,1);}
  mask.translate(sprite.originX*frame.cutWidth,sprite.originY*frame.cutHeight);mask.scale(1/sprite.scaleX,1/sprite.scaleY);mask.rotate(-sprite.rotation);mask.translate(-sprite.x,-sprite.y);
  for(const layer of layers)layer.paintMask(mask,{x:obj.x,y:obj.y});mask.restore();
  const alpha=mask.getImageData(0,0,width,height).data;let hidden=0,exposed=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const source=(Math.min(frame.cutHeight-1,Math.floor((y+.5)*frame.cutHeight/height))*frame.cutWidth+Math.min(frame.cutWidth-1,Math.floor((x+.5)*frame.cutWidth/width)))*4+3;
   if(entry.pixels[source]>40){if(alpha[(y*width+x)*4+3]>40)hidden++;else exposed++;}
  }
  obj.occlusionPixels={hidden,exposed};obj.occluded=hidden>0;
  if(!obj.occluded)return;
  const out=obj.occlusionTexture.context;out.clearRect(0,0,width,height);out.drawImage(entry.body,0,0,width,height);
  if(selected)out.drawImage(entry.border,0,0,width,height);
  out.globalCompositeOperation='destination-out';out.drawImage(obj.occlusionMask,0,0);out.globalCompositeOperation='source-over';
  const ghost=obj.occlusionGhost.getContext('2d');ghost.clearRect(0,0,width,height);ghost.drawImage(entry.ghost,0,0,width,height);ghost.globalCompositeOperation='destination-in';ghost.drawImage(obj.occlusionMask,0,0);ghost.globalCompositeOperation='source-over';
  out.drawImage(obj.occlusionGhost,0,0);obj.occlusionTexture.refresh();
 }
 function show(obj,layers,selected=false){
  const sprite=obj.sprite,depth=610+obj.y/1000,color=selected?'#ffe598':obj.isCreature?'#ffe1b4':'#bde9e8';
  const tint=obj.hitTint??(selected?0xffedbb:obj.baseTint??null);
  obj.selected=selected;sprite.setDepth(depth);if(tint!==null)sprite.setTint(tint);else sprite.clearTint();
  const entry=layers.length||selected?frameFor(sprite,color,selected):null;
  if(layers.length){const key=[sprite.texture.key,sprite.frame.name,sprite.x,sprite.y,sprite.scaleX,sprite.scaleY,sprite.flipX,sprite.rotation,obj.y,selected,...layers.map(c=>c.maskKey)].join(':');
   if(key!==obj.occlusionKey){clip(obj,layers,entry,selected);obj.occlusionKey=key;}
  }else{obj.occluded=false;obj.occlusionKey='';obj.occlusionPixels={hidden:0,exposed:0};}
  obj.occluders=obj.occluded?layers.map(c=>c.id):[];sprite.setVisible(!obj.occluded);
  if(obj.occluded){
   if(!obj.outline)obj.outline=scene.add.image(sprite.x,sprite.y,obj.occlusionTexture.key);
   obj.outline.setTexture(obj.occlusionTexture.key).setVisible(true);align(obj.outline,sprite,depth,obj.occlusionTexture.width,obj.occlusionTexture.height);
   if(tint!==null)obj.outline.setTint(tint);else obj.outline.clearTint();
  }else obj.outline?.setVisible(false);
  if(selected&&!obj.occluded){
   if(!obj.selectionOutline)obj.selectionOutline=scene.add.image(sprite.x,sprite.y,entry.name);
   obj.selectionOutline.setTexture(entry.name).setVisible(true);align(obj.selectionOutline,sprite,depth+.0001);
  }else obj.selectionOutline?.setVisible(false);
 }
 function inspect(obj){
  if(!obj.occluded)return {...obj.occlusionPixels};
  const w=obj.occlusionTexture.width,h=obj.occlusionTexture.height,out=obj.occlusionTexture.context.getImageData(0,0,w,h).data,ghost=obj.occlusionGhost.getContext('2d').getImageData(0,0,w,h).data,mask=obj.occlusionMask.getContext('2d').getImageData(0,0,w,h).data;
  let solidExposed=0,translucentHidden=0,ghostOutsideMask=0;
  for(let i=3;i<out.length;i+=4){if(mask[i]===0&&out[i]>240)solidExposed++;if(mask[i]>240&&out[i]>0&&out[i]<100)translucentHidden++;if(mask[i]===0&&ghost[i]>0)ghostOutsideMask++;}
  return {...obj.occlusionPixels,solidExposed,translucentHidden,ghostOutsideMask};
 }
 function remove(obj){obj.outline?.destroy();obj.selectionOutline?.destroy();if(obj.occlusionTexture)scene.textures.remove(obj.occlusionTexture.key);units.delete(obj);}
 return {show,inspect,remove,get size(){return cache.size;},destroy(){for(const obj of [...units])remove(obj);for(const entry of cache.values())if(scene.textures.exists(entry.name))scene.textures.remove(entry.name);cache.clear();}};
}
