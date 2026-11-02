import bastion from './assets/bosses-v1/bastion.webp?url';
import brood from './assets/bosses-v1/brood.webp?url';
import cinder from './assets/bosses-v1/cinder.webp?url';
import concord from './assets/bosses-v1/concord.webp?url';
import registration from './assets/bosses-v1/registration.json';
export const BOSS_ART={bastion:{url:bastion,registration:registration.bastion},broodmother:{url:brood,registration:registration.brood},cinderwhale:{url:cinder,registration:registration.cinder},twinvein:{url:concord,registration:registration.concord}};
export function bossPortrait(id,name){const art=BOSS_ART[id];if(!art)return '';const {width,height,frames}=art.registration,[x,y,w,h]=frames[0].rect;return `<svg class="bestiary-art boss-art" viewBox="${x-10} ${y-10} ${w+20} ${h+20}" role="img" aria-label="${name}的独立生物外观"><image href="${art.url}" width="${width}" height="${height}" /></svg>`;}
