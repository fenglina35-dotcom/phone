// The subtitle and the spoken sentence are deliberately separate fields.
export const DEMO_ZH='你回来啦。今天过得怎么样？我一直在这里等你。';
export const DEMO_EN="You're back. How was your day? I've been here waiting for you.";
export function chineseSubtitle(value){
 const text=typeof value==='string'?value.trim():'';
 if(!text||text.length>360)throw new Error('需要提供完整的中文字幕');
 // Fail closed on untranslated words, including mixed Chinese/English output.
 if(/[\p{L}]/u.test(text.replace(/\p{Script=Han}/gu,'')))throw new Error('字幕必须是中文，请先提供中文译文');
 return text;
}
export function dialogueText(value,voiceLanguage='zh-CN'){
 const structured=value!==null&&typeof value==='object';
 const displayText=chineseSubtitle(structured?value.displayText:value);
 const language=structured&&value.language?String(value.language):voiceLanguage;
 let spokenText=structured?value.spokenText:undefined;
 if(spokenText==null){
  if(/^zh(?:-|$)/i.test(language))spokenText=displayText;
  else if(/^en(?:-|$)/i.test(language)&&displayText===DEMO_ZH)spokenText=DEMO_EN;
  else throw new Error('已选择外语声音，但还缺少对应的语音文本和中文译文');
 }
 if(typeof spokenText!=='string'||!spokenText.trim()||spokenText.length>720)throw new Error('语音内容不完整');
 return {displayText,spokenText:spokenText.trim(),language};
}
