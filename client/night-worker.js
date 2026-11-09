import { createLocalNight } from '../src/local-night.js';
let night=null,timer=null;
const emit=message=>self.postMessage(message);
function schedule(){
 if(timer)clearInterval(timer);timer=null;
 if(!night||night.battle.paused||night.battle.finished)return;
 timer=setInterval(()=>{night.tick();if(night.battle.paused||night.battle.finished){clearInterval(timer);timer=null;}},25);
}
self.addEventListener('message',({data})=>{
 try{
  if(data.type==='init'){
   if(timer)clearInterval(timer);timer=null;
   night=createLocalNight(data.base,{emit,autoPause:data.options?.autoPause});schedule();
  }else if(data.type==='command'){
   if(!night)throw Error('本地夜战尚未就绪。');
   night.command(data.action,data.commandId);schedule();
  }else if(data.type==='dispose'){if(timer)clearInterval(timer);timer=null;night=null;}
 }catch(error){emit({type:'error',message:error.message,commandId:data.commandId});}
});
emit({type:'ready'});
