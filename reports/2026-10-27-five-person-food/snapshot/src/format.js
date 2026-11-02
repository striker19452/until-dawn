const oneDecimal=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1,useGrouping:false});
// Values stay precise in the simulation. Positive durability never appears as
// zero before destruction; all surfaces use the same one-decimal readout.
export function formatDurability(value){
 if(!Number.isFinite(value))return '0';
 const text=oneDecimal.format(value);return text==='0'&&value>0?'0.1':text==='-0'?'0':text;
}
export function formatDurabilityText(text){
 return String(text).replace(/(耐久\s*[+−-]?\s*|房屋\s*|围栏\s*[+−-]\s*|受袭\s*·\s*)(\d+(?:\.\d+)?)/g,(_,label,value)=>label+formatDurability(Number(value)));
}
