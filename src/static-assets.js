import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';

const br=promisify(brotliCompress),gz=promisify(gzip);
const compressible=/\.(?:html|js|css|svg)$/;

function encodingFor(header){
 const choices=new Map(String(header||'').toLowerCase().split(',').filter(Boolean).map(part=>{
  const [name,...parameters]=part.trim().split(';');
  const quality=parameters.find(p=>p.trim().startsWith('q='));
  const q=quality?Number(quality.trim().slice(2)):1;
  return [name.trim(),Number.isFinite(q)&&q>=0&&q<=1?q:0];
 }));
 const quality=name=>choices.get(name)??choices.get('*')??0;
 if(quality('br')>0&&quality('br')>=quality('gzip'))return 'br';
 return quality('gzip')>0?'gzip':null;
}

// Cache encoded variants per server, not per player. Metadata invalidates the HTML
// after a build; hashed assets can be cached by the browser for a full year.
export function createStaticAssets(){
 const cache=new Map();
 return async function serve(req,res,file,type,immutable=false){
  const info=await stat(file),key=`${info.mtimeMs}:${info.size}`;
  let entry=cache.get(file);
  if(!entry||entry.key!==key){
   const pending=(async()=>{
    const raw=await readFile(file),variants={identity:raw};
    if(compressible.test(file)&&raw.length>=1024){
     const encoded=await Promise.all([br(raw,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}),gz(raw,{level:6})]);
     if(encoded[0].length<raw.length)variants.br=encoded[0];
     if(encoded[1].length<raw.length)variants.gzip=encoded[1];
    }
    return {variants,hash:createHash('sha256').update(raw).digest('base64url')};
   })();
   entry={key,pending};cache.set(file,entry);
   if(cache.size>64)cache.delete(cache.keys().next().value);
   pending.catch(()=>{if(cache.get(file)===entry)cache.delete(file);});
  }
  const {variants,hash}=await entry.pending;
  const requested=encodingFor(req.headers['accept-encoding']);
  const encoding=variants[requested]?requested:null,body=variants[encoding||'identity'];
  const etag=`"${hash}-${encoding||'identity'}"`;
  res.setHeader('Content-Type',type);
  res.setHeader('Cache-Control',immutable?'public, max-age=31536000, immutable':'no-cache');
  res.setHeader('ETag',etag);
  if(compressible.test(file))res.setHeader('Vary','Accept-Encoding');
  if(String(req.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag)){
   res.writeHead(304);res.end();return;
  }
  if(encoding)res.setHeader('Content-Encoding',encoding);
  res.setHeader('Content-Length',body.length);
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
 };
}
