import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function lineFunctionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, end < 0 ? source.length : end).trim();
}

assert.match(source, /APP_VER='v1024 · 低功耗定位生命周期与发热修复'/);
assert.match(source, /cinema:\{e:'',c:'linear-gradient\([^\n]+t:'放映室',icon:'cinema',lk:1\}/);
assert.match(source, /cinema:\(\)=>openApp\('cinema'\)/);
assert.match(source, /cinema:\(\)=>\{cinemaInit\(\);go\('cinema'\);\}/);
assert.match(source, /cinemawatch:'cinema',cinemaread:'cinema'/);
assert.match(source, /else if\(c\.p==='cinemawatch'\)html=renderCinemaWatch\(\)/);
assert.match(source, /else if\(c\.p==='cinemaread'\)html=renderCinemaRead\(\)/);

assert.match(source, /video\/mp4,video\/webm,video\/quicktime/);
assert.match(source, /\.srt,\.vtt,text\/vtt/);
assert.match(source, /\.txt,\.md,\.epub/);
assert.match(functionSource("cinemaOpenVideo"), /cinemaPlayableVideoBlob\(f,f\.name,f\.type\)/);
assert.match(functionSource("cinemaLibraryPlay"), /cinemaPlayableVideoBlob\(blob,item\.fileName,item\.mime\)/);
assert.match(functionSource("cinemaPlayableVideoBlob"), /\.mov[\s\S]*cinemaAndroidBrowser\(\)\?'video\/mp4':'video\/quicktime'/);
assert.match(functionSource("cinemaPlayableVideoBlob"), /octet-stream[\s\S]*video\/mp4/);
assert.match(functionSource("cinemaVideoCodecProbe"), /cinemaMp4Library\(\)[\s\S]*videoCodec[\s\S]*audioCodec/);
assert.match(functionSource("cinemaVideoErrorReason"), /HEVC \/ H\.265[\s\S]*安卓浏览器/);
assert.match(functionSource("cinemaVideoPlaybackError"), /MP4 容器、H\.264 \/ AVC 视频、AAC 音频/);
assert.doesNotMatch(source, /S\.cinema\.(?:videoFile|bookText)\s*=/);
assert.match(source, /cinemaOpenOnlineModal/);
assert.match(source, /cinemaOpenOnline\(\)[\s\S]*?https\?:/);
assert.match(functionSource("renderCinema"), /正版视频片库/);
assert.match(functionSource("renderCinema"), /更多搜索/);
assert.match(functionSource("cinemaOpenSearchModal"), /夸克[\s\S]*百度[\s\S]*必应/);
assert.match(functionSource("cinemaOpenSearchModal"), /target="_blank"[\s\S]*noopener noreferrer external/);
assert.match(functionSource("cinemaLaunchSearch"), /S\.browser\.history\.unshift/);
assert.match(source, /function cinemaRenameSave/);
assert.match(source, /function cinemaLibraryPlay/);
assert.doesNotMatch(functionSource("cinemaLibraryHTML"), /slice\(0,\s*12\)/, "video box and bookshelf must not hide older saved items");
assert.match(source, /从头开始/);
assert.match(source, /cinemaStoreKey\('video'/);
assert.match(source, /indexedDB\.open\('yibeiCinema',1\)/);
assert.match(source, /await cinPut\(key,f\)/);
assert.match(source, /scanIDBStoreBytes\(cinDB,'media'/);
assert.match(source, /视频盒/);
assert.match(source, /书架/);

const helperContext = vm.createContext({});
vm.runInContext(
  ["cinemaParseTime", "cinemaParseSubtitles", "cinemaPaginate"].map(lineFunctionSource).join("\n") +
  ";globalThis.parse=cinemaParseSubtitles;globalThis.paginate=cinemaPaginate;",
  helperContext,
);
const cues = helperContext.parse(`WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n第一句\n\n00:00:10.500 --> 00:00:12.000\n第二句`);
assert.equal(cues.length, 2);
assert.equal(cues[0].start, 1);
assert.equal(cues[1].start, 10.5);
assert.equal(cues[1].text, "第二句");
const compactCues = helperContext.parse(`1\n00:01,00 --> 00:03,50\n没有空行的第一句\n2\n00:04.000 --> 00:06.000\n没有空行的第二句`);
assert.equal(compactCues.length, 2);
assert.equal(compactCues[0].start, 1);
assert.equal(compactCues[1].text, "没有空行的第二句");
const decodeContext = vm.createContext({ TextDecoder, Uint8Array, ArrayBuffer });
vm.runInContext(lineFunctionSource("cinemaDecodeText") + ";globalThis.decode=cinemaDecodeText;", decodeContext);
const utf16Text = "1\n00:00:01,000 --> 00:00:02,000\n中文字幕";
const utf16Bytes = new Uint8Array(2 + utf16Text.length * 2);
utf16Bytes[0] = 0xff; utf16Bytes[1] = 0xfe;
for (let i = 0; i < utf16Text.length; i++) {
  const code = utf16Text.charCodeAt(i);
  utf16Bytes[2 + i * 2] = code & 0xff;
  utf16Bytes[3 + i * 2] = code >> 8;
}
assert.match(decodeContext.decode(utf16Bytes.buffer), /中文字幕/);
const pages = helperContext.paginate("第一段。".repeat(180) + "\n\n" + "第二段。".repeat(180), 500);
assert.ok(pages.length >= 3);
assert.ok(pages.every((page) => page.length <= 510));

const searchContext = vm.createContext({ encodeURIComponent, String });
vm.runInContext(lineFunctionSource("cinemaSearchUrl") + ";globalThis.url=cinemaSearchUrl;", searchContext);
assert.equal(searchContext.url("quark", "video", "海绵宝宝"), "https://quark.sm.cn/s?q=" + encodeURIComponent("海绵宝宝 电影 电视剧 在线观看"));
assert.equal(searchContext.url("baidu", "book", "活着"), "https://m.baidu.com/s?word=" + encodeURIComponent("活着 小说 在线阅读"));
assert.equal(searchContext.url("bing", "video", "流浪地球"), "https://www.bing.com/search?q=" + encodeURIComponent("流浪地球 电影 电视剧 在线观看"));

const timedOffsetContext = vm.createContext({});
vm.runInContext(lineFunctionSource("sttTimedRows") + ";globalThis.rows=sttTimedRows({segments:[{start:1.5,end:3,text:'  hello   world  '}]},300);", timedOffsetContext);
assert.deepEqual(JSON.parse(JSON.stringify(timedOffsetContext.rows)), [{ start:301.5, end:303, text:"hello world", source:"extract" }]);

const contextSandbox = vm.createContext({
  _cin: { cues: [
    { start: 5, end: 7, text: "过去" },
    { start: 18, end: 22, text: "当前" },
    { start: 19, end: 20, text: "语音转写", source: "speech" },
    { start: 30, end: 33, text: "未来剧透" },
  ] },
  cinemaFmt: (n) => String(n),
});
vm.runInContext(lineFunctionSource("cinemaSubtitleContext") + ";globalThis.ctx=cinemaSubtitleContext(20);", contextSandbox);
assert.match(contextSandbox.ctx, /过去/);
assert.match(contextSandbox.ctx, /当前/);
assert.doesNotMatch(contextSandbox.ctx, /语音转写/);
assert.doesNotMatch(contextSandbox.ctx, /未来剧透/);

assert.match(source, /严禁引用后面的剧情/);
assert.match(source, /不要动作描写、第三人称叙述、括号舞台说明、心情标签/);
assert.match(source, /没有可用字幕，只知道片名；不要假装知道具体剧情/);
assert.match(source, /当前屏幕字幕/);
assert.doesNotMatch(source, /播放时转写/);
assert.doesNotMatch(source, /function cinemaStartTranscribe/);
assert.doesNotMatch(source, /function cinemaToggleTranscribe/);
assert.match(source, /function cinemaExtractSubtitles/);
assert.match(source, /function cinemaExtractAudioSubtitles/);
assert.match(source, /function cinemaAudioChunkWav/);
assert.match(source, /function sttTimedRows/);
assert.match(source, /function cinemaExtractHelp/);
assert.match(source, /sttTranscribeTimed\(f/);
assert.match(source, /cinemaExtractAudioSubtitles\(90,'watch'\)/);
assert.match(source, /cinemaExtractAudioSubtitles\(90,'background'\)/);
assert.match(source, /sttRequest\(wav,/);
assert.match(source, /sttTimedRows\(j,start\)/);
assert.match(source, /边看边提取（推荐）/);
assert.match(source, /timestamp_granularities\[\]/);
assert.match(source, /接口没有返回分段时间戳/);
assert.match(source, /function cinemaAnalyzeFrame/);
assert.match(source, /visionAPI\(data/);
assert.match(functionSource("cinemaDecodeText"), /utf-16le/);
assert.match(functionSource("cinemaDecodeText"), /utf-16be/);
assert.match(functionSource("cinemaPickSubtitle"), /privateNativeAppOn\(\)\?'':/);
assert.match(functionSource("cinemaPickSubtitle"), /cinPut\(cinemaManualSubtitleKey\(s\)/);
assert.match(functionSource("cinemaRestoreStoredSubtitles"), /手动导入字幕/);
assert.match(functionSource("cinemaDeleteStoredSubtitles"), /subtitle-file/);
assert.match(functionSource("cinemaAnalyzeFrame"), /【字幕：原文】/);
assert.match(functionSource("cinemaAnalyzeFrame"), /cinemaApplyVisionSubtitle/);
assert.match(functionSource("cinemaApplyVisionSubtitle"), /source:'vision-subtitle'/);
assert.match(source, /visionInterval/);
assert.match(source, /visionOnAsk/);
assert.match(source, /visionByRole/);
assert.match(functionSource("cinemaVisionMenu"), /cinVisionEnabled/);
assert.match(functionSource("cinemaVisionSave"), /set\.visionEnabled=enabled/);
assert.match(functionSource("cinemaVisionSave"), /s\.nextVisionAt=set\.autoVision/);
assert.match(functionSource("cinemaVisionIntervalLabel"), /150:'2分30秒'/);
assert.match(functionSource("cinemaVideoTick"), /set\.visionEnabled&&set\.autoVision/);
assert.match(functionSource("cinemaAfterVideoRender"), /cinemaVisionResetTimer\(s,Math\.max\(0,Number\(v\.currentTime\)\|\|Number\(s\.progress\)\|\|0\)\)/);
assert.match(functionSource("cinemaAfterVideoRender"), /if\(v\.readyState>=1\)ready\(\)/);
assert.match(functionSource("cinemaAfterVideoRender"), /seeked[\s\S]*cinemaVisionResetTimer\(s,v\.currentTime\)/);
assert.match(functionSource("cinemaAfterVideoRender"), /error[\s\S]*cinemaVideoPlaybackError\(v\)/);
assert.match(functionSource("cinemaAnalyzeFrame"), /automatic&&\(!set\.visionEnabled/);
assert.doesNotMatch(functionSource("cinemaAnalyzeFrame"), /settings\.autoVision=false/);
assert.match(functionSource("cinemaAnalyzeFrame"), /秒后自动重试/);
assert.match(functionSource("cinemaAnalyzeFrame"), /cinemaVisionReact\(s,token,reactSeq,0\)/);
assert.match(functionSource("cinemaUpdateSubtitle"), /statusLockUntil/);
assert.match(functionSource("cinemaVisionReact"), /等待角色接话/);
assert.match(functionSource("cinemaVisionReact"), /不要保持沉默/);
assert.match(functionSource("cinemaPickVideo"), /\.m4v,\.mov/);
assert.match(source, /cinemaQuestionNeedsVision/);
assert.match(source, /识别中…/);
assert.match(source, /function cinemaShowDialogueSubtitle/);
assert.doesNotMatch(source, /function cinemaShowVoiceSubtitle/);
assert.doesNotMatch(source, /speak\(outs\.map/);
assert.match(functionSource("cinemaRoleReply"), /speakText:voiceOn\?out\.spoken:''/);
assert.match(source, /commentDisplay:'barrage'/);
assert.match(source, /captionSpeed:'base'/);
assert.match(source, /function cinemaCommentDisplay/);
assert.match(source, /function cinemaCommentDisplaySave/);
assert.match(source, /function cinemaCaptionSpeed/);
assert.match(source, /function cinemaCaptionSpeedSave/);
assert.match(source, /弹幕模式/);
assert.match(source, /底部字幕模式/);
assert.doesNotMatch(source, /角色已读到当前字幕/);
assert.doesNotMatch(source, /当前画面已理解/);
assert.match(source, /voiceLang:'role'/);
assert.match(source, /bookVoice:false/);
assert.match(source, /chatPanelHeight:104/);
assert.match(source, /readerPaneHeight:0/);
assert.match(source, /replyCount:1/);
assert.match(source, /companionMode:'soft'/);
assert.match(source, /autoLimit:4/);
assert.match(source, /function cinemaCompanionMenu/);
assert.match(source, /function cinemaCanAutoSpeak/);
assert.match(source, /id="cinBookCompanionBtn"/);
assert.match(source, /data-cin-action="auto"/);
assert.match(source, /点这里调整书架陪伴/);
assert.match(source, /\['#cinAutoBtn','#cinBookCompanionBtn'\]/);
assert.doesNotMatch(source, /bookInputHeight:108/);
assert.match(source, /function cinemaToggleBookVoice/);
assert.match(source, /s\.kind==='book'\?set\.bookVoice:set\.voiceComment/);
assert.match(source, /function cinemaComposerResizeStart/);
assert.match(source, /document\.addEventListener\('pointermove',move\)/);
assert.match(source, /function cinemaControlTap/);
assert.match(source, /function cinemaControlPointerUp/);
assert.match(source, /function cinemaControlClick/);
assert.match(source, /function cinemaControlPointerDown/);
assert.match(source, /b\.addEventListener\('pointerup',cinemaControlPointerUp\)/);
assert.match(source, /b\.addEventListener\('click',cinemaControlClick\)/);
assert.match(source, /Math\.hypot\(p\.x-start\.x,p\.y-start\.y\)>12/);
assert.doesNotMatch(functionSource("cinemaBindControls"), /touchend/);
assert.doesNotMatch(source, /function cinemaIsIOS/);
assert.match(source, /id="cinMediaControls" class="cin-media-controls/);
assert.match(source, /webkit-playsinline disablepictureinpicture/);
assert.doesNotMatch(source, /id="cinVideo"[^>]* controls/);
assert.match(source, /data-cin-resize="reader"/);
assert.doesNotMatch(source, /data-cin-resize="book"/);
assert.ok(source.indexOf('class="cin-reader-divider"') < source.indexOf('class="cin-reader-actions"'));

const visionTimerState={settings:{visionEnabled:true,autoVision:true,visionInterval:150}};
const visionSession={progress:0,duration:600,nextVisionAt:0,updatedAt:0};
const visionVideo={currentTime:0,duration:600,paused:false};
let visionTriggered=0,visionSaved=0;
const visionTimerContext=vm.createContext({
  _cin:{lastSaveAt:Date.now(),visionBusy:false,cues:[]},
  cinemaInit:()=>visionTimerState,
  cinemaSession:()=>visionSession,
  cinemaAsrGuardPlayback:()=>false,
  cinemaUpdateSubtitle:()=>{},cinemaSyncMediaControls:()=>{},cinemaSaveProgress:()=>{},
  cinemaCueAt:()=>null,cinemaAnalyzeFrame:()=>{visionTriggered++;},cinemaCanAutoSpeak:()=>false,
  cinemaAutoGap:()=>230,cinemaRoleReply:()=>{},save:()=>{visionSaved++;},
  $:selector=>selector==='#cinVideo'?visionVideo:null,
  Math,Number,Date,
});
vm.runInContext(functionSource("cinemaVisionResetTimer")+'\n'+functionSource("cinemaVideoTick")+';globalThis.reset=cinemaVisionResetTimer;globalThis.tick=cinemaVideoTick;',visionTimerContext);
assert.equal(visionTimerContext.reset(visionSession,0),150);
visionVideo.currentTime=149;visionTimerContext.tick();
assert.equal(visionTriggered,0);
visionVideo.currentTime=150;visionTimerContext.tick();
assert.equal(visionTriggered,1,'the configured 2m30s frame check must fire at 150 seconds');
assert.equal(visionSession.nextVisionAt,300,'the next frame check must remain scheduled after triggering');
assert.ok(visionSaved>=2);

const cinemaEndSource=functionSource("cinemaEnd");
assert.doesNotMatch(functionSource("cinemaTranscript"), /cinemaProgressText/);
assert.doesNotMatch(functionSource("cinemaFallbackMemory"), /cinemaProgressText/);
assert.doesNotMatch(cinemaEndSource, /cinemaCleanRoleText/);
assert.doesNotMatch(cinemaEndSource, /90到180/);
assert.match(cinemaEndSource, /最多300字/);
assert.match(cinemaEndSource, /禁止写影片全长、观看时长、分钟数、时间点或播放进度/);
assert.match(cinemaEndSource, /cinemaSummaryClean\(raw,len\.max\)/);
const summaryContext=vm.createContext({
  summaryStripModelNoise:x=>String(x||'').trim(),cleanReply:x=>String(x||''),
  trimSentence:(x,n)=>Array.from(x).slice(0,n).join(''),Math,Array,
});
vm.runInContext(functionSource("cinemaSummaryClean")+';globalThis.clean=cinemaSummaryClean;',summaryContext);
const cleanedSummary=summaryContext.clean('影片全长约10分钟。我们一起看了7分钟，主角终于愿意面对自己的恐惧。',300);
assert.doesNotMatch(cleanedSummary,/全长|10分钟|7分钟|观看时长|播放进度/);
assert.match(cleanedSummary,/主角终于愿意面对自己的恐惧/);
const summaryLengthContext=vm.createContext({cinemaWatchedHighlights:()=>'',Array});
vm.runInContext(functionSource("cinemaSummaryLength")+';globalThis.lengthFor=cinemaSummaryLength;',summaryLengthContext);
assert.deepEqual({...summaryLengthContext.lengthFor({items:[{text:'短内容'}]})},{min:50,max:110});
assert.deepEqual({...summaryLengthContext.lengthFor({items:[{text:'长'.repeat(1800)}]})},{min:150,max:300});
assert.match(source, /function cinemaReplyCountMenu/);
assert.match(source, /automatic\?1:cinemaRandomReplyCount\(\)/);
assert.match(source, /function cinemaRandomReplyCount/);
assert.match(source, /1\+Math\.floor\(Math\.random\(\)\*limit\)/);
assert.match(source, /data-cin-action="media-hide"/);
assert.doesNotMatch(functionSource("cinemaMediaToggle"), /toast\(/);
assert.match(source, /_cin\.mediaOpen===false\)cinemaMediaToggle\(true\)/);
assert.doesNotMatch(functionSource("cinemaAnalyzeFrame"), /!opt\.silentReply&&!_cin\.busy/);
assert.match(functionSource("cinemaAnalyzeFrame"), /if\(!opt\.silentReply\)setTimeout\(\(\)=>cinemaVisionReact/);
assert.match(source, /addSummary\(c,memory,4,'【放映室】'\)/);
assert.match(source, /cinemaSessionId=s\.id/);
assert.match(source, /S\.cinema\.sessions=\(S\.cinema\.sessions\|\|\[\]\)\.filter\(x=>x&&x\.cid!==id\)/);
assert.match(source, /function cinemaSessionContext/);
assert.match(source, /function cinemaClearSessionContext/);
assert.match(source, /_cinemaSessionId/);
assert.match(source, /function cinemaRemoveWechatContext/);
assert.match(source, /function cinemaRenderKeepScroll/);
assert.match(source, /slice\(-\(cinemaContextRounds\(\)\*2\)\)/);
assert.match(source, /Object\.keys\(S\.messages\|\|\{\}\)/);
assert.match(source, /accountId:actId\(\)/);
assert.match(source, /msgsForAccount\(s\.cid,s\.accountId\|\|actId\(\)\)/);
assert.match(source, /function cinemaMirrorLifecycle/);
assert.match(source, /function cinemaInviteLibrary/);
assert.match(source, /type:'cinemainvite'/);
assert.match(source, /\[放映邀请\|/);
assert.match(source, /\[同意放映\]/);
assert.match(source, /\[拒绝放映\]/);

const behavior = vm.createContext({
  cinemaVoiceLang: () => "en",
  cleanReply: (value) => String(value || "").trim(),
  hasForeign: (value) => /[A-Za-z]/.test(value),
});
vm.runInContext(
  lineFunctionSource("cinemaQuestionNeedsVision") + "\n" +
  lineFunctionSource("cinemaOneSentence") + "\n" +
  lineFunctionSource("cinemaParseRolePayloads") + "\n" +
  lineFunctionSource("cinemaParseRolePayload") +
  ";globalThis.needsVision=cinemaQuestionNeedsVision;globalThis.parseRole=cinemaParseRolePayload;globalThis.parseRoles=cinemaParseRolePayloads;",
  behavior,
);
assert.equal(behavior.needsVision("画面里这个人是谁？"), true);
assert.equal(behavior.needsVision("我很喜欢这段音乐"), false);
const bilingual = behavior.parseRole("That was a beautiful scene.\n（这一幕很美。）", {});
assert.equal(bilingual.spoken, "That was a beautiful scene.");
assert.equal(bilingual.translation, "这一幕很美。");
assert.equal(bilingual.valid, true);
const oneSentence = behavior.parseRole("I love this part. I also know the ending.\n（我喜欢这里。后面我也知道。）", {});
assert.equal(oneSentence.spoken, "I love this part.");
assert.equal(oneSentence.translation, "我喜欢这里。");
const bilingualMany = behavior.parseRoles("I like this scene.\n（我喜欢这一幕。）\nThat was unexpected.\n（这一幕真意外。）", {}, 2);
assert.equal(bilingualMany.length, 2);
assert.equal(bilingualMany[1].spoken, "That was unexpected.");

const randomReply = vm.createContext({ cinemaReplyCount: () => 5, Math: { floor: Math.floor, random: () => 0.99 } });
vm.runInContext(lineFunctionSource("cinemaRandomReplyCount") + ";globalThis.count=cinemaRandomReplyCount();", randomReply);
assert.equal(randomReply.count, 5);

const memoryState = {
  messages: {
    "role-a#account-a": [
      { id: "keep-a" },
      { id: "remove-a", _cinemaSessionId: "session-1" },
    ],
    "role-a#account-b": [
      { id: "remove-b", _cinemaSessionId: "session-1" },
      { id: "keep-b", _cinemaSessionId: "session-2" },
    ],
    __idb: "messages",
  },
};
const memoryBehavior = vm.createContext({ S: memoryState });
vm.runInContext(lineFunctionSource("cinemaRemoveWechatContext") + ";cinemaRemoveWechatContext('session-1');", memoryBehavior);
assert.deepEqual(memoryState.messages["role-a#account-a"].map((m) => m.id), ["keep-a"]);
assert.deepEqual(memoryState.messages["role-a#account-b"].map((m) => m.id), ["keep-b"]);

const watch = functionSource("renderCinemaWatch");
assert.match(watch, /cin-overlay-top/);
assert.match(watch, /cin-chat-dock/);
assert.match(watch, /data-cin-action="chat-open"/);
assert.match(watch, /id="cinMediaControls"/);
assert.match(watch, /aria-label="隐藏播放进度"/);
assert.match(watch, /data-cin-resize="video"/);
assert.match(watch, /id="cinVideoMic"/);
assert.match(watch, /data-cin-action="mic"/);
assert.match(watch, /data-kind="video"/);
assert.match(watch, /--cin-chat-h:/);
assert.match(watch, /cinTopReveal/);
assert.match(watch, /data-cin-action="end"/);
assert.doesNotMatch(watch, /id="cinLog"/);
assert.doesNotMatch(watch, /cin-context/);
assert.doesNotMatch(watch, /event\.stopPropagation/);
assert.doesNotMatch(source, /把故事留在/);

const toolsHtmlContext = vm.createContext({
  _cin: { cues: [] },
  cinemaInit: () => ({ settings: {} }),
  cinemaRole: () => ({}),
  cinemaReplyCount: () => 1,
  cinemaVoiceLangLabel: () => "中文",
  cinemaVisionIntervalLabel: () => "画面 按需",
  cinemaCompanionMode: () => "soft",
  cinemaCompanionLabel: () => "轻声陪伴",
  cinemaAutoLimit: () => 4,
  cinemaCommentDisplay: () => "barrage",
  cinemaCaptionSpeedLabel: () => "快",
  svgIc: () => "",
});
vm.runInContext(functionSource("cinemaStageTools") + ";globalThis.html=cinemaStageTools();", toolsHtmlContext);
assert.doesNotMatch(toolsHtmlContext.html, /data-cin-action="subtitle"/);
assert.match(toolsHtmlContext.html, /data-cin-action="extract"/);
assert.match(toolsHtmlContext.html, /轻声陪伴 · 4条\/场/);
assert.doesNotMatch(toolsHtmlContext.html, /data-cin-action="transcribe"/);
assert.match(toolsHtmlContext.html, /data-cin-action="frame"/);
assert.match(toolsHtmlContext.html, /显示 · 弹幕/);
assert.match(toolsHtmlContext.html, /快/);
assert.doesNotMatch(toolsHtmlContext.html, /data-cin-action="fx"/);
assert.doesNotMatch(toolsHtmlContext.html, /data-cin-action="fullscreen"/);
assert.doesNotMatch(toolsHtmlContext.html, /event\.stopPropagation/);

let tappedAction = "", prevented = false, stopped = false;
const fakeControl = {
  disabled: false,
  dataset: { cinAction: "chat-open" },
  classList: { add() {}, remove() {} },
  isConnected: true,
};
const controlBehavior = vm.createContext({
  _cin: {},
  setTimeout: (fn) => fn(),
  cinemaChatToggle: (open) => { tappedAction = open ? "chat-open" : "chat-close"; },
  controlEvent: {
    target: { closest: () => fakeControl },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  },
});
vm.runInContext(functionSource("cinemaEventPoint") + "\n" + functionSource("cinemaControlTap") + ";cinemaControlTap(controlEvent);", controlBehavior);
assert.equal(tappedAction, "chat-open");
assert.equal(prevented, true);
assert.equal(stopped, true);

let pointerTapCount = 0;
const pointerButton = { disabled: false };
const pointerBehavior = vm.createContext({
  Math,
  Date,
  cinemaControlTap: () => { pointerTapCount++; },
});
vm.runInContext(
  functionSource("cinemaEventPoint") + "\n" +
  functionSource("cinemaControlPointerDown") + "\n" +
  functionSource("cinemaControlPointerUp") +
  ";globalThis.down=cinemaControlPointerDown;globalThis.up=cinemaControlPointerUp;",
  pointerBehavior,
);
pointerBehavior.down({ currentTarget: pointerButton, clientX: 10, clientY: 10 });
pointerBehavior.up({ currentTarget: pointerButton, clientX: 40, clientY: 10, preventDefault() {}, stopPropagation() {} });
assert.equal(pointerTapCount, 0, "horizontal toolbar swipes must not trigger a button");
pointerBehavior.down({ currentTarget: pointerButton, clientX: 10, clientY: 10 });
pointerBehavior.up({ currentTarget: pointerButton, clientX: 12, clientY: 11, preventDefault() {}, stopPropagation() {} });
assert.equal(pointerTapCount, 1, "a steady tap must still trigger immediately");

const resizeListeners = {};
let resizedTo = 0, resizeSaved = 0;
const resizeBehavior = vm.createContext({
  $: () => ({ getBoundingClientRect: () => ({ height: 100 }) }),
  cinemaApplyComposerHeight: (height) => { resizedTo = height; },
  save: () => { resizeSaved++; },
  document: {
    addEventListener: (name, fn) => { resizeListeners[name] = fn; },
    removeEventListener: () => {},
  },
  resizeEvent: { clientY: 120, preventDefault() {} },
});
vm.runInContext(functionSource("cinemaComposerResizeStart") + ";cinemaComposerResizeStart(resizeEvent);", resizeBehavior);
resizeListeners.pointermove({ clientY: 70 });
assert.equal(resizedTo, 150);
resizeListeners.pointerup();
assert.equal(resizeSaved, 1);

const reader = functionSource("renderCinemaRead");
assert.match(reader, /id="cinBookVoiceBtn"/);
assert.match(reader, /data-cin-action="book-voice"/);
assert.match(reader, /data-cin-resize="reader"/);
assert.match(reader, /id="cinBookMic"/);
assert.match(reader, /data-cin-action="mic"/);
assert.match(reader, /data-kind="book"/);
assert.match(reader, /cinemaReaderPaneHeight\(\)/);
assert.doesNotMatch(reader, /data-cin-resize="book"/);

const contextRounds = vm.createContext({ S: { settings: { hist: 17 } } });
vm.runInContext(lineFunctionSource("cinemaContextRounds") + ";globalThis.rounds=cinemaContextRounds();", contextRounds);
assert.equal(contextRounds.rounds, 17);

const scrollBoxes = [{ scrollTop: 326 }, { scrollTop: 0 }];
let scrollRead = 0, renderCount = 0;
const scrollBehavior = vm.createContext({
  $: () => scrollBoxes[Math.min(scrollRead++, 1)],
  render: () => { renderCount++; },
  requestAnimationFrame: (fn) => fn(),
});
vm.runInContext(lineFunctionSource("cinemaRenderKeepScroll") + ";cinemaRenderKeepScroll();", scrollBehavior);
assert.equal(renderCount, 1);
assert.equal(scrollBoxes[1].scrollTop, 326);

assert.match(source, /cinema:_MI\(/);
assert.match(source, /HOMEAPPS=[\s\S]*?\['cinema','','放映室'\]/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compress/);
assert.match(html, /\.cin-barrage\{[^}]*background:transparent!important/);
assert.match(html, /\.cin-barrage\.mine\{color:#ff91bd/);
assert.match(html, /\.cin-barrage\.role\{color:#79caff/);
assert.match(html, /\.cin-barrage\{width:76vw;max-width:520px;white-space:pre-line!important/);
assert.doesNotMatch(html, /\.cin-barrage\.float/);
assert.doesNotMatch(html, /\.cin-barrage\.glow/);
assert.doesNotMatch(html, /@keyframes cinfloat/);
assert.doesNotMatch(html, /@keyframes cinglow/);
assert.doesNotMatch(html, /\.cin-barrage\{[^}]*filter:/);
assert.doesNotMatch(source, /function cinemaCycleFx/);
assert.doesNotMatch(source, /data-cin-action="fx"/);
assert.doesNotMatch(source, /barrageFx:'/);
assert.match(source, /delete x\.settings\.barrageFx/);
assert.match(functionSource("cinemaShoot"), /_cin\.shootQueue\.push/);
assert.match(functionSource("cinemaShowShot"), /box\.innerHTML=''/);
assert.match(functionSource("cinemaShowShot"), /d\.style\.top='28%'/);
assert.match(functionSource("cinemaShowShot"), /\+' glide'/);
assert.doesNotMatch(functionSource("cinemaShowShot"), /syncedMs|audioMs/);
assert.match(functionSource("cinemaShowShot"), /cinemaCaptionDuration\(text,mode\)/);
assert.match(functionSource("cinemaShotMs"), /Math\.max\(5500,Math\.min\(9000/);
const captionSpeedState={settings:{captionSpeed:'base'}};
const captionSpeedContext=vm.createContext({cinemaInit:()=>captionSpeedState,cinemaShotMs:()=>5000,Math});
vm.runInContext(functionSource("cinemaCaptionSpeed")+'\n'+functionSource("cinemaCaptionDuration")+';globalThis.duration=cinemaCaptionDuration;',captionSpeedContext);
assert.equal(captionSpeedContext.duration('same text','barrage'),6000);
captionSpeedState.settings.captionSpeed='faster';
assert.equal(captionSpeedContext.duration('same text','barrage'),5000);
captionSpeedState.settings.captionSpeed='slower';
assert.equal(captionSpeedContext.duration('same text','barrage'),7250);
captionSpeedState.settings.captionSpeed='slowest';
assert.equal(captionSpeedContext.duration('same text','barrage'),8750);
assert.match(functionSource("cinemaToggleDanmaku"), />更快</);
assert.match(functionSource("cinemaToggleDanmaku"), />快</);
assert.match(functionSource("cinemaToggleDanmaku"), />标准</);
assert.match(functionSource("cinemaToggleDanmaku"), />更慢</);
assert.doesNotMatch(functionSource("cinemaToggleDanmaku"), />最慢/);
assert.match(functionSource("cinemaShootNext"), /await speakWait\(item\.speakText,item\.speaker,\{onAudioStart:show\}\)/);
assert.doesNotMatch(functionSource("cinemaShootNext"), /const end=_cin\.shootResolve;if\(end\)end\(\)/);
assert.doesNotMatch(functionSource("cinemaShootNext"), /sleep\(/);
const shotOrder=[],shotResolvers=[];
const shotQueueContext=vm.createContext({
  _cin:{shootQueue:[],shootBusy:false,token:9,shootEpoch:0},
  cinemaShowShot:(who,text)=>{shotOrder.push(who+':'+text);return new Promise(resolve=>shotResolvers.push(resolve));},
  speakWait:async()=>{},
  cinemaMicResumeVideo:()=>{},
});
vm.runInContext('async '+functionSource("cinemaShootNext")+'\n'+functionSource("cinemaShoot")+';globalThis.shoot=cinemaShoot;',shotQueueContext);
shotQueueContext.shoot('me','recognized speech');
shotQueueContext.shoot('role','reply');
assert.deepEqual(shotOrder,['me:recognized speech'],'recognized user speech must be shown before the role reply');
assert.equal(shotQueueContext._cin.shootQueue.length,1,'the next barrage must wait in the queue');
shotResolvers.shift()();
let syncedDuration=0;
const syncedShotContext=vm.createContext({
  _cin:{shootQueue:[],shootBusy:false,token:11,shootEpoch:0,busy:false},
  cinemaShowShot:(_who,_text,duration)=>{syncedDuration=duration;return Promise.resolve();},
  speakWait:async(_text,_speaker,opt)=>{opt.onAudioStart(2460);},
  cinemaMicResumeVideo:()=>{},
  Date,
});
vm.runInContext('async '+functionSource("cinemaShootNext")+'\n'+functionSource("cinemaShoot")+';globalThis.shoot=cinemaShoot;',syncedShotContext);
syncedShotContext.shoot('role','sync with speech',{speakText:'sync with speech',speaker:{}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(syncedDuration,2460,'the barrage must appear at audio start and use the spoken audio duration');
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(shotOrder,['me:recognized speech','role:reply'],'queued barrages must appear one at a time and in order');
shotResolvers.shift()();
assert.match(html, /\.cin-stage,\.cin-stage\.cin-theater\{position:fixed;inset:0;z-index:9999/);
assert.match(html, /\.cin-overlay-top\.collapsed/);
assert.match(html, /\.cin-chat-dock\.open/);
assert.match(html, /\.cin-chat-grip/);
assert.match(html, /\.cin-theater-open \.modal\{position:fixed;z-index:10050\}/);
assert.match(html, /\.cin-theater-open \.toast\{position:fixed;z-index:10080\}/);
assert.match(html, /\.cin-chat-reveal\{left:auto;right:max\(14px,env\(safe-area-inset-right\)\);bottom:max\(62px/);
assert.match(html, /\.cin-reader-nav \.cin-reader-voice/);
assert.match(html, /--cin-chat-h/);
assert.match(html, /\.cin-voice-sub\.show/);
assert.match(html, /\.cin-invite-card/);
assert.match(html, /\.cin-memory-scroll/);
assert.match(html, /原创深色影院界面/);
assert.match(source, /function cinemaRoleOccupied/);
const occupiedState = { page: "cinemawatch", session: { cid: "role-a", status: "active" } };
const occupiedBehavior = vm.createContext({
  cur: () => ({ p: occupiedState.page }),
  cinemaSession: () => occupiedState.session,
});
vm.runInContext(lineFunctionSource("cinemaRoleOccupied") + ";globalThis.occupied=cinemaRoleOccupied;", occupiedBehavior);
assert.equal(occupiedBehavior.occupied("role-a"), true);
assert.equal(occupiedBehavior.occupied("role-b"), false);
occupiedState.page = "chat";
assert.equal(occupiedBehavior.occupied("role-a"), false);
assert.match(functionSource("scheduleReply"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("incomingCall"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("aiReply"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("initiativeMaybeSend"), /cinemaRoleOccupied\(c\.id\)/);
assert.match(source, /function cinemaMicToggle/);
assert.match(source, /function cinemaMicResumeVideo/);
assert.match(source, /function cinemaMicRestart/);
assert.match(source, /function cinemaMicStop/);
assert.match(source, /function cinemaMicHeard/);
assert.match(source, /持续话筒已开启，停顿后会自动发送/);
assert.match(functionSource("cinemaMicToggle"), /const sr=makeSR\(\)/);
assert.match(functionSource("cinemaMicToggle"), /sr\.onresult=/);
assert.match(functionSource("cinemaMicToggle"), /if\(finalText\)cinemaMicHeard\(kind,finalText\)/);
assert.doesNotMatch(functionSource("cinemaMicToggle"), /startRec|stopRec/);
assert.doesNotMatch(functionSource("cinemaMicHeard"), /\.pause\(/);
assert.doesNotMatch(functionSource("cinemaMicHeard"), /micResumeVideo=true/);
assert.doesNotMatch(functionSource("cinemaMicHeard"), /已听清并发送/);
assert.match(source, /inp\.value=text/);
assert.match(source, /cinemaSend\(kind\)/);
let micPauseCount=0,micSendCount=0;
const micInput={value:''},micSubtitle={classList:{remove:()=>{}}};
const micPlaybackContext=vm.createContext({
  _cin:{micKind:'video',micBusy:false,micSR:{},micIgnoreUntil:0,busy:false,shootBusy:false,voiceSubTimer:null},
  $:selector=>selector==='#cinInput'?micInput:selector==='#cinVoiceSub'?micSubtitle:selector==='#cinVideo'?{paused:false,pause:()=>{micPauseCount++;}}:null,
  clearTimeout:()=>{},
  cinemaSetStatus:()=>{},
  cinemaSend:()=>{micSendCount++;},
});
vm.runInContext(functionSource("cinemaMicHeard")+';globalThis.heard=cinemaMicHeard;',micPlaybackContext);
micPlaybackContext.heard('video','我边看边说');
assert.equal(micPauseCount,0,'continuous microphone speech must never pause the playing video');
assert.equal(micInput.value,'我边看边说');
assert.equal(micSendCount,1,'recognized speech must still be sent to the role');
let liveHeard='',liveStart=0,liveStop=0;
const liveSr={start:()=>{liveStart++;},stop:()=>{liveStop++;}};
const liveMicContext=vm.createContext({
  _cin:{micKind:'',micBusy:false,micSR:null,micIgnoreUntil:0},
  _rec:null,
  makeSR:()=>liveSr,
  cinemaMicPaint:()=>{},
  cinemaMicResumeVideo:()=>{},
  cinemaMicHeard:(kind,text)=>{liveHeard=kind+':'+text;},
  cinemaSetStatus:()=>{},
  toast:()=>{},
  setTimeout:(fn)=>fn(),
});
vm.runInContext(functionSource("cinemaMicRestart")+'\n'+functionSource("cinemaMicStop")+'\n'+functionSource("cinemaMicToggle")+';globalThis.toggle=cinemaMicToggle;',liveMicContext);
liveMicContext.toggle('video');
assert.equal(liveMicContext._cin.micKind,'video');
assert.equal(liveStart,1);
liveSr.onresult({resultIndex:0,results:Object.assign([{0:{transcript:'我看到这里了'},isFinal:true}],{length:1})});
assert.equal(liveHeard,'video:我看到这里了');
liveMicContext.toggle('video');
assert.equal(liveMicContext._cin.micKind,'');
assert.equal(liveStop,1);
const cinemaSendSource=functionSource("cinemaSend");
assert.ok(cinemaSendSource.indexOf("cinemaAddItem('me',text)")<cinemaSendSource.indexOf("cinemaRoleReply("),'typed or recognized user text must be added before generating the role reply');
assert.match(functionSource("cinemaAddItem"), /cinemaShoot\(who,opt&&opt\.shootText\|\|item\.text,opt\)/);
assert.match(functionSource("cinemaRoleReply"), /shootText:out\.display\|\|out\.spoken/);
assert.match(html, /\.cin-mic\.recording/);
assert.match(html, /\.cin-voice-sub\.mine b/);
assert.match(html, /\.cin-stage\.chat-open \.cin-voice-sub/);
const proactiveTick=functionSource("cinemaVideoTick");
const proactiveReply=functionSource("cinemaRoleReply");
assert.match(proactiveTick, /当前刚播放到的台词是/);
assert.match(proactiveTick, /绝对不能引用后面的台词或剧情/);
assert.match(proactiveTick, /allowSilence:true/);
assert.doesNotMatch(proactiveTick, /autoCount=.*\+1/);
assert.match(proactiveReply, /\[保持安静\]/);
assert.match(proactiveReply, /automatic&&outs\.length&&opt\.countActive!==false&&!visionResponse/);
assert.match(functionSource("cinemaSubtitleContext"), /x\.start<=t\+\.5/);
assert.match(functionSource("cinemaSend"), /cinemaRoleReply\([\s\S]*,false\)/);
assert.match(functionSource("cinemaBookComment"), /,false\)/);
assert.doesNotMatch(functionSource("cinemaBookPage"), /autoCount=.*\+1/);
assert.match(html, /\.cin-reader-companion/);
assert.match(html, /app\.js\?v=1024/);

console.log("cinema room tests passed");
