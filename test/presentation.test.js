import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneMetrics, makeMotion, advanceMotion } from '../client/presentation.js';

test('Retina drawing buffer follows physical pixels while the scene composition stays unchanged', () => {
  for (const [width, height] of [[300, 240], [370, 470], [410, 530], [540, 670]]) {
    const standard = sceneMetrics(width, height, 1);
    for (const ratio of [2, 3]) {
      const hd = sceneMetrics(width, height, ratio);
      assert.equal(hd.bufferWidth, width * ratio);
      assert.equal(hd.bufferHeight, height * ratio);
      assert.equal(hd.cssScale, standard.cssScale);
      assert.equal(hd.centerY, standard.centerY);
      assert.ok(Math.abs(hd.cameraZoom - standard.cameraZoom * ratio) < 1e-10);
      // The center of the front gate maps to the same CSS coordinate at every DPR.
      const cssPoint = m => ({x: width / 2, y: height / 2 + (468 - m.centerY) * m.cameraZoom / m.pixelRatio});
      assert.ok(Math.abs(cssPoint(hd).x - cssPoint(standard).x) < 1e-10);
      assert.ok(Math.abs(cssPoint(hd).y - cssPoint(standard).y) < 1e-10);
    }
  }
  assert.equal(sceneMetrics(1000, 2000, 3, 4096).bufferHeight, 4096);
});

test('walking follows 10 Hz authoritative positions smoothly at 60 Hz with four actual poses', () => {
  const state = makeMotion({x: 0, y: 0}), frames = new Set();
  let intermediate = 0;
  for (let i = 1; i <= 240; i++) {
    const target = {x: Math.floor(i / 6) * 4.3, y: 0}, previous = state.x;
    advanceMotion(state, target, 1000 / 60);
    assert.ok(state.x >= previous && state.x <= target.x);
    assert.ok(state.x - previous <= 3.00001);
    if (state.x > previous && state.x < target.x) intermediate++;
    if (state.moving) frames.add(state.frame);
  }
  assert.ok(intermediate > 220, 'motion must happen between network snapshots');
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3]);
  assert.ok(state.x > 165, 'smoothing must not leave the character behind');
});

test('paused people and creatures keep the exact position and walk pose; arrivals stop walking', () => {
  for (const stride of [7, 6]) {
    const state = makeMotion({x: 100, y: 100});
    for (let i = 0; i < 20; i++) advanceMotion(state, {x: 50, y: 80}, 16, false, stride);
    assert.equal(state.facing, -1);
    const frozen = structuredClone(state);
    for (let i = 0; i < 120; i++) advanceMotion(state, {x: 20, y: 30}, 16, true, stride);
    assert.deepEqual(state, frozen);
    for (let i = 0; i < 200; i++) advanceMotion(state, {x: 50, y: 80}, 16, false, stride);
    assert.equal(state.moving, false);
    assert.equal(state.frame, 1);
    assert.equal(state.bob, 0);
    assert.equal(state.lean, 0);
    assert.deepEqual({x: state.x, y: state.y}, {x: 50, y: 80});
    const before = state.x;
    advanceMotion(state, {x: 1000, y: 80}, 5000);
    assert.ok(state.x - before <= 9, 'a long frame must never teleport the token');
  }
});
