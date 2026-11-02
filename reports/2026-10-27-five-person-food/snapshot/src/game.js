export const SCHEMA_VERSION = 1;
export const MAX_PEOPLE = 5;
export const JOB_COST = Object.freeze({ rest: 0, plant: 0, craft: 2, repair: 1 });
export const NIGHT_JOBS = ['support', 'guard', 'sleep'];
export const SEARCHES = Object.freeze({
  alley: { title: '居民小巷', food: 3, water: 2, mat: 2, medicine: 0 },
  shed: { title: '废弃工具棚', food: 0, water: 0, mat: 5, medicine: 0 },
  clinic: { title: '街角诊所', food: 0, water: 1, mat: 0, medicine: 2 },
});

export class GameError extends Error {
  constructor(message) { super(message); this.name = 'GameError'; }
}
function requireRule(condition, message) { if (!condition) throw new GameError(message); }
export function people(s) { return s.recruited ? 2 : 1; }
export function initialState() {
  return {
    schemaVersion: SCHEMA_VERSION, day: 1, phase: 'morning', role: 'repairman',
    heard: false, ap: 6, food: 3, water: 3, mat: 6, medicine: 1,
    gate: 30, house: 100, garden: false, planted: false, trap: false,
    recruited: false, visitor: 'unseen', job: 'rest', nightJob: 'support', reserved: 0,
    searched: [], logs: ['第 1 天清晨，你在一座旧院子里醒来。'],
    message: '不用赶时间。先听广播，再想想今天要做什么。',
    choice: '', gateBefore: 30, nightCost: 0, heroTired: 0, allyTired: 0,
    lightWound: false, storyRead: false,
  };
}
function log(s, text) { s.logs.push(text); }
function spend(s, ap, mat = 0) {
  requireRule(s.ap >= ap, '行动力不足。可以检查准备情况，再选择入夜。');
  requireRule(s.mat >= mat, '可用材料不足，已预留给同伴的材料不在可用库存内。');
  s.ap -= ap; s.mat -= mat;
}
function hitGate(s, damage) {
  const breached = damage > 0 && damage >= s.gate;
  const overflow = Math.max(0, damage - s.gate);
  s.gate = Math.max(0, s.gate - damage);
  if (breached) { s.house = Math.max(0, s.house - 10 - overflow); s.lightWound = true; }
}

