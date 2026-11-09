import url from './assets/phase-creatures-v1/atlas.webp?url';
import registration from './assets/phase-creatures-v1/registration.json';
import {PHASE_CREATURES} from '../src/phase-creatures.js';
export const PHASE_ART={url,registration,ids:Object.keys(PHASE_CREATURES)};
export function phaseCreaturePortrait(id,name){
 const frame=registration.frames.find(f=>f.species===id),[x,y]=frame.rect,[l,t,r,b]=frame.bounds;
 return `<svg class="bestiary-art" viewBox="${x+l-12} ${y+t-12} ${r-l+24} ${b-t+24}" role="img" aria-label="${name}的外观"><image href="${url}" width="${registration.width}" height="${registration.height}" /></svg>`;
}
