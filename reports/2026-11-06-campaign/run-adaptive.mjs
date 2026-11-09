import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const [modulePath,out]=process.argv.slice(2),{run}=await import(pathToFileURL(modulePath));
const rows=[];
for(const role of ['watchman','repairman','medic'])for(const seed of [11,53,97])for(const size of [3,5])for(const rotate of [false,true]){
 try{const result=run(role,size,seed,{rotate});rows.push({role,seed,size,rotate,...result});}catch(error){rows.push({role,seed,size,rotate,error:error.stack});}
}
writeFileSync(out,JSON.stringify(rows,null,2));console.log(out,rows.filter(r=>r.s?.phase==='rescued').length,'/',rows.length,'errors',rows.filter(r=>r.error).length);