/** Pure authoritative rules. No client-provided inventory or outcome is accepted. */
export function applyAction(current, action) {
  requireRule(action && typeof action === 'object' && !Array.isArray(action), '操作格式不正确。');
  const s = structuredClone(current);
  const { type } = action;
  requireRule(typeof type === 'string', '缺少操作类型。');
  requireRule(type !== 'retry', '重试必须从清晨检查点恢复。');
  if (type === 'listen') {
    requireRule(s.phase === 'morning' && !s.heard, '今天的广播已经收听过了。');
    s.heard = true; s.phase = 'day';
    log(s, '广播说，二十八天后会有救援。今晚要先守好院门。');
    s.message = '救援消息记下了。现在可以自由安排今天。';
    return s;
  }
  if (type === 'backDay') {
    requireRule(s.phase === 'dusk', '当前不在入夜准备阶段。');
    s.phase = 'day'; s.message = '回到白天，可以继续准备。'; return s;
  }
  if (type === 'startNight') {
    requireRule(s.phase === 'dusk', '请先检查入夜准备。');
    if (s.recruited) {
      if (s.job === 'craft') { requireRule(!s.trap && s.reserved === 2, '陷阱制作状态不一致。'); s.trap = true; log(s, '林禾用预留的材料做好了陷阱。'); }
      if (s.job === 'repair') { requireRule(s.reserved === 1, '维修材料未预留。'); s.gate = Math.min(100, s.gate + 20); log(s, '林禾修补了院门，耐久增加。'); }
      if (s.job === 'plant') { requireRule(s.garden, '需要先开垦菜地。'); s.planted = true; log(s, '林禾把第一批种子播进土里。'); }
      s.reserved = 0;
    }
    if (s.visitor === 'waiting') { s.visitor = 'left'; log(s, '来访者在入夜前离开了。'); }
    s.gateBefore = s.gate; s.phase = 'wave1';
    s.message = '夜战自动进行。遇到关键情况会停下来等你决定。'; return s;
  }
  if (type === 'wave1') {
    requireRule(s.phase === 'wave1', '第一波已结算，或尚未开始。');
    const help = s.recruited ? { guard: 6, support: 3, sleep: 0 }[s.nightJob] : 0;
    const damage = Math.max(0, 14 - help - (s.trap ? 10 : 0));
    hitGate(s, damage);
    log(s, `第一波：院门受到 ${damage} 点冲击。${s.trap ? '陷阱拦住了一只生物，已消耗。' : ''}`);
    s.trap = false; s.phase = 'event';
    s.message = '关键事件已暂停，没有倒计时。选好后才会继续。'; return s;
  }
  if (type === 'decide') {
    requireRule(s.phase === 'event', '当前没有等待决定的夜间事件。');
    requireRule(['brace', 'hold', 'retreat'].includes(action.choice), '请选择有效的防守策略。');
    if (action.choice === 'brace') { requireRule(s.mat >= 1, '材料不足，无法紧急加固。'); s.mat -= 1; }
    s.choice = action.choice;
    log(s, { brace: '你用 1 材料加固门闩，挡住了最后的冲击。', hold: '你选择按照原计划继续坚守。', retreat: '你退回小屋，房屋将受损 10。' }[s.choice]);
    s.phase = 'wave2'; s.message = '指令已下达，防守继续。'; return s;
  }
  if (type === 'wave2') {
    requireRule(s.phase === 'wave2', '最后一波已结算，或尚未开始。');
    if (s.choice === 'hold') hitGate(s, 16 - (s.recruited && s.nightJob !== 'sleep' ? 4 : 0));
    if (s.choice === 'retreat') s.house = Math.max(0, s.house - 10);
    s.nightCost = people(s); s.food = Math.max(0, s.food - s.nightCost); s.water = Math.max(0, s.water - s.nightCost);
    s.heroTired = 1; s.allyTired = s.recruited ? { guard: 2, support: 1, sleep: 0 }[s.nightJob] : 0;
    log(s, `天亮：${people(s)} 人平安，食物与饮水各消耗 ${s.nightCost} 份。`);
    if (s.lightWound) log(s, '院门被突破，主角受了轻伤；仍然撑过第一夜。');
    s.phase = 'report'; s.message = '第一夜结束。战报和资源已保存，可以随时回来继续。'; return s;
  }
  if (type === 'finish') {
    requireRule(s.phase === 'report', '请先完成第一夜。');
    s.phase = 'complete'; s.message = '第 1 天已经完成。后续天数尚未开放，可以从清晨重试。'; return s;
  }
  requireRule(s.phase === 'day', '这项操作只能在白天进行。');
  switch (type) {
    case 'search': {
      requireRule(typeof action.place === 'string' && Object.hasOwn(SEARCHES, action.place), '没有这个搜索地点。');
      const place = SEARCHES[action.place];
      requireRule(!s.searched.includes(action.place), '这个地点今天已经搜索过了。');
      spend(s, 2); s.searched.push(action.place);
      for (const key of ['food', 'water', 'mat', 'medicine']) s[key] += place[key];
      log(s, `搜索${place.title}：食物 +${place.food}，饮水 +${place.water}，材料 +${place.mat}，药品 +${place.medicine}。`);
      if (s.visitor === 'unseen') { s.visitor = 'waiting'; s.message = '回来时，一个背着种子包的人跟到了院门外。'; }
      else s.message = `物资带回来了，还剩 ${s.ap} 点行动。`;
      break;
    }
    case 'recruit': {
      requireRule(s.visitor === 'waiting', '门外已经没有等待答复的来访者。');
      requireRule(typeof action.accept === 'boolean', '请决定是否收留。');
      if (action.accept) {
        requireRule(people(s) < MAX_PEOPLE && people(s) < 2, '人数或床位已满。');
        s.visitor = 'joined'; s.recruited = true;
        log(s, '你收留了园艺师林禾。院子里第一次有了交谈声。');
        s.message = '林禾住下了。可以为她安排白天工作和夜间岗位。';
      } else { s.visitor = 'left'; log(s, '你婉拒了林禾，她在天黑前离开。'); s.message = '今天仍由你独自守夜。'; }
      break;
    }
    case 'setJob': {
      requireRule(s.recruited, '还没有可安排工作的同伴。');
      requireRule(typeof action.job === 'string' && Object.hasOwn(JOB_COST, action.job), '没有这个工作岗位。');
      requireRule(action.job !== 'plant' || s.garden, '需要先开垦菜地。');
      requireRule(action.job !== 'craft' || !s.trap, '已经准备了一只陷阱，不需要重复制作。');
      const available = s.mat + s.reserved, next = JOB_COST[action.job];
      requireRule(available >= next, '可用材料不足，原岗位安排保持不变。');
      s.mat = available - next; s.reserved = next; s.job = action.job;
      s.message = '白天安排已保存，黄昏统一完成。'; break;
    }
    case 'setNightJob':
      requireRule(s.recruited && NIGHT_JOBS.includes(action.job), '请选择有效的夜间岗位。');
      s.nightJob = action.job; s.message = '夜间岗位已保存。'; break;
    case 'repair': {
      requireRule(s.gate < 100, '院门已经完好。'); spend(s, 1, 2);
      const before = s.gate; s.gate = Math.min(100, s.gate + 40);
      log(s, `修补院门：${before} → ${s.gate}，花费 1 行动、2 材料。`);
      s.message = '木板重新钉牢了，院门看起来可靠了些。'; break;
    }
    case 'buildGarden':
      requireRule(!s.garden, '菜地已经开垦过了。'); spend(s, 2, 3); s.garden = true;
      log(s, '你开垦了一小块菜地，花费 2 行动、3 材料。'); s.message = '土翻好了。安排同伴种植，过几天才会有收成。'; break;
    case 'craft':
      requireRule(!s.trap && s.job !== 'craft', '陷阱已准备好或已交给同伴制作。'); spend(s, 1, 2); s.trap = true;
      log(s, '你做好一只简易陷阱，花费 1 行动、2 材料。'); s.message = '陷阱已摆在门边，可削弱第一波入侵。'; break;
    case 'story':
      requireRule(s.recruited, '林禾还没有住进院子。');
      if (!s.storyRead) { s.storyRead = true; log(s, '林禾说，她想找回社区花园留下的种子箱。'); }
      s.message = '林禾的种子故事记进了手记。'; break;
    case 'prepare': s.phase = 'dusk'; s.message = '先确认准备情况。你随时可以回去继续安排。'; break;
    default: throw new GameError('不支持的操作。');
  }
  return s;
}
