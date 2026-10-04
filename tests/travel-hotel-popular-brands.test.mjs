import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const data=fs.readFileSync(new URL('../travel-hotel-data.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../travel-hotel.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(chat){const S={me:{active:'main',balance:10000},contacts:[],travel:{hotels:[],hotelSearch:{city:'上海',keyword:'希尔顿',checkIn:'2026-10-10',nights:1,rooms:1,adults:1,children:0,roomType:'double',guestMode:'me'}}};const calls=[];const ctx=vm.createContext({S,tvInit:()=>S.travel,todayStr:()=> '2026-10-04',save(){},render(){},getC:()=>null,toast(){},document:{getElementById:()=>null,querySelector:()=>null},NorthTravelHome:{home(){},entry(){}},...(chat?{chatAPI:async(m,o)=>{calls.push({m,o});return chat(m,o);}}:{})});vm.runInContext(data+ui,ctx);return {S,calls,api:ctx.NorthTravelHotel,data:ctx.NorthHotelData};}
for(const city of ['苏州','北京','首尔','某个小城市'])test('popular brand is simulated locally in '+city,()=>{const f=fixture(()=>{throw Error('must not need model')});Object.assign(f.S.travel.hotelSearch,{city,keyword:'全季',stars:5});f.api.query();const q=f.S.travel.hotelSearch.hotelQuotes;assert(q.items.length>0);assert(q.items.every(x=>x.brand==='全季'));assert.equal(f.calls.length,0);assert.equal(f.S.travel.hotelSearch.stars,0);});
test('plain model advice is displayed without JSON parse errors',async()=>{const f=fixture(()=> '这个关键词可能需要调整，建议核对品牌名称。');f.S.travel.hotelSearch.keyword='Hiltn';f.api.query();await tick();assert.equal(f.S.travel.hotelSearch.hotelQuotes.help.status,'done');assert(f.S.travel.hotelSearch.hotelQuotes.help.text.includes('品牌名称'));});

test('all curated brands work in domestic, overseas and custom cities without network',()=>{const f=fixture();for(const city of ['苏州','首尔','自选城市'])for(const b of f.data.brands){Object.assign(f.S.travel.hotelSearch,{city,keyword:b.name,stars:5});f.api.query();const q=f.S.travel.hotelSearch.hotelQuotes;assert(q.items.some(x=>x.brand===b.name),city+' '+b.name);assert(q.items.every(x=>x.kind==='brand'));}assert.equal(f.calls.length,0);});
