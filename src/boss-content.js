import {BOSS_RULES as B,COMBAT,NIGHT_ACTIONS} from './balance.js';
import {percent} from './descriptions.js';
export const BOSS_FORM_SPEED={brood:30,twin:32};
export const BOSS_FORM_HEALTH={brood:42,twin:108,revive:54};
export const BOSS_TWIN_FORMS=[{name:'紫脉',artForm:1,color:0xd7a5f1},{name:'青脉',artForm:2,color:0xa1e4cf},{name:'金脉',artForm:2,color:0xf2ca79,tint:0xffd79a}];
export const bossSpriteForm=e=>e.type==='twinvein'&&e.bossForm>0?BOSS_TWIN_FORMS[e.bossForm-1].artForm:e.bossForm||0;
export const bossFormName=e=>e.bossBrood?'穴灯幼兽':e.type==='twinvein'&&e.bossForm>0?BOSS_TWIN_FORMS[e.bossForm-1].name:null;
export const BOSS_BURST_DAMAGE=24;
export const BOSSES={
 7:{id:'bastion',art:'bastion',name:'棘冠背兽',day:7,zone:'gate',hp:228,speed:15,damage:36,interval:5,color:0xc2a16c,
 mechanism:'撞击破甲',get warning(){return `宽大的棘冠正在抵门：蓄撞${B.bastion.charge}秒，顶住或投掷可令它倒地露腹。`;},
 get behavior(){return `棘冠蓄撞${B.bastion.charge}秒，正面攻击只造成${percent(B.bastion.armor)}%伤害；撞后露腹${B.bastion.afterHit}秒。顶住、投掷或触发陷阱可中断蓄撞，并使其露腹${B.bastion.afterCounter}秒；顶住成功立即消耗${COMBAT.brace.finishStamina}体力、提前结束姿势，硬直${B.bastion.braceStun}秒后即可反击。露腹受到${percent(B.exposedFactor)}%伤害。`;},
 counter:'在正门顶住，或赶在蓄撞结束前投掷。陷阱和翻刺从腹侧命中，不受棘甲减伤；无需特定同伴。'},
 14:{id:'broodmother',art:'brood',name:'穴灯巢母',day:14,zone:'backLeft',hp:258,speed:15,damage:6,interval:4,color:0xb6cab0,
 mechanism:'地下巢穴',get warning(){return `后栏有发光鼓包：${B.brood.hatch}秒后幼兽将从地下入院，压实或投掷可以封巢。`;},
 get behavior(){return `巢母交替在两处后栏制造${B.brood.hatch}秒孵化鼓包。埋网或压实土道可自动封巢，投掷也可封巢；封巢反噬本体${B.brood.sealDamage}生命。未封住则孵出一只直接入院的幼兽，全夜最多${B.brood.limit}只。穴灯幼兽为灵活型，移动速度${BOSS_FORM_SPEED.brood}距离／秒。`;},
 get counter(){return `提前埋网，或看见鼓包后压实该处土道；投掷也可封巢，需赶路后准备${NIGHT_ACTIONS.times.throw}秒；最好提前安排后栏人员。也可集中攻击巢母，击退后所有鼓包消失。`;}},
 21:{id:'cinderwhale',art:'cinder',name:'吞烬囊鲸',day:21,zone:'left',hp:288,speed:14,damage:7,interval:5,color:0xe2ad69,
 mechanism:'吞火蓄能',get warning(){return `吸管对准中央篝火：吸焰${B.cinder.siphon}秒后爆囊，主动灭火能令它脱膜露出弱点。`;},
 get behavior(){return `吸焰时正面攻击只造成${percent(B.cinder.armor)}%伤害，每秒吸走${B.cinder.drain}火势、不消耗余柴。${B.cinder.siphon}秒后停止吸焰，爆囊只冲击本区围栏，基础损坏${BOSS_BURST_DAMAGE}耐久，随后虚弱${B.cinder.afterBurst}秒。主动灭火、火焰耗尽或投掷打断会令其虚弱${B.cinder.afterCounter}秒；虚弱时受${percent(B.exposedFactor)}%伤害。`;},
 counter:'熄灭篝火可免费切断吸焰，再集中驱赶；有余柴可免费重燃。投掷可保住火效并打断，陷阱与翻刺不受护膜减伤。没有点火也能应战。'},
 28:{id:'twinvein',art:'concord',name:'并生双脉',day:28,zone:'gate',hp:450,speed:16,damage:8,interval:5,color:0xc2a3cf,
 mechanism:'共生分裂',get warning(){return `${BOSS_TWIN_FORMS.length}颗脉核共用一副身体：生命降至${percent(B.twin.splitRatio)}%时分裂，要在${B.twin.window}秒内接连击倒全部${BOSS_TWIN_FORMS.length}体。`;},
 get behavior(){return `生命降到${percent(B.twin.splitRatio)}%时分为${BOSS_TWIN_FORMS.map(f=>f.name).join('、')}共${BOSS_TWIN_FORMS.length}体，各${BOSS_FORM_HEALTH.twin}生命，分别出现在接应面及两侧相邻防区。先倒下的一体开启${B.twin.window}秒同灭窗口；仍有个体存活则倒地者以${BOSS_FORM_HEALTH.revive}生命复苏，最多${B.twin.revives}次。全部${BOSS_TWIN_FORMS.length}体同时倒下才算击退。分裂体为灵活型，移动速度${BOSS_FORM_SPEED.twin}距离／秒，复苏后保持。`;},
 get counter(){return `分裂后先削弱全部${BOSS_TWIN_FORMS.length}体，再连续击倒；可分派同伴夹击，或用投掷同时打断、迅速换防。独居也能完成，不要求专属武器或同伴。`;}}
};
export const BOSS_SPECIES=Object.fromEntries(Object.values(BOSSES).map(b=>[b.id,Object.defineProperties({boss:true},Object.getOwnPropertyDescriptors(b))]));
export const bossForDay=day=>BOSSES[day]||null;
