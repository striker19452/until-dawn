import introUrl from './assets/aiya-logo-intro.mp4?url';
import './startup-intro.css';

const seenKey = 'dawn-startup-intro-seen';

async function playStartupIntro() {
 const intro = document.querySelector('#startup-intro');
 if (typeof intro?.showModal !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches ||
     new URLSearchParams(location.search).has('test')) return;
 try { if (sessionStorage.getItem(seenKey)) return; } catch {}

 const video = intro.querySelector('video');
 const sound = intro.querySelector('[data-intro-sound]');
 const skip = intro.querySelector('[data-intro-skip]');
 const request = new AbortController();
 let mediaUrl;
 let timeout;
 const finish = () => { if (intro.open) intro.close(); };
 const setDeadline = () => {
  clearTimeout(timeout);
  timeout = setTimeout(finish, 4500);
 };

 intro.addEventListener('close', () => {
  clearTimeout(timeout);
  request.abort();
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  intro.remove();
 }, {once: true});
 video.addEventListener('ended', finish);
 video.addEventListener('error', finish);
 video.addEventListener('playing', setDeadline, {once: true});
 skip.addEventListener('click', finish);
 sound.addEventListener('click', () => {
  if (!video.muted) {
   video.muted = true;
   sound.textContent = '有声重播';
   return;
  }
  video.currentTime = 0;
  video.muted = false;
  sound.textContent = '静音';
  setDeadline();
  void video.play().catch(finish);
 });
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) finish();
 }, {signal: request.signal});

 intro.showModal();
 try { sessionStorage.setItem(seenKey, '1'); } catch {}
 setDeadline();
 try {
  // A blob lets mobile browsers play the short clip without requesting byte ranges.
  const response = await fetch(introUrl, {signal: request.signal});
  if (!response.ok) { finish(); return; }
  const clip = await response.blob();
  if (!intro.open) return;
  mediaUrl = URL.createObjectURL(clip);
  video.muted = true;
  video.src = mediaUrl;
  sound.disabled = false;
  await video.play();
 } catch (error) {
  // Some browsers require a gesture even for muted playback.
  if (error.name !== 'NotAllowedError') finish();
 }
}

void playStartupIntro();
