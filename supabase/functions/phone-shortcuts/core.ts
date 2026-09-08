export const MODES = new Set(['user_message','role_event']);
export function validId(value: unknown) { return typeof value==='string' && /^[A-Za-z0-9_-]{8,100}$/.test(value); }
export function publicHost(host: string) {
 const h=host.toLowerCase().replace(/^\[|\]$/g,'');
 if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal'))return false;
 if(h.includes(':'))return false; // Reject literal IPv6; DNS IPv6 answers are checked separately.
 if(/^\d+\.\d+\.\d+\.\d+$/.test(h))return publicIPv4(h);
 return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h);
}
export function publicIPv4(ip: string) {
 const a=ip.split('.').map(Number);if(a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&(a[1]===18||a[1]===19));
}
export function modelURL(value: unknown) {
 const u=new URL(String(value||''));
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||!publicHost(u.hostname))throw Error('invalid-model-url');
 u.pathname=u.pathname.replace(/\/+$/,'')+'/chat/completions';return u;
}
export function validateConfig(value: any) {
 if(!value||typeof value!=='object')throw Error('invalid-config');
 const route=value.route;
 if(!route||typeof route.key!=='string'||!route.key||route.key.length>2000||typeof route.model!=='string'||!route.model||route.model.length>200)throw Error('model-not-configured');
 modelURL(route.base);
 const system=String(value.system||'');if(!system||system.length>60000)throw Error('invalid-context');
 const history=(Array.isArray(value.history)?value.history:[]).slice(-40).filter((r:any)=>r&&['user','assistant'].includes(r.role)&&typeof r.content==='string').map((r:any)=>({role:r.role,content:r.content.slice(0,3000)}));
 return {system,history,unfiltered:value.unfiltered===true,syncedAt:Date.now(),route:{base:String(route.base),key:route.key,model:route.model,temp:Math.max(0,Math.min(2,Number(route.temp)||.8)),maxTokens:Math.max(120,Math.min(4000,Number(route.maxTokens)||900))}};
}
export function modelMessages(config: any,job: any,now=Date.now()) {
 const clock=new Date(now+28800000).toISOString().slice(0,19).replace('T',' ')+' 北京时间';
 const source=job.mode==='user_message'?'下面是用户明确配置由快捷指令代发的一条消息；用户未必正在看屏幕。回应这条新消息。':'下面是用户授权的快捷指令报告的事件，不是用户刚发的聊天，不要冒充用户开口。请按你的身份主动给用户发消息回应本事件。';
 return [{role:'system',content:config.system},...config.history,{role:'user',content:source+'\n'+job.input_text},{role:'system',content:'当前服务器真实时间：'+clock+'。背景资料仅同步至 '+new Date(config.syncedAt).toISOString()+'，不能编造之后的经历。此次快捷指令只授权发送文字消息，不执行设备、付款、来电、发动态或其他操作；不要声称已做这些操作，也不要输出动作标签。只给出角色本人的消息正文，可以分行，不代写用户回复。'}];
}
export function visibleReply(text: unknown,unfiltered=false) {
 if(typeof text!=='string'||!text.trim())throw Error('empty-model-reply');
 const body=text.replace(/[\[【]\s*(?:内心|心情|小事簿|记住)\s*[|｜:：][^\]】]*[\]】]/g,'');
 // No action execution in the cloud automation channel; unknown raw text is preserved.
 const result=(unfiltered?body:body.trim()).slice(0,30000);
 if(!result.trim())throw Error('empty-model-reply');
 if(/[a-zA-Z]/.test(result)&&!/[\u3400-\u9fff]/.test(result))throw Error('english-only-output');
 if(/(?:as an ai|I am (?:an? |a helpful and harmless )AI|我是(?:一个|一名)?(?:AI|人工智能)|无法扮演.{0,15}角色)/i.test(result))throw Error('model-refusal');
 return result;
}
