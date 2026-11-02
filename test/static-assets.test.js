import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createStaticAssets } from '../src/static-assets.js';

test('static files negotiate compression, cache hashed versions, validate ETags and preserve HEAD semantics',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dawn-assets-'));
 try{
  const file=join(dir,'bundle.js'),original='const greeting="你好，小院";\n'.repeat(400);
  await writeFile(file,original);const serve=createStaticAssets();
  async function get(headers={},method='GET',immutable=true){const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=body;}};await serve({headers,method},response,file,'text/javascript',immutable);return response;}
  const plain=await get();assert.equal(plain.body.toString(),original);
  const br=await get({'accept-encoding':'gzip, br'});assert.equal(br.headers['Content-Encoding'],'br');assert.equal(brotliDecompressSync(br.body).toString(),original);assert.ok(br.body.length<plain.body.length/3);assert.match(br.headers['Cache-Control'],/immutable/);assert.equal(br.headers.Vary,'Accept-Encoding');
  const gz=await get({'accept-encoding':'br;q=0, gzip;q=1'});assert.equal(gz.headers['Content-Encoding'],'gzip');assert.equal(gunzipSync(gz.body).toString(),original);
  const disabled=await get({'accept-encoding':'br;q=0, gzip;q=0'});assert.equal(disabled.headers['Content-Encoding'],undefined);
  const valid=await get({'accept-encoding':'br','if-none-match':br.headers.ETag});assert.equal(valid.status,304);assert.equal(valid.body,undefined);
  const head=await get({'accept-encoding':'br'},'HEAD');assert.equal(head.body,undefined);assert.equal(head.headers['Content-Length'],br.body.length);
  const html=await get({},'GET',false);assert.equal(html.headers['Cache-Control'],'no-cache');
  await writeFile(file,original+'//new build');const changed=await get();assert.notEqual(changed.headers.ETag,plain.headers.ETag);assert.match(changed.body.toString(),/new build/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
