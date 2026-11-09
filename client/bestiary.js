import skitterUrl from './assets/skitter-walk-v1.webp?url';
import skitterRegistration from './assets/skitter-walk-v1.json';
import {BOSS_ART,bossPortrait} from './boss-art.js';
import {PHASE_ART,phaseCreaturePortrait} from './phase-creature-art.js';
import creatureAUrl from './assets/creatures-walk-a-v4.webp?url';
import creatureBUrl from './assets/creatures-walk-b-v4.webp?url';
import registration from './assets/creatures-walk-v4.json';

// Show the same species artwork as the yard, cropped from its first walk frame.
export function creaturePortrait(id,name){if(BOSS_ART[id])return bossPortrait(id,name);
 if(PHASE_ART.ids.includes(id))return phaseCreaturePortrait(id,name);
 if(id==='skitter'){const f=skitterRegistration.frames[0],b=f.bounds;return `<svg class="bestiary-art" viewBox="${b[0]-12} ${b[1]-12} ${b[2]-b[0]+24} ${b[3]-b[1]+24}" role="img" aria-label="${name}的外观"><image href="${skitterUrl}" width="${skitterRegistration.width}" height="${skitterRegistration.height}" /></svg>`;}
 const index=registration.sheets.findIndex(sheet=>sheet.species.includes(id));
 const sheet=registration.sheets[index],frame=sheet.frames.find(f=>f.species===id&&f.phase===0);
 const [left,top,right,bottom]=frame.bounds,row=Math.floor(frame.frame/registration.columns),col=frame.frame%registration.columns;
 const viewBox=[col*registration.frameWidth+left-12,row*registration.frameHeight+top-12,right-left+24,bottom-top+24].join(' ');
 return `<svg class="bestiary-art" viewBox="${viewBox}" role="img" aria-label="${name}的外观"><image href="${index===0?creatureAUrl:creatureBUrl}" width="${sheet.width}" height="${sheet.height}" /></svg>`;
}
