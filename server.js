import http from 'node:http';
import { createStaticAssets } from './src/static-assets.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { openStore, StoreError, SESSION_SECONDS } from './src/store.js';
import { GameError } from './src/game.js';
import { RuleError } from './src/campaign.js';
import { openCampaignStore } from './src/campaign-store.js';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav' };
const STATIC = new Set(['/', '/index.html', '/legacy.html', '/app.js', '/styles.css', '/scene.js', '/icons.js']);
function cookieToken(req) { return req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('dawn_session='))?.slice('dawn_session='.length); }
function sendJSON(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function jsonBody(req,limit=8192) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new StoreError('请使用 JSON 提交操作。', 415);
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new StoreError('请求内容过长。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new StoreError('JSON 格式不正确。', 400); }
}
function requestOrigin(req, publicOrigin) {
  const directOrigin = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`).origin;
  const peer = req.socket.remoteAddress;
  const loopback = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  // Only the local tunnel process may declare the explicitly configured HTTPS origin.
  // LAN requests cannot enable proxy trust merely by supplying forwarded headers.
  if (publicOrigin && loopback && req.headers['x-forwarded-proto'] === 'https' && new URL(directOrigin).host === new URL(publicOrigin).host) return publicOrigin;
  return directOrigin;
}
function sameOrigin(req, publicOrigin) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).origin === requestOrigin(req, publicOrigin); } catch { return false; }
}

export function createGameServer({ dbPath = process.env.DB_PATH || resolve(projectRoot, 'data/game.sqlite'), publicOrigin = process.env.PUBLIC_ORIGIN || null } = {}) {
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('PUBLIC_ORIGIN 必须是 HTTPS 站点根地址。');
    publicOrigin = url.origin;
  }
  const store = openStore(dbPath);
  const campaigns = openCampaignStore(dbPath);
  const serveStatic=createStaticAssets();
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/api/health' && req.method === 'GET') { sendJSON(res, 200, { ok: true, nightRuntime: 'client' }); return; }
      if (pathname === '/api/campaign/export' && req.method === 'GET') {
        if (!sameOrigin(req, publicOrigin)) throw new StoreError('请从游戏页面迁入旧存档。',403);
        const userId=store.session(cookieToken(req));
        if(!userId){sendJSON(res,200,null);return;}
        campaigns.ensure(userId,store.snapshot(userId));
        sendJSON(res,200,campaigns.exportSave(userId));return;
      }
      if (pathname === '/api/campaign' && req.method === 'GET') {
        if (!sameOrigin(req, publicOrigin)) throw new StoreError('请从游戏页面打开存档。',403);
        let userId=store.session(cookieToken(req));
        if(!userId){const player=store.createPlayer();userId=player.userId;res.setHeader('Set-Cookie',`dawn_session=${player.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${requestOrigin(req,publicOrigin).startsWith('https:')?'; Secure':''}`);}
        const snapshot=campaigns.ensure(userId,store.snapshot(userId));
        sendJSON(res,200,{...snapshot,nightRuntime:'client'});return;
      }
      if(pathname==='/api/campaign/night-result'&&req.method==='POST'){
        if(!sameOrigin(req,publicOrigin))throw new StoreError('操作来源不正确。',403);
        const userId=store.session(cookieToken(req));if(!userId)throw new StoreError('玩家识别已失效，请保留本地结果页面。',401);
        sendJSON(res,200,campaigns.finishClient(userId,await jsonBody(req,256*1024)));return;
      }
      if (pathname === '/api/campaign/action' && req.method === 'POST') {
        if(!sameOrigin(req,publicOrigin))throw new StoreError('操作来源不正确。',403);
        const userId=store.session(cookieToken(req));if(!userId)throw new StoreError('玩家识别已失效，请重新打开页面。',401);
        sendJSON(res,200,campaigns.action(userId,await jsonBody(req)));return;
      }
      if (pathname === '/api/game' && req.method === 'GET') {
        if (!sameOrigin(req, publicOrigin)) throw new StoreError('请从游戏页面打开存档。', 403);
        const userId = store.session(cookieToken(req));
        if (userId) sendJSON(res, 200, store.snapshot(userId));
        else {
          const player = store.createPlayer();
          res.setHeader('Set-Cookie', `dawn_session=${player.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${requestOrigin(req, publicOrigin).startsWith('https:') ? '; Secure' : ''}`);
          sendJSON(res, 200, player.snapshot);
        }
        return;
      }
      if (pathname === '/api/action' && req.method === 'POST') {
        if (!sameOrigin(req, publicOrigin)) throw new StoreError('操作来源不正确。', 403);
        const userId = store.session(cookieToken(req));
        if (!userId) throw new StoreError('玩家识别已失效，请刷新页面重新打开存档。', 401);
        
        const input = await jsonBody(req);
        sendJSON(res, 200, store.act(userId, input)); return;
      }
      if (pathname.startsWith('/api/')) { sendJSON(res, 404, { error: '没有这个接口。' }); return; }
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); sendJSON(res, 405, { error: '不支持的请求方法。' }); return; }
      let file;
      if((pathname==='/'||pathname==='/index.html')&&existsSync(resolve(projectRoot,'dist/index.html')))file=resolve(projectRoot,'dist/index.html');
      else if(/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname))file=resolve(projectRoot,'dist',pathname.slice(1));
      else if(STATIC.has(pathname))file=resolve(projectRoot,'public',pathname==='/'?'index.html':pathname.slice(1));
      else {sendJSON(res,404,{error:'页面不存在。'});return;}
      await serveStatic(req,res,file,MIME[extname(file)]||'application/octet-stream',/^\/assets\/.+-[a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/.test(pathname));
    } catch (error) {
      if (error instanceof GameError || error instanceof RuleError) sendJSON(res, 422, { error: error.message });
      else if (error instanceof StoreError) sendJSON(res, error.status, { error: error.message, ...(error.snapshot ? { snapshot: error.snapshot } : {}) });
      else { console.error('Request failed:', error.message); sendJSON(res, 500, { error: '保存暂时失败，请保留页面并重试。' }); }
    }
  });
  server.requestTimeout = 15000;
  server.on('upgrade',(_req,socket)=>{socket.end('HTTP/1.1 410 Gone\r\nConnection: close\r\n\r\n');});
  server.on('close',()=>{campaigns.close();store.close();});
  return {server,store,campaigns};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 4173);
  const { server } = createGameServer();
  server.listen(port, host, () => {
    console.log(`Local: http://localhost:${server.address().port}`);
    if (host === '0.0.0.0') for (const list of Object.values(networkInterfaces())) for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) console.log(`Phone (same Wi-Fi): http://${item.address}:${server.address().port}`);
    }
    console.log('Browser saves ready; SQLite retained for legacy migration. Press Ctrl+C to stop.');
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; server.close(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
}
