import atlasUrl from './assets/building-states-v8.webp?url';
import registration from './assets/building-states-v8.json';
export const buildingStatesUrl=atlasUrl;
export const buildingStateRegistration=registration;
export function buildingStateFrame(type,state){return state==='intact'?null:`${type}-${state}`;}
export function registerBuildingStateFrames(scene){
 const texture=scene.textures.get('building-states');
 for(const [name,frame]of Object.entries(registration.frames))if(!texture.has(name))texture.add(name,0,...frame.rect);
}
export function buildingStatePreview(type,state){
 const name=buildingStateFrame(type,state),frame=registration.frames[name];if(!frame)return '';
 const [x,y,w,h]=frame.rect;
 return `<svg class="building-state-preview" viewBox="0 0 ${w} ${h}" role="img" aria-label="${state==='destroyed'?'损毁':'受损'}设施"><svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image href="${atlasUrl}" width="${registration.width}" height="${registration.height}"/></svg></svg>`;
}
