// Presentation coordinates remain 480 units wide, independently of Retina pixels.
export function sceneMetrics(cssWidth, cssHeight, deviceRatio = 1, maxBufferSize = 16384) {
  const width = Math.max(1, cssWidth);
  const height = Math.max(1, cssHeight);
  const requestedRatio = Number.isFinite(deviceRatio) ? Math.max(1, deviceRatio) : 1;
  const pixelRatio = Math.min(requestedRatio, maxBufferSize / width, maxBufferSize / height);
  const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
  const bufferHeight = Math.max(1, Math.round(height * pixelRatio));
  const logicalHeight = height / width * 480;
  // Keep the complete painted approach paths, from the rear ruins to the
  // road outside the front gate. Short viewports must not crop the rear fence.
  const zoom = Math.min(1, logicalHeight / 600);
  return {
    width, height, pixelRatio, bufferWidth, bufferHeight, logicalHeight, zoom,
    centerY: 300,
    cameraZoom: bufferWidth / 480 * zoom,
    cssScale: width / 480 * zoom,
    textResolution: Math.max(1, Math.ceil(bufferWidth / 480 * zoom)),
  };
}

export function makeMotion(point) {
  return { x: point.x, y: point.y, distance: 0, moving: false, facing: 1, frame: 1, bob: 0, lean: 0 };
}

// Begin at native resolution. Only sustained slow active frames reduce GPU
// pixel work; simulation speed, text/button sizes and touch coordinates stay fixed.
export function createRenderBudget(deviceRatio=1){
 let ratio=Math.max(1,deviceRatio),duration=0,frames=0;
 return {get ratio(){return ratio;},observe(delta,active){
  if(!active||delta<=0||delta>250){duration=0;frames=0;return false;}
  duration+=delta;frames++;
  if(duration<4000)return false;
  const slow=duration/frames>34;duration=0;frames=0;
  if(!slow||ratio<=1.5)return false;
  ratio=Math.max(1.5,Math.min(2,ratio-.5));return true;
 }};
}

// Follow authoritative positions continuously; never teleport or fade a moving token.
// The small smoothing delay removes 10 Hz network steps. A speed bound also avoids
// a large jump after a delayed snapshot. Pausing freezes position AND the walk pose.
export function advanceMotion(state, point, deltaMs, paused = false, stride = 7) {
  if (paused) return state;
  const dt = Math.max(0, Math.min(50, deltaMs));
  const dx = point.x - state.x, dy = point.y - state.y;
  const remaining = Math.hypot(dx, dy);
  if (remaining < 0.035) {
    state.x = point.x;
    state.y = point.y;
    state.moving = false;
    state.frame = 1;
    state.bob = 0;
    state.lean = 0;
    return state;
  }
  const step = Math.min(remaining * -Math.expm1(-dt / 70), 180 * dt / 1000);
  if (remaining > 0 && step > 0) {
    state.x += dx / remaining * step;
    state.y += dy / remaining * step;
    state.distance += step;
    state.moving = true;
    if (Math.abs(dx) > 0.12) state.facing = dx > 0 ? 1 : -1;
    state.frame = Math.floor(state.distance / stride) % 4;
    const cycle = state.distance / (stride * 4) * Math.PI * 2;
    state.bob = -Math.abs(Math.sin(cycle)) * 0.65;
    state.lean = Math.sin(cycle) * 0.65;
  }
  return state;
}
