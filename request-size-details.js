(function(){
'use strict';
const baseStats=wechatRequestStats;
// Only fixed labels and counts leave this function; never retain prompt excerpts.
function sectionKind(heading){
  if(/世界设定|世界书/.test(heading))return '世界书章节';
  if(/本场已结束对话记录|当前现场|本轮在你之前|最近.*(?:微信|对话|聊天)|统一.*时间线|跨.*(?:场景|通道)|连续性核对|本轮是从线下/.test(heading))return '历史与跨场景承接章节';
  if(/记忆|概要|总结|小事簿|小账|经历/.test(heading))return '记忆与摘要章节';
  if(/人设|身份|姓名|称呼|关系|玩家资料/.test(heading))return '人设、身份与关系章节';
  if(/时间|日历|时钟|所在地|当前.*(?:状态|地点)|作息/.test(heading))return '时间与现场状态章节';
  if(/规则|能力|权限|格式|标签|内心|引用回复|优先|你能|微信聊天|自主性|授权/.test(heading))return '功能与回复规则章节';
  return '其他系统章节';
}
function systemParts(text,add){
  const re=/(?:^|\n)(?:#{1,4}[ \t]+([^\r\n]+)|【((?:本轮发送前连续性核对|本轮是从线下)[^\r\n]*))/g;
  let from=0,label='系统开头与基础内容',m;
  while((m=re.exec(text))){if(m.index>from)add(label,text.slice(from,m.index).length);from=m.index;label=sectionKind(m[1]||m[2]||'');}
  if(from<text.length)add(label,text.slice(from).length);
}
window.requestSizeBreakdown=function(messages,total){
  if(!Array.isArray(messages))return null;
  const groups=new Map(),messageRows=[];let bodyChars=0,lastUser=-1;
  messages.forEach((m,i)=>{if(m&&m.role==='user')lastUser=i;});
  const add=(label,chars)=>{if(!chars)return;bodyChars+=chars;groups.set(label,(groups.get(label)||0)+chars);};
  messages.forEach((m,i)=>{
    m=m||{};const content=m.content,role=m.role;let chars=0,label;
    if(typeof content==='string'){
      chars=content.length;
      if(role==='system'||role==='developer'){label='系统消息';systemParts(content,add);}
      else{label=role==='assistant'?'历史消息·角色':role==='user'?(i===lastUser?'末条用户或事件输入':'历史消息·用户'):role==='tool'?'工具结果':'其他消息';add(label,chars);}
    }else if(content!=null){chars=JSON.stringify(content).length;label='图像或结构化内容';add(label,chars);}
    else label=role==='system'?'系统消息':'空消息';
    messageRows.push({index:i+1,label,chars});
  });
  const overhead=total-bodyChars;if(!Number.isFinite(total)||overhead<0)return null;
  groups.set('消息格式、字段与转义',overhead);
  return {version:1,total,groups:Array.from(groups,([label,chars])=>({label,chars})).sort((a,b)=>b.chars-a.chars),messages:messageRows};
};
wechatRequestStats=function(messages){const stats=baseStats.apply(this,arguments);try{const serialized=JSON.stringify(messages||[]);if(serialized.length===stats.requestChars){const breakdown=window.requestSizeBreakdown(messages,stats.requestChars);if(breakdown)stats.requestBreakdown=breakdown;}}catch(_){}return stats;};
window.requestSizeDetailsHtml=function(record){
  const d=record&&record.requestBreakdown,valid=d&&d.version===1&&Array.isArray(d.groups)&&Array.isArray(d.messages)&&d.groups.concat(d.messages).every(x=>x&&Number.isFinite(x.chars)&&x.chars>=0)&&d.total===record.requestChars&&d.groups.reduce((n,x)=>n+x.chars,0)===d.total;
  const item=(label,chars,percent)=>'<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>'+esc(label)+'</span><span style="text-align:right;white-space:nowrap">'+chars.toLocaleString()+' 字符'+(percent?' · '+(d.total?chars/d.total*100:0).toFixed(1)+'%':'')+'</span></div>';
  const content=valid?d.groups.map(x=>item(x.label,x.chars,true)).join('')+item('合计',d.total,false)+'<details style="margin-top:10px"><summary style="cursor:pointer;padding:8px 0">逐条消息正文占用（'+d.messages.length+' 条）</summary>'+d.messages.map(x=>item('第 '+x.index+' 条 · '+x.label,x.chars,false)).join('')+'</details><div class="hint" style="margin-top:10px;line-height:1.65">按这次请求的消息和系统章节归类；未明确归类的放在“其他系统章节”。末条用户消息也可能是事件或纠正要求。正文按现有字符口径统计，JSON 格式与转义另列；结构化内容按序列化长度统计。分项相加等于上方总数，不是 token 数或整轮账单，不含其他请求。这里只保存分类和数字。</div>':'<div class="hint" style="padding:8px 0">这条旧记录没有分项数据。更新后让角色回复一次，再查看新记录；不会用当前设置猜测旧请求。</div>';
  return '<details class="request-size-details" style="padding:0 14px 10px"><summary style="cursor:pointer;color:#91c7fa;padding:9px 0;font-size:13px">查看详情</summary><div style="font-size:12px;line-height:1.55">'+content+'</div></details>';
};
})();
