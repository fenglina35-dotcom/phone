export const LAYOUT_KEY='cozy-home-independent-layout-v1';
export const LAYOUT_SCHEMA='cozy-layout-v1';
const legacy=['009','008','007'].map(v=>'cozy-home-independent-layout-'+v+'-v1');
export function normalizeLayout(data,initial){
 if(data?.schema===LAYOUT_SCHEMA)return data;
 if(!/^cozy-layout-00[789]-v1$/.test(data?.schema||''))throw Error('无法识别布局文件版本');
 if(!Array.isArray(data.items))throw Error('布局物品数据无效');
 const converted=JSON.parse(JSON.stringify(data));converted.schema=LAYOUT_SCHEMA;
 // 007 predates entry accessories. Add only missing originals; preserve every supplied transform and copy.
 const ids=new Set(converted.items.map(i=>i.id));
 for(const item of initial.items)if(!ids.has(item.id))converted.items.push(JSON.parse(JSON.stringify(item)));
 return converted;
}
export function loadLayout(storage,initial,validate){
 for(const key of [LAYOUT_KEY,...legacy]){
  const raw=storage.getItem(key);if(!raw)continue;
  const data=validate(normalizeLayout(JSON.parse(raw),initial));
  // A legacy save is never deleted or changed. Migration writes only after complete validation.
  if(key!==LAYOUT_KEY){storage.setItem(LAYOUT_KEY+'-migration-source',JSON.stringify({key,raw}));storage.setItem(LAYOUT_KEY,JSON.stringify(data));}
  return {data,source:key};
 }
 return null;
}
export function persistLayout(storage,data){
 const raw=JSON.stringify(data),old=storage.getItem(LAYOUT_KEY);
 if(old&&old!==raw)storage.setItem(LAYOUT_KEY+'-previous',old);
 storage.setItem(LAYOUT_KEY,raw);
 if(storage.getItem(LAYOUT_KEY)!==raw)throw Error('存档写入后核对失败');
}
