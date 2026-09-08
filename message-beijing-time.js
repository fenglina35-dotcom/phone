/* Presentation only: never change message times, prompts, or the device time zone. */
(function(root){
 'use strict';
 function enabled(){return typeof S!=='undefined'&&!!(S.settings&&S.settings.beijingMessageTimes);}
 function label(message){
  const raw=message&&(message.time!=null?message.time:message.ts);
  const at=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):NaN;
  if(!Number.isFinite(at)||at<=0||at>8640000000000000-28800000)return '北京时间未知';
  const date=new Date(at+28800000),pad=n=>String(n).padStart(2,'0');
  return date.getUTCFullYear()+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate())+' '+pad(date.getUTCHours())+':'+pad(date.getUTCMinutes())+':'+pad(date.getUTCSeconds())+' 北京时间';
 }
 function html(message){if(!enabled()||!message||message.type==='sys'||message._silent)return '';return '<div class="msgt beijing-message-time" style="display:block!important;visibility:visible!important;opacity:1!important;font-size:10px;line-height:1.5;margin-top:4px;white-space:normal;overflow-wrap:anywhere" aria-label="消息实际记录时间">'+label(message)+'</div>';}
 function toggle(){if(typeof S==='undefined')return;S.settings=S.settings||{};S.settings.beijingMessageTimes=!enabled();save();render();}
 function setting(){return '<div class="it"><span>每条气泡显示北京时间<br><small style="color:#888">你和对方每条消息下显示记录时刻（UTC+8，精确到秒），不使用模型时间。关闭恢复原样；没有时间的旧记录显示未知。时间准确性取决于原记录设备或服务器的时钟。</small></span><span id="beijingMessageTimesToggle" class="sw '+(enabled()?'on':'')+'" role="switch" aria-checked="'+enabled()+'" onclick="messageBeijingTimeToggle()"></span></div>';}
 root.messageBeijingTimeHTML=html;root.messageBeijingTimeToggle=toggle;root.messageBeijingTimeSettingHTML=setting;
 root.NorthMessageTime={enabled,label,html};
})(globalThis);
