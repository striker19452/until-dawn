// New species follow a defeated boss, then join the following week's pool.
// Kept independent of content.js so simulation, art and help share these rules.
export const PHASE_CREATURE_RULES={leap:4.5,armor:.3,flankAngle:55,flankMemory:3,exposed:5,spores:5,sporeRadius:145,sporeStamina:18,sporeFear:6,shiftRatio:.5};
export const PHASE_CREATURES={
 bladebeast:{name:'镰足兽',day:8,afterBoss:7,hp:42,speed:52,agile:true,damage:3,interval:1.8,color:0xa8b576,
  warning:'棘冠倒下后出现的新足迹：镰足兽接触防线后4.5秒蓄跳越栏。提前站位拦截，埋网可拖慢蓄跳。',
  behavior:'接触围栏后蓄跳4.5秒即可越过完整防线；翻刺不能阻止跳跃。埋网使蓄跳速度降至35%，普通攻击只造成短暂眩晕，不削减蓄跳进度；重击或触发陷阱可清零并眩晕。',counter:'在来袭一侧提前留守，或埋网争取换防时间。低疲劳能缩短赶路和重击准备，别等蓄跳快满才从正门出发。'},
 shellcrab:{name:'甲缝螯',day:15,afterBoss:14,hp:72,speed:19,damage:8,interval:3.5,color:0xc7a56e,
  warning:'巢母之后，厚壳甲缝螯开始沿墙移动：同一方向的驱赶只造成30%伤害。分开站位夹击或重击可破甲。',
  behavior:'甲壳使驱赶伤害降至30%；3秒内来自夹角至少55度的两次驱赶会破甲5秒。重击也可破甲5秒，陷阱和翻刺不受护甲减伤。',counter:'两人从不同方向夹击；挤在一起仍会被甲壳挡住。独居可提前布陷阱、翻刺，或重击破甲后驱赶。'},
 sporetoad:{name:'雾囊蟾',day:22,afterBoss:21,hp:54,speed:23,damage:2,interval:2.4,color:0xb7a2c7,
  warning:'囊鲸退去后，雾囊蟾靠近火光：每5秒喷出孢雾，消耗周围145距离内成员18体力、增加6恐惧。',
  behavior:'接触防线后开始蓄雾，入院后继续；每5秒释放一次孢雾，145距离内屋外成员体力−18、恐惧+6，不直接扣健康。普通攻击不削减蓄雾进度，重击或触发陷阱可清零；眩晕时不蓄雾。',counter:'提前留出一名低疲劳成员截住它，或重击打断。别把整队挤在孢雾范围内，也别让它躲在重撞兽后持续耗空体力。'},
 echomantis:{name:'回声螳',day:29,afterBoss:28,hp:66,speed:48,agile:true,damage:4,interval:1.8,color:0x9bd5ca,
  warning:'脉核沉寂后还有回声：回声螳受伤过半会转向相邻防区，仅转场一次。撤离前仍需守住两侧。',
  behavior:'生命首次降到50%时，向相邻防区快速转场，清除原有蓄势；每只只转场一次，沿围栏移动，不能直接穿墙。',counter:'在相邻防区保留接应人员，或提前布置陷阱；转场后及时换防。别在原处等待，必须把它一并驱离才能迎来黎明。'}
};
export const creatureAfterBoss=day=>Object.entries(PHASE_CREATURES).find(([,def])=>def.afterBoss===day)?.[0]||null;
