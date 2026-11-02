import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';
let compiled;
async function storageScript(){
 if(!compiled)compiled=(async()=>{const bundle=await rolldown({input:fileURLToPath(new URL('../../client/campaign-storage.js',import.meta.url))});try{return (await bundle.generate({format:'iife',name:'BrowserSaveTest'})).output[0].code;}finally{await bundle.close();}})();
 return compiled;
}
export async function installStorage(page){await page.addInitScript({content:(await storageScript())+';globalThis.BrowserSaveTest=BrowserSaveTest;'});}
export function browserSave(page,method,...args){return page.evaluate(async({method,args})=>{
 const store=BrowserSaveTest.createBrowserCampaignStore();
 try{return {ok:true,value:await store[method](...args)};}
 catch(e){return {ok:false,error:e.message,status:e.status,snapshot:e.snapshot};}
 finally{await store.close();}
},{method,args});}
export async function readSave(page){const result=await browserSave(page,'read');if(!result.ok)throw Error(result.error);return result.value;}
export async function seedSave(page,snapshot,dawn=snapshot.state){await page.route('**/api/campaign/export',route=>route.fulfill({json:{...snapshot,dawn}}));}
