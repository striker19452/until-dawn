import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, initialState, GameError } from '../src/game.js';

const advance = (state, ...actions) => actions.reduce((s, action) => applyAction(s, typeof action === 'string' ? { type: action } : action), state);
const day = () => advance(initialState(), 'listen');
const joined = () => advance(day(), { type: 'search', place: 'alley' }, { type: 'recruit', accept: true });

test('recommended day: search, recruit, work, repair, garden, automatic defense, supplies', () => {
  const s = advance(joined(), { type: 'setJob', job: 'craft' }, 'repair', 'buildGarden', 'prepare', 'startNight', 'wave1', { type: 'decide', choice: 'brace' }, 'wave2');
  assert.deepEqual([s.phase, s.ap, s.food, s.water, s.mat, s.gate, s.house], ['report', 1, 4, 3, 0, 69, 100]);
  assert.equal(s.recruited, true); assert.equal(s.garden, true); assert.equal(s.planted, false); assert.equal(s.trap, false); assert.equal(s.reserved, 0);
  assert.equal(advance(s, 'finish').phase, 'complete');
});
test('invalid phases and repeated searches cannot mutate the input', () => {
  const original = initialState();
  assert.throws(() => applyAction(original, { type: 'repair' }), GameError);
  assert.deepEqual(original, initialState());
  const s = advance(day(), { type: 'search', place: 'alley' });
  const before = structuredClone(s);
  assert.throws(() => applyAction(s, { type: 'search', place: 'alley' }), /已经搜索/);
  assert.throws(() => applyAction(s, { type: 'search', place: '__proto__' }), /没有这个/);
  assert.deepEqual(s, before);
});
test('action limit, costs, and building caps are enforced', () => {
  let s = day();
  for (const place of ['alley', 'shed', 'clinic']) s = advance(s, { type: 'search', place });
  assert.equal(s.ap, 0);
  assert.throws(() => applyAction(s, { type: 'repair' }), /行动力不足/);
  s = advance(day(), 'repair', 'repair');
  assert.equal(s.gate, 100);
  assert.throws(() => applyAction(s, { type: 'repair' }), /已经完好/);
  s = advance(day(), 'buildGarden');
  assert.throws(() => applyAction(s, { type: 'buildGarden' }), /已经开垦/);
});
test('jobs reserve and return materials, and never grant repeated output', () => {
  let s = joined();
  s = advance(s, { type: 'setJob', job: 'craft' });
  assert.deepEqual([s.mat, s.reserved, s.trap], [6, 2, false]);
  s = advance(s, { type: 'setJob', job: 'craft' });
  assert.deepEqual([s.mat, s.reserved], [6, 2]);
  assert.throws(() => applyAction(s, { type: 'craft' }), /同伴制作/);
  s = advance(s, { type: 'setJob', job: 'rest' });
  assert.deepEqual([s.mat, s.reserved], [8, 0]);
  s = advance(s, { type: 'setJob', job: 'repair' }, 'prepare', 'backDay');
  assert.equal(s.gate, 30); assert.equal(s.reserved, 1);
  s = advance(s, 'prepare', 'startNight');
  assert.equal(s.gate, 50); assert.equal(s.reserved, 0);
  assert.throws(() => applyAction(s, { type: 'startNight' }), /先检查/);
});
test('failed job change keeps the reserved materials and previous assignment', () => {
  const s = advance(joined(), 'buildGarden', 'repair', { type: 'setJob', job: 'repair' }, 'craft');
  assert.deepEqual([s.mat, s.reserved, s.job], [0, 1, 'repair']);
  const before = structuredClone(s);
  assert.throws(() => applyAction(s, { type: 'setJob', job: 'craft' }), /陷阱/);
  assert.deepEqual(s, before);
});
test('planting is delayed and requires land; story is logged once', () => {
  let s = joined();
  assert.throws(() => applyAction(s, { type: 'setJob', job: 'plant' }), /开垦/);
  s = advance(s, 'story', 'story', 'buildGarden', { type: 'setJob', job: 'plant' }, 'prepare', 'startNight');
  assert.equal(s.planted, true); assert.equal(s.food, 6);
  assert.equal(s.logs.filter(x => x.includes('种子箱')).length, 1);
});
test('unprepared gate breach causes a light injury, with no first-night death', () => {
  const s = advance(day(), 'prepare', 'startNight', 'wave1', { type: 'decide', choice: 'hold' }, 'wave2');
  assert.equal(s.gate, 0); assert.equal(s.lightWound, true); assert.equal(s.house, 90);
  assert.equal(s.phase, 'report'); assert.equal(s.food, 2); assert.equal(s.water, 2);
  assert.throws(() => applyAction(s, { type: 'wave2' }), /已结算/);
});
test('retreat protects the gate, and sleeping vs guarding changes defense and fatigue', () => {
  const base = joined();
  const sleep = advance(base, { type: 'setNightJob', job: 'sleep' }, 'prepare', 'startNight', 'wave1', { type: 'decide', choice: 'retreat' }, 'wave2');
  const guard = advance(base, { type: 'setNightJob', job: 'guard' }, 'prepare', 'startNight', 'wave1', { type: 'decide', choice: 'retreat' }, 'wave2');
  assert.equal(sleep.house, 90); assert.equal(guard.house, 90);
  assert.equal(guard.gate - sleep.gate, 6); assert.equal(sleep.allyTired, 0); assert.equal(guard.allyTired, 2);
});
test('recruitment cannot be repeated, and unresolved visitors leave at night', () => {
  let s = advance(day(), { type: 'search', place: 'clinic' });
  const declined = advance(s, { type: 'recruit', accept: false });
  assert.equal(declined.recruited, false);
  assert.throws(() => applyAction(declined, { type: 'recruit', accept: true }), /没有等待/);
  s = advance(s, 'prepare', 'startNight'); assert.equal(s.visitor, 'left');
  assert.throws(() => applyAction(joined(), { type: 'recruit', accept: true }), /没有等待/);
});
test('insufficient materials and unknown/night-before-day actions are rejected', () => {
  const s = advance(day(), 'buildGarden', 'craft');
  assert.equal(s.mat, 1);
  assert.throws(() => applyAction(s, { type: 'repair' }), /材料不足/);
  assert.throws(() => applyAction(s, { type: 'decide', choice: 'brace' }), /没有等待/);
  assert.throws(() => applyAction(s, { type: 'debugSetMoney', mat: 99999 }), /不支持/);
});
