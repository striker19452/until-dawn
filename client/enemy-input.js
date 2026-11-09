import {windupInfo} from '../src/interrupt.js';

// Resolve painted bodies rather than their original wall-contact hitboxes.
export function pickEnemy(b,tokens,point,padding=0,windupOnly=false){
 return (b?.enemies||[]).filter(e=>e.hp>0&&!e.bossDormant&&(!windupOnly||windupInfo(b,e))).map(e=>({e,o:tokens.get('e-'+e.id)}))
  .filter(({o})=>o?.bodyBounds&&(o.sprite.visible&&o.sprite.alpha>0||o.outline?.visible))
  .filter(({o})=>{const r=o.bodyBounds;return point.x>=r.left-padding&&point.x<=r.left+r.width+padding&&point.y>=r.top-padding&&point.y<=r.top+r.height+padding;})
  .sort((a,c)=>{const distance=o=>Math.hypot(point.x-o.bodyBounds.left-o.bodyBounds.width/2,point.y-o.bodyBounds.top-o.bodyBounds.height/2);return distance(a.o)-distance(c.o)||a.e.id.localeCompare(c.e.id);})[0]?.e.id||null;
}
export const pickWindupEnemy=(b,tokens,point,padding=0)=>pickEnemy(b,tokens,point,padding,true);
