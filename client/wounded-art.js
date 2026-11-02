import atlasUrl from './assets/survivors-wounded-atlas-v1.webp?url';
import registration from './assets/survivors-wounded-v1.json';

export const woundedUrl=atlasUrl;
export const woundedRegistration=registration;
export function woundedFrame(person,moving=false){
 const pose=moving?'crawl':'seated',index=registration.frames.findIndex(f=>f.person===person&&f.pose===pose);
 return index<0?registration.frames.findIndex(f=>f.person==='visitor'&&f.pose===pose):index;
}
