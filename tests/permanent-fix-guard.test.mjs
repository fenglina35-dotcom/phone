import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Every release must carry these repairs. They are user-visible fixes that were
// paid for with real debugging, and at least one of them has already been lost
// once: the v1235/iOS356 cohab schedule-sync repair was never committed, reached
// a device only because a packaging script read the working tree, and silently
// disappeared from v1246 onward when packages were built from a clean checkout.
// Losing a fix looks exactly like a new bug to the user, so a missing marker here
// is a release blocker, never something to "fix later".
//
// Adding to this list is expected. Removing an entry is only correct when the
// feature it guards is genuinely gone; if a refactor moves a marker, update the
// marker in the same commit that moves the code, and say so in the commit body.

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const WEB = 'app.js';

test('private owner-pasted Screen Time records remain separate from native telemetry',()=>{for(const prefix of ['native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const js=read(prefix+'phone-shortcuts.js');for(const marker of ['window.PhoneScreenTimeImport','cou_shortcut_screen_time','roleAccess:p.consent',"source:'ios-shortcut'",'r.date!==day()','id.account===p.account'])assert(js.includes(marker));assert(!js.includes('st.screenTimeSec=value'));}});
const PRIVATE_DIR = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const PRIVATE = PRIVATE_DIR + 'app.js';
const DELIVERY = 'delivery.js';
const PRIVATE_DELIVERY = PRIVATE_DIR + 'delivery.js';

const count = (source, marker) => source.split(marker).length - 1;

// scope: 'both' must hold in the web core and the private bundle; 'private' only
// applies to the private bundle, where the native shell needs the extra guard;
// 'web' is a repair released to the browser ahead of the private bundle. When a
// 'web' entry is later synced into the private bundle, move it to 'both' in the
// same commit that syncs it.
const PERMANENT_FIXES = [
  {release:"本地亲属同步候选",scope:"both",least:1,name:"亲属自主新增限额与间隔",marker:"q.created.length>=q.cap||q.created.some"},
  {release:"本地亲属同步候选",scope:"both",least:1,name:"删除关系后防止刷新重建",marker:"if(old)relFamilyBlockLink(old)"},
  {release:"本地收藏候选",scope:"both",least:1,name:"收藏转发保留原作者与历史时间",marker:"if(m&&m._favorite&&typeof wxFavoriteForwardText"},
  {release:"本地收藏候选",scope:"both",least:1,name:"完整备份包含收藏及转发卡片的原声音频",marker:"path.some(p=>p==='favorites'||p==='_favorite')"},
  {release:"本地候选",scope:"both",least:1,name:"已有好友刷新补齐消息且保留历史并去重",marker:"if(n>(counts.get(k)||0)){existing.push(m);ch=true;}"},
  {release:"v1576/v1577",scope:"both",least:1,name:"角色微信按消息作者同步气泡设置",marker:"const c=getC(cid),look=bubbleLook(c,!mine)"},
  {release:"v1668",scope:"both",least:1,name:"像素少女脚本下载失败自动重试，不再 PixelHomeBridge 未定义",marker:"小屋脚本按顺序载入",file:"games/pixel-home/index.html"},
  {release:"v1668",scope:"both",least:1,name:"像素少女、电子宠物组件没下载下来时打开即重下",marker:"function northEnsureComponent(key)"},
  {release:"v1660",scope:"both",least:1,name:"角色点外卖：规格按真实菜单修正，不再整单失败",marker:"function northRoleRepairSelections(p,raw,wants)",file:"commerce-ui.js"},
  {release:"v1660",scope:"both",least:1,name:"查店铺后的回复遇到500改写消息再试一次",marker:"function northShopFlatMessages(messages)"},
  {release:"v1576/v1577",scope:"both",least:1,name:"角色密码拨号盘独立背景与恢复入口",marker:"function spyAppearanceLockWallpaperReset(id)"},
  {release:"v1576/v1577",scope:"both",least:1,name:"角色手机名字原地编辑并支持完成与取消",marker:"function spyAppearanceNameKey(event,id)"},
  {release:"v1566/v1567",scope:"both",least:1,name:"角色微信图片表情付款共用玩家聊天及代发身份",marker:"function hisChatAppend(cid,fid,m)"},
  {release:"v1566/v1567",scope:"both",least:1,name:"角色微信付款只扣角色钱包",marker:"function hisPaySendSubmit(s,amount)"},
  {release:"v1566/v1567",scope:"both",least:1,name:"角色付款账本独立于消息且超时原路退还",marker:"function hisPaymentsExpire()"},
  {release:"v1566/v1567",scope:"both",least:1,name:"角色手机独立外观与原应用入口保留",marker:"function spyHome("},
  {release:"v1566/v1567 local",scope:"both",least:1,name:"真人消息以独立发送标识核对丢失响应",marker:"async function pfRecoverSend(scope,target,body,p)"},
  {release:"v1566/v1567 local",scope:"both",least:1,name:"相同正文分别匹配且兼容旧待发消息",marker:"function pfPendingMatches(local,server)"},
  {release:"v1566/v1567 local",scope:"both",least:2,name:"确认发送后本机错误不退款",marker:"if(confirmed){"},
  {release:"v1566/v1567 local",scope:"both",least:1,name:"好友连接诊断不采集正文与密钥",marker:"function phoneFriendDiagnostic()"},
  {release:"v1550/v1551",scope:"both",least:1,name:"图标恢复载入解除错误隐藏",marker:"this.style.display='';if(this.previousElementSibling)"},
  {release:"v1550/v1551",scope:"both",least:1,name:"游戏图片取消超时请求并自动恢复",file:"games/pixel-home/assets.js",marker:"async function loadImageRecover(url,label)"},
  {release:"v1550/v1551",scope:"both",least:1,name:"像素少女先保存再返回不等待磁盘",file:"games/pixel-home/game.js",marker:"cancelCare(false);if(!save())return;window.PixelHomeBridge.request('exit')"},
  {release:"v1548/v1549",scope:"both",least:1,name:"唱片外围透明而中心封面保留",file:"glass-theme.css",marker:'.vinyl-record:before{content:"";'},
  {release:"v1548/v1549",scope:"both",least:1,name:"主屏网页版状态栏不强制黑色",marker:"apple.setAttribute('content','default')"},
  {release:"v1546/v1547",scope:"both",least:1,name:"光盘及唱臂一键透明度",marker:"function homeVinylOpacitySet(value)"},
  {release:"v1546/v1547",scope:"both",least:1,name:"顶部锁屏按钮独立颜色及透明度",marker:"function lockPullAppearanceSet(key,value)"},
  {release:"v1544/v1545",scope:"both",least:1,name:"图标黑白包边切换保留",marker:"function appIconRimSet(tone)"},
  {release:"v1544/v1545",scope:"both",least:1,name:"玻璃内部小块独立颜色及零透明度",marker:"function glassInnerSet(key,field,value)"},
  {release:"v1544/v1545",scope:"both",least:1,name:"顶部系统区域自由选色及跟随主题",marker:"function statusBarColorSet(value)"},
  {release:"local preview",scope:"both",least:1,name:"主屏仅保留四套玻璃主题，旧线条选择回退纯黑",marker:"return ['blue','pink','gray','black'].includes(pack)?pack:'black';"},
  {release:"v1534/v1535",scope:"both",least:1,name:"旧自动记忆按玩家姓名修复且控制标记排除",marker:"function repairGeneratedRoleMemories(list)"},
  {release:"v1534/v1535",scope:"both",least:1,name:"转发和多选删除独立模式",marker:"mode:mode==='delete'?'delete':'forward'"},
  {release:"v1534/v1535",scope:"both",least:1,name:"银行不显示已撤回或婉拒卡",file:"role-family-card.js",marker:"const ks=cards(cid).filter(k=>!['revoked','declined'].includes(k.status))"},
  {release:"v1532/v1533",scope:"both",least:1,name:"电话挂断后不继续网络重试",marker:"const assertSession=()=>"},
  {release:"v1532/v1533",scope:"both",least:1,name:"电话与微信原始故障证据",marker:"failureStage:phase",file:"request-diagnostics.js"},
  {release:"v1532/v1533",scope:"both",least:1,name:"旅行订单卡显示实际付款人备注",marker:"NorthHotelData.payerLabel(h)"},
  {release:"v1532/v1533",scope:"both",least:2,name:"已处理旅行代付不落回旧购物付款",marker:"NorthTravelPayment.currentRequest(id)"},
  {release:"v1532/v1533",scope:"both",least:1,name:"角色旅行消费订单与用户退款权限分离",marker:"function spyTravelOrderRows(id)"},
  {release:"v1506/v1507",scope:"both",least:1,name:"旅行角色大额余额按十进制扣款",marker:"NorthHotelData.moneyNext(c.wallet,Math.round(delta*100))"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"线下控制文本与安静决定不进入对话通知",marker:"function rolePublicText(value)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"抖音陌生私信有独立性格和开场重复检查",marker:"function dyStrangerParse(raw,styles,recent)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"群专属红包领取前核对对象",marker:"function gRpRecipient(g,m)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"角色群只引用其他群友并保留全文",marker:"pq=rm&&rm.senderId!=='me'?{who:gName(rm,g),senderId:rm.senderId,text:gmText(rm)||''}:null"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"真人好友先只读探测再选择原库固定入口",marker:"async function pfTransportRoute(ms)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"群转账独立详情与明确收款动作",marker:"function groupTransferDetailAction(gid,mid)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"微信会话未读汇总和进入即读",marker:"function wxMarkPageSeen(page)"},
  {release:"v1422/v1423 preview",scope:"both",least:1,name:"朋友圈按账号保存未查看状态",marker:"function wxMomentSeenMap()"},
  {release:"v1370",scope:"web",least:1,name:"关系网：谁是谁的谁写进提示词（名单+相关详情）",marker:"function relPromptFor(c,focus,opt)"},
  {release:"v1370",scope:"web",least:1,name:"关系网：已故/失联/没有微信不能推荐",marker:"if(rp&&!relRecommendable(rp)&&!rp.cid){_replyAuditPartial=true;continue;}"},
  {release:"v1370",scope:"web",least:1,name:"关系网：他登录我的微信认得关系网里的人",marker:"relLoginTag(cid,x.id)"},
  {release:"v1370",scope:"web",least:1,name:"关系网：线下约会也带关系",marker:"/* 线下约会也认得他的家人朋友 */"},
  {release:"v1372",scope:"web",least:1,name:"关系网：给角色看本名，备注只是附注",marker:"function relPromptName(k){if(k==='me')return S.me.name||'她';"},
  {release:"v1374",scope:"web",least:1,name:"关系网：各自心里怎么看只给自己看",marker:"if(v.myView)s+='你心里怎么看ta、怎么看这些事：'"},
  {release:"v1376",scope:"web",least:1,name:"多人剧场：先打字再选对谁说，以选的人为准",marker:"/* 先打字、再选对谁说、再点让TA回：以点回复时选的人为准 */",file:"cohab-theater.js"},
  {release:"v1378",scope:"web",least:1,name:"他微信里不会有两个妈妈（同义称呼、人物卡转好友）",marker:"const mine=x=>x.relKey&&relKeyLive(x.relKey)===v.other;"},
  {release:"v1420",scope:"both",least:1,name:"线下/共同生活按日期、一天前、三天前、全部删除聊天记录",marker:"/* 像微信一样按时间删除线下 / 共同生活聊天记录：选某一天、一天前、三天前、全部 */"},
  {release:"v1420",scope:"both",least:1,name:"多人剧场：两位来客每轮都说话，离场不影响其他人",marker:"/* 本轮谁接话：被点名的配角排第一，其余在场的配角（两位微信来客、路人）都排上，不再一轮只轮到一个 */",file:"cohab-theater.js"},
  {release:"v1418",scope:"both",least:1,name:"真人群里别人@我的气泡是正常灰色",marker:"/* 别人@我的消息和普通消息一样是灰色气泡（@我的提醒照常） */"},
  {release:"v1416",scope:"both",least:1,name:"真人群角色：气泡和成员一样、旧消息不当新消息、被禁言不说话",marker:"function quietByRule(gid){",file:"pf-group-role.js"},
  {release:"v1414",scope:"both",least:1,name:"每个人能把自己的角色带进真人群，只有主人开着群时才说话",marker:"function pfRoleRow(m,pl,gid,g){",file:"pf-group-role.js"},
  {release:"v1412",scope:"both",least:1,name:"微信已读（角色和真人好友），设置里可开关",marker:"function roleMarkRead(id){"},
  {release:"v1410",scope:"both",least:1,name:"桌宠平时是平静的小竖条眼睛，星星眼爱心眼只偶尔出现；新增平静表情",marker:"'平静':{eyes:'open',cls:''}",file:"desk-pet.js"},
  {release:"v1408",scope:"both",least:1,name:"过节情侣角色主动祝福、重要节日一定送心意；只有明确说才换背景",marker:"function holidayCare(id,name,date,opt){"},
  {release:"v1406",scope:"both",least:1,name:"桌宠的帽子和耳机可以在设置里摘掉",marker:"function deskPetWear(k){",file:"desk-pet.js"},
  {release:"v1404",scope:"both",least:1,name:"桌面宠物跟着角色心情走来走去，入口在设置最下面",marker:"function renderDeskPetPage(){",file:"desk-pet.js"},
  {release:"v1402",scope:"both",least:1,name:"可以手动给角色请假，节假日（国庆/七夕/情人节等）放假",marker:"function schedAddLeave(id){"},
  {release:"v1400",scope:"both",least:1,name:"追回边等边想、卡住的来电自动清掉",marker:"function pursuitPlanAhead(c){"},
  {release:"v1396",scope:"both",least:1,name:"拉黑后角色自己决定怎么追回，接电话/回短信就结束",marker:"function pursuitOnUserSms(num){"},
  {release:"v1392",scope:"both",least:1,name:"角色抖音头像可以单独换",marker:"function dyRA(cid,fallback){"},
  {release:"v1390",scope:"both",least:1,name:"删掉的消息留下的语音能清掉（只删没人引用的）",marker:"async function audioOrphanGC(){"},
  {release:"v1388",scope:"both",least:1,name:"私人 App 存储明细不逐张读图片",marker:"countIDBKeys(imgDB,'img',"},
  {release:"v1386",scope:"both",least:1,name:"名片加来的人记得自己的生日",marker:"function relSelfText(k){"},
  {release:"v1384",scope:"both",least:1,name:"红包打开函数不再和角色扮演同名（角色扮演点开不提示红包找不到）",marker:"function redpOpen(scope,key,mid){"},
  {release:"v1380",scope:"both",least:1,name:"剧场配角坏掉的JSON按气泡抠出来",marker:"function theaterLooseBubbles(source){",file:"cohab-theater.js"},
  {release:"v1380",scope:"web",least:1,name:"他手机里家人聊天照关系网来",marker:"(typeof relFriendSys==='function'?relFriendSys(cid,f):'')"},
  {release:"v1368",scope:"both",least:1,name:"群聊点名的人先回，然后情侣角色",marker:"mentioned.forEach(c=>plan.push(pick(c,true)));if(couple&&mentioned.indexOf(couple)<0)plan.push(pick(couple,true));"},
  {release:"v1368",scope:"both",least:1,name:"合并调用走角色路线，失败退回单独调用",marker:"if(got.failed){"},
  {release:"v1366",scope:"both",least:1,name:"共同生活点一下出一句",marker:"function cohabTapWait(id,item,timing)"},
  {release:"v1364",scope:"both",least:1,file:"小手机.html",name:"引用框不把对方气泡撑宽",marker:".msg.them>.col>.bubble{align-self:flex-start}"},
  {release:"v1364",scope:"both",least:1,name:"抖音群每个人可选单独/合并调用",marker:"function dyGCallSolo(g,m)"},
  {release:"v1362",scope:"both",least:1,name:"角色群单独/合并调用，单独的走角色自己的路线",marker:"function gCallSolo(g,cid)"},
  {release:"v1362",scope:"both",least:1,name:"合并调用按【名字】拆回每个人",marker:"async function groupBatchReplyItems(g,batch,recent,why)"},
  {release:"v1362",scope:"both",least:1,name:"角色禁言我后私聊发微信，能用[群解禁]放我出来",marker:"function applyGroupUnmuteTag(content,c)"},
  {release:"v1360",scope:"both",least:1,name:"群聊角色一个都没回时把原因提示出来",marker:"if(!spoke&&why.length){"},
  {release:"v1360",scope:"both",least:1,name:"角色收下群转账后再开口",marker:"'，'+nm+'已经收下了）'"},
  {release:"v1358",scope:"both",least:1,name:"群聊长按引用",marker:"function gqPressStart(gid,mid)"},
  {release:"v1358",scope:"both",least:1,name:"群红包按个数拼手气，钱加起来刚好等于总额",marker:"function rpSplitCents(total,count,rand)"},
  {release:"v1358",scope:"both",least:1,name:"真人群红包靠隐藏 rp_grab 排序，确认后才进零钱",marker:"if(pfIsRpGrabTransport(kept)){pfAbsorbRpGrab(gid,from,kept);return false;}"},
  {release:"v1358",scope:"both",least:1,name:"群转账指定收款人，别人不能收",marker:"if(pay.payTo&&String(pay.payTo).toUpperCase()!==String(p.id||'').toUpperCase())"},
  {release:"v1356",scope:"both",least:1,name:"群管理：管理员能管除群主外的任何人，只有情侣管理员能禁言群主",marker:"function gmCanActOn(kind,id,actor,target,action)"},
  {release:"v1356",scope:"both",least:1,name:"真人群只认群主发的管理员名单",marker:"function pfAbsorbGroupManage(gid,from,kept)"},
  {release:"v1356",scope:"both",least:1,name:"被禁言时发不出群消息",marker:"if(gmMutedUntil('role',id,'me')){toast('你已被禁言')"},
  {release:"v1354",scope:"both",least:1,name:"群聊加号面板在输入框下方",marker:"#gpanel,#pfgpanel{order:2;flex:0 0 auto;}",file:"小手机.html"},
  {release:"v1354",scope:"both",least:1,name:"群聊情侣角色先回、按性格和话题决定说不说",marker:"function groupReplyPlan(g,members,fromText,rand)"},
  {release:"v1354",scope:"both",least:1,name:"群二维码只认自己发出且未过期的令牌",marker:"function pfGroupQrProcess(rows)"},
  {release:"v1354",scope:"both",least:1,name:"群聊气泡小箭头对准头像中间",marker:".msg.them.gnamed>.avatar",file:"小手机.html"},
  {release:"v1352",scope:"web",least:1,name:"主屏样式表离线缓存，下载失败自动重试一次",marker:"window.__northCssRetry=function(link)",file:"小手机.html"},
  {release:"v1352/v1357",scope:"both",least:1,name:"线下约会等场景里我的消息时间贴右边，不被屏幕切掉",marker:"function mine(message){return message.role==='user'||message.who==='me';}",file:"message-beijing-time.js"},
  {release:"v1352/v1357",scope:"both",least:1,name:"角色照抄文件上下文或漏写 [/文件] 仍按文件收下",marker:"const ROLE_FILE_ECHO="},
  {release:"v1352/v1357",scope:"both",least:1,name:"角色自己发过的文件在历史里用它自己的文件写法",marker:"if(m&&m.role==='assistant'&&m.type==='file')return roleFileHistoryText(m);"},
  {release:"v1352/v1357",scope:"both",least:1,name:"查手机额度 4000、不夹 system、失败显示原因",marker:"toast('生成失败：'+(_spyWhy||'原因未知')"},
  {release:"v1351/v1356",scope:"both",least:1,name:"共同生活后角色主动发微信，从共同生活最新一轮接着说",marker:"【本轮是从'+where+'回到微信后你主动发的第一条（最高优先级）】"},
  {release:"v1351/v1356",scope:"both",least:1,name:"后台主动消息也带共同生活交接提醒",marker:"const handoffPin=roleReplyCrossChannelHandoffPrompt(c,Date.now());if(handoffPin)lines.push(handoffPin.trim());"},
  {release:"v1351/v1356",scope:"both",least:1,name:"真红包：点开是「開」，领完变灰并留「你领取了…的红包」",marker:"function redpOpen(scope,key,mid){"},
  {release:"v1351/v1356",scope:"both",least:1,name:"红包卡片标题固定「恭喜发财，大吉大利」，祝福语写在下一行",marker:"<b>${RP_DEFAULT_NOTE}</b>${line?`<em>${esc(line)}</em>`:''}"},
  {release:"v1351/v1356",scope:"both",least:1,name:"转账卡片显示备注",marker:"line=st==='pending'?(memo||copy):(memo?copy+' · '+memo:copy)"},
  {release:"v1351/v1356",scope:"both",least:1,name:"「我吃过饭了/吃过了/吃饱了/我吃了」都算吃完，角色不再回头问吃饭了没有",marker:"|吃过(?:饭|早饭|早餐|午饭|晚饭|晚餐|午餐|夜宵|东西)?(?:了|啦|咯|喽)|吃饱(?:饱)?(?:了|啦|咯)|"},
  {release:"v1351/v1356",scope:"both",least:1,name:"后台主动消息上下文超长时先让最早的聊天让位，状态和提醒保住",marker:"return top.concat(kept,tail).join('\\n').slice(-8000);"},
  {release:"v1350/v1355",scope:"both",least:1,name:"指令里的 App 名对不上时调用一次模型对应到已授权 App 再执行",marker:"async function controlResolveUnknownApps(list,c,id,pwd)"},
  {release:"v1350/v1355",scope:"both",least:1,name:"锁定/解锁成功只弹一下系统提示，不写进聊天、不带表情",marker:"toast((c.remark||c.name)+notices.join('，'),2600);"},
  {release:"v1350/v1355",scope:"both",least:1,name:"放映室、云程等 App 名称都能解析，锁定指令不再静默失败",marker:"return APPNAME2KEY[n]||Object.keys(LOCKABLE).find(k=>LOCKABLE[k]===n);"},
  {release:"v1353（Mac 线 v1343–v1352）",scope:"private",least:1,name:"小K表情随回复同步并在首条可见气泡时点亮",marker:"robotFaceFirstVisible(_robotFaceTurn,_robotFaceResult.emotion,replyAccount)"},
  {release:"v1353（Mac 线 v1343–v1352）",scope:"private",least:1,name:"小K独立语音接管回复并取消人为气泡等待",marker:"if(id&&typeof RobotVoice!=='undefined'&&RobotVoice.roleActive(id))return 0;"},
  {release:"v1353（Mac 线 v1343–v1352）",scope:"private",least:1,name:"小K语音输入复用用户发言后续流程",marker:"function wechatContinueUserText(id,t,opt)"},
  {release:"v1353（Mac 线 v1343–v1352）",scope:"private",least:1,file:PRIVATE_DIR+"index.html",name:"私人入口加载小K组件",marker:'<script src="private-robot-voice.js?v='},
  {release:"v1348/v1349",scope:"both",least:1,name:"管控说和做分开：说的话不执行，只执行指令标签",marker:"【说和做分开·最高优先级】你说的话永远不会锁或解锁任何东西"},
  {release:"v1348/v1349",scope:"both",least:1,name:"像已完成却没写指令时只回头问角色一次，只执行它回的指令",marker:"async function controlClaimConfirm(reply,c,id,opt)"},
  {release:"v1344",scope:"both",least:1,name:"原文模式整行控制标签去空白后执行，[收款]不再显示成文字",marker:"原文模式也要执行控制指令"},
  {release:"v1346",scope:"both",least:1,name:"角色当时没处理的旧转账之后不会突然被收款",marker:"function transferMarkRoleSeen(list)"},
  {release:"v1344",scope:"both",least:1,name:"角色[联网]在原文模式下也真的执行",marker:"// 联网：这是执行角色的决定，不是输出过滤"},
  {release:"v1344",scope:"both",least:1,name:"联网结果由角色以可点开卡片分享",marker:"function webShareCardMsg(q,raw)"},
  {release:"v1344",scope:"both",least:3,name:"代付卡片商品名完整换行显示",marker:"class=\"wx-pay-card-name\""},
  {release:"v1344",scope:"both",least:1,name:"删除正在查看的私信会话退回列表而不是黑屏",marker:"正在看的会话被删后留在原页会渲染成空白黑屏"},
  {release:"v1344",scope:"web",least:1,file:"小手机.html",name:"网页白色主题表情格为白底",marker:".wxlight .estk .s{background:#fff;"},
  {release:"v1344",scope:"web",least:1,file:PRIVATE_DIR+"index.html",name:"私人白色主题表情格为白底",marker:".wxlight .estk .s{background:#fff;"},
  {release:"v1338/v1339",scope:"both",least:1,name:"思考标签与未闭合思考流不得进入微信气泡",marker:"function wechatStripReasoningEnvelope(value)"},
  {release:"v1338",scope:"web",least:1,name:"多条英文自动翻译串行并对临时失败有限重试",marker:"let _roleTextTranslationQueue=Promise.resolve()"},
  {release:"v1336/v1337",scope:"both",least:1,name:"外置语音测试仅使用填写的接口快照",marker:"{externalConfig,tries:1,languageBoost:'auto'}"},
  {release:"v1336/v1337",scope:"both",least:1,name:"内置服务彻底退役拒绝生成请求",marker:"function ttsRelayOn(t){return false;}"},
  {release:"v1328/v1329",scope:"both",least:1,name:"屏保手势中断清理拖动状态",marker:"function lockGestureReset()"},
  { release: "v1326/v1327", scope: "both", least: 1, name: "外卖动作支持商品名内部嵌套中文方括号", marker: "function deliveryStructuredActionTags(value)" },
  { release: "v1326/v1327", scope: "both", least: 1, name: "未完整消费的外卖控制标签绝不显示成角色气泡", marker: "任何未完整消费的外卖控制标签都必须静默拦截" },
  {release:"v1324/v1325",scope:"both",least:1,name:"聊天与主动的电话频率直接入口",marker:"function roleCallPreferenceOpen(id)"},
  { release: "v1324/v1325", scope: "both", least: 1, name: "逐条查手机已读账本", marker: "function rolePhoneLocalRead(" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "送达后才消费查手机记录", marker: "function rolePhoneLocalCommit(" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "角色独立电话几率", marker: "function effCallProb(c)" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "情侣任务默认关闭", marker: "S.couple.tasksEnabled===true" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "真人转账独立回执", marker: "function pfTransferReceiptMessage(" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "磨砂颜色即时同步", marker: "st.style.setProperty('--offc-'+key+'-soft'" },
  { release: "v1324/v1325", scope: "both", least: 1, name: "回复长度默认4096", marker: "maxTokens:x.maxTokens==null?4096:x.maxTokens" },
  {
    release: 'v1282/v1283',
    name: '朋友圈封面 IDB 冷缓存保留图片节点并重新取图',
    scope: 'both',
    marker: 'function storedImageElementSource(v)',
    least: 1,
  },
  {
    release: 'v1282/v1283',
    name: '应用处理内部协议在前台原文、普通输出和后台回拉三处隐藏',
    scope: 'both',
    marker: '应用处理\\s*[|｜]\\s*(?:提醒|锁定)',
    least: 3,
  },
  {
    release: 'v1248',
    name: '共同生活作息同步：清洗后再比较，上班时段不再每 15 秒空转',
    scope: 'both',
    marker: 'const label=cohabActivityClean(spec.label)',
    least: 1,
  },
  {
    release: 'v1248',
    name: '角色服务器资料同步去抖：短时间重复触发合并为最后一次',
    scope: 'both',
    marker: 'clearTimeout(_roleServerPushSoonTimers[key])',
    least: 1,
  },
  {
    release: 'v1246',
    name: '共同生活截断旁白：未闭合的【（( 开头仍按旁白显示',
    scope: 'both',
    marker: "else if(/^[（(【]/.test(raw)&&!/[）)】]$/.test(raw))",
    least: 1,
  },
  {
    release: 'v1246',
    name: '原文输出实验路径同样识别截断旁白',
    scope: 'both',
    marker: 'open=!closed&&line.match',
    least: 1,
  },
  {
    release: 'v1247',
    name: '共同生活/线下回复长度可由路线设置抬高上限',
    scope: 'both',
    marker: 'function offlineReplyBudget(input,c)',
    least: 1,
  },
  {
    release: 'v1247',
    name: '设置页保留独立的“回复长度（共同生活/线下）”输入项',
    scope: 'both',
    marker: 's_cmax_offline',
    least: 4,
  },
  {
    release: 'v1237-v1242',
    name: '大存档完整备份分段序列化，不再整份复制状态',
    scope: 'both',
    marker: 'backupJsonBlob',
    least: 2,
  },
  {
    release: '私人既有',
    name: '私人 App 周期任务统一走后台任务包装，避免占用主线程',
    scope: 'private',
    marker: 'northNativeBackgroundTask',
    least: 30,
  },
  {
    release: '私人既有',
    name: '私人 App 性能守卫（启动安静期与性能保护态）',
    scope: 'private',
    marker: 'north-native-performance-guard',
    least: 2,
  },
  {
    release: '私人既有',
    name: '好友消息同步分批让出主线程',
    scope: 'private',
    marker: 'pfSyncMaybeYield',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '完整备份跳过读不出的图片，不再整份中止',
    scope: 'both',
    marker: '_fullBackupSkippedImages.add(key)',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '定时查岗错过当天时点后仍会补跑一次',
    scope: 'both',
    marker: 'nowMin<toMin(sp.time)',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '群聊撤回行能被角色感知，不再喂成空洞的[消息]',
    scope: 'both',
    marker: "m.type==='sys'?String(m.content||'')",
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '开始新约会前先归档没结束的上一场，记录不丢',
    scope: 'both',
    marker: 'offArchiveUnfinishedSession(o)',
    least: 1,
  },
  {
    release: 'v1249（v1250 同步私人）',
    name: '共同生活期间角色不在身边时可以来电',
    scope: 'both',
    marker: 'roleOnlineProactiveBlocked(id)&&!(cohabRestricted&&opt.requestedByUser)',
    least: 1,
  },
  {
    release: 'v1249（v1250 同步私人）',
    name: '整段英文旁白本地丢弃，不触发重新生成',
    scope: 'both',
    marker: 'roleReplyDropEnglishNarration',
    least: 2,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '存档里的图片引用在显示前先还原，表情包、壁纸、朋友圈都不再破图或发黑',
    scope: 'both',
    marker: 'storedImageDisplaySource(m.img)',
    least: 2,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '主屏与锁屏壁纸失效时不画无效地址，毛玻璃组件不会连带变黑',
    scope: 'both',
    marker: 'storedImageDisplaySource(S.me.homeBg)',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '好友申请方向按来源区分，用户加的不会说成角色加的',
    scope: 'both',
    marker: '绝不能说成你申请加ta、或你终于等到ta通过',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '陌生来电知道是自己拨出的，不再反问用户是谁',
    scope: 'both',
    marker: '绝对不要反问“你是谁”“你哪位”',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '小本子由角色自行判断要记什么，日常喜好习惯都记得下',
    scope: 'both',
    marker: '记不记、记哪一条，完全由你自己判断',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '原生请求有界，挂死不会让「正在备份」永远卡住',
    scope: 'both',
    marker: 'NATIVE_TIMEOUT',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '上游只认方图时，竖图被拒后退回方图再试一次',
    scope: 'both',
    marker: "res.status===400&&target!=='1024x1024'",
    least: 1,
  },
  {
    release: 'v1257',
    name: '语音语言锁：选了外语时混进来的中文绝不会被念出口',
    scope: 'both',
    marker: 'text=ttsDropOffLanguage(text,o);',
    least: 1,
  },
  {
    release: 'v1257',
    name: '「模型原文输出」不再绕过通话发声的外语过滤',
    scope: 'both',
    marker: "(_rawOutput&&(!_vlang||_vlang==='zh'))?u.orig:pickSpoken(u.orig,_vlang)",
    least: 1,
  },
  {
    release: 'v1257',
    name: '真人好友点气泡弹出消息操作，撤回有可见入口',
    scope: 'both',
    marker: "onclick=\"pfMsgMenu('${m.id}'",
    least: 2,
  },
  {
    release: 'v1257',
    name: '后台接力：本地已回过时同时取消服务器任务，不再每两分钟重调一次模型',
    scope: 'both',
    marker: "if(handoff)replyHandoffCancelRemote(handoff);else roleBackgroundCancel(c.id,['reply_handoff']);",
    least: 1,
  },
  {
    release: 'v1257',
    name: '后台接力：消息送不进去时先停掉服务器那一侧，内容仍留着补送',
    scope: 'both',
    marker: 'roleServerPushHoldHandoff(c,handoffPeek(c,row))',
    least: 1,
  },
  {
    release: 'v1257',
    name: '[保持安静] 是要执行的决定，推送路径不再当成一句话发出去',
    scope: 'both',
    marker: '(?:保持安静|不说话)\\s*[\\]】]\\s*(?=\\n|$)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '语音条只显示中文翻译，发声仍用外语原文',
    scope: 'both',
    marker: 'esc(m.trans||m.content)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '模型原文输出为全局默认，开关已移除',
    scope: 'both',
    marker: 'function modelOutputUnfiltered(){return true;}',
    least: 1,
  },
  {
    release: 'v1257',
    name: '截断续写排在原文直通之前，回复长度设短也不会断在半句',
    scope: 'both',
    marker: "roleInterceptPurpose:'length-continuation'",
    least: 1,
  },
  {
    release: 'v1257',
    name: '信件有自己的回复长度，不再写死 700／620',
    scope: 'both',
    marker: 'function letterReplyBudget(c)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '两边微信请求参数一致：私人版也走原文直通，不再各跑各的',
    scope: 'both',
    marker: 'complete:true,unfilteredOutput:_rawOutput',
    least: 1,
  },
  {
    release: 'v1257',
    name: '指令解析器知道当前哪些 App 锁着，不会把陈述现状再解析成一次操作',
    scope: 'both',
    marker: 'companionControlLedgerForParser()',
    least: 2,
  },
  {
    release: 'v1257',
    name: '威胁与未来时不再触发真锁真解（v1348 起：说的话一律不执行，只有指令；像已完成的说法只回头确认）',
    scope: 'both',
    marker: 'function controlClaimCandidates(reply)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '外置 App 不重复下发同一个状态，角色不再反复锁已经锁着的',
    scope: 'both',
    marker: "opt.by==='role'&&companionExternalAlreadyInState(st,app,action)",
    least: 1,
  },
  {
    release: 'v1257',
    name: '用户自己解锁时角色的话不再被收据式模板顶替',
    scope: 'both',
    marker: '这不是设备读数汇报',
    least: 1,
  },
  {
    release: 'v1259',
    name: '共同生活关闭后，一起生活过的记忆仍然记得',
    scope: 'both',
    marker: 'function cohabMemoryAfterPrompt(c)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '共同生活记忆上限可调，0 表示不限',
    scope: 'both',
    marker: 'cohabMemoryPrune(d,cohabMemoryCap(d))',
    least: 1,
  },
  {
    release: 'v1259',
    name: '主动清理低星，5 星永远保留',
    scope: 'both',
    marker: 'function memoryPruneLowStars(rows,maxStar)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '微信记忆清理按钮不再空转（自动清理关着也能手动清）',
    scope: 'both',
    marker: 'pruneSummaries(cc,null,{force:true})',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音「我」页不再被 commerce-ui 的外壳覆盖，四个新页面才看得见',
    scope: 'both',
    marker: 'function renderDouyin(){dyInit();',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音编辑资料页（封面／头像／资料完成度／逐项修改）',
    scope: 'both',
    marker: 'function dyEditView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音主页访客页（红点、回关、清空记录）',
    scope: 'both',
    marker: 'function dyVisitorsView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音作品详情页（漂浮弹幕、右侧操作栏、视频分析）',
    scope: 'both',
    marker: 'function dyWorkView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音评论区从屏幕下方弹出，可回复、可展开子回复',
    scope: 'both',
    marker: 'function dyCmSheet(v)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音「我」页不留死按钮：互关／关注／粉丝列表页',
    scope: 'both',
    marker: 'function dyRelView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音观看历史（看过就记一笔，可筛可清）',
    scope: 'both',
    marker: 'function dyHistoryView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音主页搜索：先搜自己的主页，再给全网入口',
    scope: 'both',
    marker: 'function dyMeSearchView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音求更新页（近 7 天催更／催开播）',
    scope: 'both',
    marker: 'function dyUpdateView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音全部功能九宫格，次要入口全部有去处',
    scope: 'both',
    marker: 'function dyAllGroups()',
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话掉一次连接自己重发，不再把「网络连接中断」甩给她',
    scope: 'both',
    marker: 'async function callChatWithRetry(messages,md,c)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话被长度上限截断时会补完，不再断在半句',
    scope: 'both',
    marker: "complete:true,max:callReplyBudget(c)",
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话有自己的回复长度，留空跟线上聊天一样',
    scope: 'both',
    marker: 'function callReplyBudget(c)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '切后台被掐断的请求说人话，不再赖网络',
    scope: 'both',
    marker: 'function callBackgroundInterrupted(e,mark,now)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '续写碎片不再跑整段的纯英文拦截',
    scope: 'both',
    marker: 'roleReplyLanguageGuard:false,roleInterceptPurpose',
    least: 1,
  },
  {
    release: 'v1260',
    name: '英文续写不再把两个词粘成一个',
    scope: 'both',
    marker: 'hadGap=/^\\s/.test(more)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '设置页能按通话的真实规模测一次',
    scope: 'both',
    marker: 'async function testCallScale()',
    least: 1,
  },
  {
    release: 'v1260',
    name: '_taskBusy 有声明，任务页不会没布置过就抛错',
    scope: 'both',
    marker: 'let _taskBusy=false;',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音消息页：五个圆入口＋陌生人文件夹',
    scope: 'both',
    marker: 'function dyStrangerFolderRow()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音粉丝页（谁什么时候关注了你，可回关）',
    scope: 'both',
    marker: 'function dyFansView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音互动消息（赞与其他／评论与弹幕／群通知）',
    scope: 'both',
    marker: 'function dyActsView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音私聊页：火花、已读、快捷回复、时间只在间隔后标一次',
    scope: 'both',
    marker: 'function dyDMStamp(rows,mi)',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音群聊：建群、拉角色、群主与管理员',
    scope: 'both',
    marker: 'function dyGroupInfoView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '公开群每天只来一位陌生人，且先占住当天再调模型',
    scope: 'both',
    marker: "g.lastApplyDay=dyApplyDayKey();save();",
    least: 1,
  },
  {
    release: 'v1261',
    name: '进群的陌生人带着自己的人设说话',
    scope: 'both',
    marker: 'function dyGroupSpeakerPrompt(g,m)',
    least: 1,
  },
  {
    release: 'v1261',
    name: '群聊按性格出场，关掉群聊 AI 就没人自动说话',
    scope: 'both',
    marker: 'async function dyGroupReplyRun(gid,fromText,forceKeys)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音全部走副模型，失败要回落主模型而不是静默',
    scope: 'both',
    marker: 'async function dyAuxChat(messages,opt)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音作品是「正文＋旁白」的文字作品，不再是一个 emoji',
    scope: 'both',
    marker: 'function dyWorkCardHTML(v,opt)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音朋友页，底部第二格从「发现」换成「朋友」',
    scope: 'both',
    marker: 'function dyFriendView()',
    least: 1,
  },
  {
    release: 'v1262',
    name: '涨粉掉粉靠发作品挣，一天只结算一次',
    scope: 'both',
    marker: 'function dyGrowthTick()',
    least: 1,
  },
  {
    release: 'v1262',
    name: '她评论之后一定有角色回她',
    scope: 'both',
    marker: 'function dyCommentResponder(v)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '抖音里每个人都有独立主页，群成员页也独立成一页',
    scope: 'both',
    marker: 'function dyUserView()',
    least: 1,
  },
  {
    release: 'v1265',
    name: '私聊和群聊各自能调上下文条数',
    scope: 'both',
    marker: 'function dyChatCtxRows(box)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '抖音里发生的事进角色记忆，跟共同生活一样',
    scope: 'both',
    marker: 'function dyMemoryPrompt(c)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '等角色回消息时有三个点',
    scope: 'both',
    marker: 'function dyTypingHTML(face)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '陌生人统一用灰底线条小人头像',
    scope: 'both',
    marker: 'function dyFace(v,cls)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '她发的文件角色真的读得到正文',
    scope: 'both',
    marker: 'function chatFileContextBody(m)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '角色能写多行文件，正文不会散成聊天气泡',
    scope: 'both',
    marker: 'function roleFileExtract(content)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '文件卡点得开，能复制能保存',
    scope: 'both',
    marker: 'function chatFileOpen(cid,mid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '骰子回到微信功能面板第二页',
    scope: 'both',
    marker: "chatFunctionItem('骰子','dice'",
    least: 1,
  },
  {
    release: 'v1271',
    name: '红点进页面就全清',
    scope: 'both',
    marker: 'function dyMarkAllSeen(kind,rows)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '火花只涨不清零，双方当天都发过才 +1',
    scope: 'both',
    marker: 'function dySparkTick(d)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音私聊能连发 1～4 条',
    scope: 'both',
    marker: 'function dyDMBubbles(raw)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊按性格出场，主角＋配角，可以冷场',
    scope: 'both',
    marker: 'function dyGCast(g,fromText,forceKeys)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '网友合并一次调用，角色各自调用',
    scope: 'both',
    marker: 'function dyGCrowdPrompt(g,crowd)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '禁言踢人的规矩由代码硬卡，不信任模型',
    scope: 'both',
    marker: 'function dyGCmdDeny(g,actorKey,kind,target)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '她被禁言只能私信求解，私聊和群聊打通',
    scope: 'both',
    marker: 'function dyDMRunUnmute(cid,text)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群里冷场太久会自己聊起来，一天有次数上限',
    scope: 'both',
    marker: 'async function dyGroupIdleChat(gid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: 'IP 跟人设走，没写就固定随机，可手动改',
    scope: 'both',
    marker: 'function dyPersonIP(p)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊气泡一条条出，管理员 1～4 条，配角 1 条',
    scope: 'both',
    marker: 'function dyGBubbles(g,m,raw)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '一个气泡里不能同时 @ 两个人',
    scope: 'both',
    marker: 'function dyGSplitAt(line)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '收到消息有柔和提示音，现合成不占体积',
    scope: 'both',
    marker: 'function dyDing()',
    least: 1,
  },
  {
    release: 'v1271',
    name: '火花挂在私聊顶部名字旁边',
    scope: 'both',
    marker: 'function dySparkBadge(d)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音输入框复用微信的表情与表情包',
    scope: 'both',
    marker: 'function dyEmojiPanelHTML(scope,id)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音转账红包走微信账本，群红包能抢',
    scope: 'both',
    marker: 'function dyMoneySend(scope,id,kind)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抢红包的手速看性格',
    scope: 'both',
    marker: 'function dyGreed(m)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '发作品：文字卡片可选颜色，相机能拍能选',
    scope: 'both',
    marker: 'function dyPostImage(shoot)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '角色真的看图再评论，看不见绝不编',
    scope: 'both',
    marker: 'function dyWorkSceneText(v)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '被 @ 的人粉丝多就有他的粉丝来捧场',
    scope: 'both',
    marker: 'async function dyAtFansShow(v,p,fans)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊不再被弹回顶部',
    scope: 'both',
    marker: "sub==='group')return{id:'.dyg-box',stick:true}",
    least: 1,
  },
  {
    release: 'v1271',
    name: '被踢出去的人不能再说话',
    scope: 'both',
    marker: 'if(!dyGFind(g,m.k))continue;',
    least: 1,
  },
  {
    release: 'v1271',
    name: '发作品能选音乐库里真有的歌',
    scope: 'both',
    marker: 'function dyWorkMusicPlay(id)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '云程护照头像兼容 IndexedDB 图片引用',
    scope: 'web',
    marker: 'function tvPassportPhoto(v)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '查手机小事簿改用页内编辑器，移动浏览器不会拦截按钮',
    scope: 'web',
    marker: 'function spyLifeNoteEditor(i)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '朋友圈情侣必点赞并请求真实评论，失败可见重试',
    scope: 'web',
    marker: 'function momentRetryRequiredReactions(pid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '朋友圈角色可按兴趣互相艾特，最多两回合',
    scope: 'web',
    marker: 'function momentRunRoleExchange(p)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '像素少女网页端按小目录分图加载，不再解析整份内嵌大脚本',
    scope: 'web',
    file: 'games/pixel-home/assets.js',
    marker: "fetch(new URL('wardrobe/catalog.json',base).href",
    least: 1,
  },
  {
    release: 'v1272',
    name: 'iOS 主屏网页同步状态栏颜色且不覆盖解锁后的页面',
    scope: 'web',
    file: '小手机.html',
    marker: 'html.north-ios-standalone-status{background-color:var(--north-shell-status-color,#000)}',
    least: 1,
  },
  {
    release: 'v1271',
    name: '多人剧场支持两名微信来客且关闭开关时不强制加入',
    scope: 'web',
    file: 'cohab-theater.js',
    marker: 'ct_wechat_enabled',
    least: 1,
  },
  {
    release: 'v1271',
    name: '云程酒店支持网页预订、紧凑聊天卡与角色知情边界',
    scope: 'web',
    marker: 'function tvHotelBook(i,payment)',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家移动端使用隔离材质预热，正式材质不参与整屋启动预绘制',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/app.mjs',
    marker: 'const warmDraw=()=>{const warmMaps=new Map(),materialClones=new Map(),objectSwaps=[]',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家进入前释放预热几何和镜面缓冲',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/app.mjs',
    marker: 'mirrors.releaseGPU();const geometries=new Set()',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家女性角色静止姿态仍执行固定手臂旋转',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/female-avatar001.mjs',
    marker: 'proceduralDeltas=',
    least: 1,
  },
  {
    release: 'v1274',
    name: '线上长期记忆与对话总结按独立上限和每轮合计上限引用',
    scope: 'both',
    marker: 'function onlineMemoryRecallLimits()',
    least: 1,
  },
  {
    release: 'v1274',
    name: '线下记忆删除后恢复原来的列表滚动位置',
    scope: 'both',
    marker: 'function offMemoryRestoreScroll(top)',
    least: 1,
  },
  {
    release: 'v1280/v1278',
    name: '已有网页云备份继续按周期更新并保持私人镜像只读',
    scope: 'both',
    marker: 'await cloudBackup({current,onProgress:',
    least: 1,
  },
  {
    release: 'v1280/v1278',
    name: '网页手动云备份显示持续进度并阻止重复点击',
    scope: 'both',
    marker: 'function cloudSyncProgress(text,kind,busy)',
    least: 1,
  },
  {
    release: 'v1278',
    name: '私人手机号备份成功后不再重复生成整份网页镜像',
    scope: 'private',
    file: PRIVATE_DIR + 'private-cloud-backup.js',
    marker: '手机号私人备份和网页镜像是两个入口',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '抖音转账红包用微信那张卡',
    scope: 'both',
    marker: 'function dyTransferCopy(m,me)',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '[收款][拒收] 被执行掉，不当文字显示',
    scope: 'both',
    marker: 'function dyRunPayCommands(rows,text)',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '相册 input 挂进 DOM，否则 iOS 点不动',
    scope: 'both',
    marker: 'document.body.appendChild(i);window._dyPickEl=i;',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '发作品是三个真页面',
    scope: 'both',
    marker: 'function dyPostCameraPage()',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '作品能转发到抖音私信和群聊',
    scope: 'both',
    marker: 'function dyFwdTo(scope,id)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '配乐条在 stage 外面，不会跑到左上角',
    scope: 'both',
    marker: '<div class="dywk-music">${dyWorkMusicHTML(v)}</div>',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '滑到哪条放哪条，没点过屏幕不硬出声',
    scope: 'both',
    marker: 'if(!_dyGestured)return;',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '@ 写进作品描述，发布时按文字里还剩下的定名单',
    scope: 'both',
    marker: 'function dyPostAtSync(p)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '角色能把图真的发到抖音',
    scope: 'both',
    marker: 'function publishRoleDouyin(c,tx,opt)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '作品详情是独立一页，角色主页点得开',
    scope: 'both',
    marker: "else if(c.p==='dywork')html=dyWorkView()+dyCmLayer();",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '建群的号码函数不再和夹取范围的 dyGNum 重名',
    scope: 'both',
    marker: 'function dyGNewNum()',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '不是作者就不挂作者牌',
    scope: 'both',
    marker: 'function dyCmIsAuthor(v,cm)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '点亮的爱心和收藏的星星是实心的',
    scope: 'both',
    marker: 'function dyIc(name,size,on,onColor,offColor,sw)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '评论按钮是实心白气泡，三个点是镂空的洞',
    scope: 'both',
    marker: 'fill-rule="evenodd" clip-rule="evenodd"',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '信息页里通讯录的人才走 iMessage，陌生号原样',
    scope: 'both',
    marker: 'if(phImsgOn(num,sk))return renderPhoneIMsg(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '聊天背景一人一张，按号码存',
    scope: 'both',
    marker: 'function phSmsBgMap()',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '输入框有字才冒出蓝色发送键',
    scope: 'both',
    marker: "bar.classList.toggle('typing',!!String(ta.value||'').trim());",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '首页和作品详情共用同一条右边栏',
    scope: 'both',
    marker: 'function dyWorkRail(v){return dyRailHTML(v);}',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '首页双击是点赞，不会被带进作品详情',
    scope: 'both',
    marker: "dyCardTap('${v.id}',event,1)",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: '小手机.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：高光是剪成一个环描出来的细线（往里缩 0.75px）',
    scope: 'web',
    file: '小手机.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: '小手机.html',
    marker: 'backdrop-filter:brightness(1.72) saturate(1.68)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：高光是剪成一个环描出来的细线（往里缩 0.75px）',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: 'backdrop-filter:brightness(1.72) saturate(1.68)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：高光是剪成一个环描出来的细线（往里缩 0.75px）',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: 'backdrop-filter:brightness(1.72) saturate(1.68)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '图片作品铺满整屏，底下不再垫一张模糊的自己',
    scope: 'both',
    marker: `\${photo?'<div class="dybg dybg-photo"></div>':\`<div class="dybg" style="background-image:\${grad}"></div>\`}`,
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '全新手机第一次打开套上内置默认美化，已有美化的人一点都不碰',
    scope: 'both',
    marker: 'defaultBeautyApplyOnFirstRun().catch(()=>{})',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '默认美化只认真正空白的手机，手机自己填的电量心率和空相册不算美化',
    scope: 'both',
    marker: 'beautyCustomPart(k,me[k]),beautyCustomPart(k,def[k])',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '美化字段收成一份 BEAUTY_ME_KEYS，导出导入和留住美化共用',
    scope: 'both',
    marker: 'beautyAssign(S.me,pack.me,BEAUTY_ME_KEYS)',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '共同生活顶部那一行收进 acts，外观和多选删除都点得到',
    scope: 'both',
    marker: '<span class="cohab-meta-acts">',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '共同生活的「让TA回」不再被消息列表压住，也不骑在第一条消息上',
    scope: 'both',
    marker: "_manualReply?' cohab-has-reply':''",
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '线下和共同生活只画最近 300 条，其余留在存档里点「看更早」',
    scope: 'both',
    marker: 'const OFF_WINDOW_STEP=300;',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '线下气泡两边都是半透明磨砂，颜色额外发一份 rgba 出去',
    scope: 'both',
    marker: '--offc-me-soft:${offRgba(t.me,.62)}',
    least: 1,
  },
  {
    release: 'v1324/v1325',
    name: '我的气泡默认浅黄，旧的那个默认蓝只迁一次',
    scope: 'both',
    marker: 'if(!t._meWarmV1){if(t.me===OFF_THEME_OLD_ME)',
    least: 1,
  },
];

const sources = { web: read(WEB), private: read(PRIVATE) };

for (const fix of PERMANENT_FIXES) {
  const targets = fix.scope === 'both' ? ['web', 'private'] : [fix.scope];
  for (const target of targets) {
    test(`${target} keeps ${fix.release} — ${fix.name}`, () => {
      const source = fix.file ? read(fix.file) : sources[target];
      const found = count(source, fix.marker);
      assert.ok(
        found >= fix.least,
        `${target} 源码缺少 ${fix.release} 的修复「${fix.name}」：\n` +
        `  期望标记出现至少 ${fix.least} 次，实际 ${found} 次\n` +
        `  标记：${fix.marker}\n` +
        '  这是必须随每个版本一起发布的修复，缺失即为发布阻断项。',
      );
    });
  }
}

test('v1353 private bundle keeps every robot K component and native speech bridge 42', () => {
  for (const f of ['robot-face-protocol.js','private-robot-face.js','private-robot-voice.js','private-device-history.js','private-cloud-usage.js','assets/k-default-face.png','assets/k-faces/miss.gif']) {
    assert.ok(fs.existsSync(new URL('../' + PRIVATE_DIR + f, import.meta.url)), '小K组件缺失：' + f);
  }
  const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
  assert.match(bridge, /case "robot\.speech\.transcribe":/);
  assert.match(bridge, /private final class RobotFileSpeechRecognizer/);
  assert.match(bridge, /static let contractVersion = 42/);
});

test('the private bundle still ships its performance protection component', () => {
  const index = read(PRIVATE_DIR + 'index.html');
  assert.ok(
    fs.existsSync(new URL('../' + PRIVATE_DIR + 'private-runtime-diagnostics.js', import.meta.url)),
    '私人性能保护组件文件缺失',
  );
  assert.match(index, /private-runtime-diagnostics\.js\?v=\d+/, '私人入口没有引用性能保护组件');
});

test('every private release keeps the complete streamed daily cloud-backup chain', () => {
  const index = read(PRIVATE_DIR + 'index.html');
  const alias = read(PRIVATE_DIR + '小手机.html');
  const backupPath = PRIVATE_DIR + 'private-cloud-backup.js';
  const backup = read(backupPath);
  const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
  const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
  const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');

  assert.equal(index, alias, '私人两个入口必须一起携带云备份组件');
  assert.match(index, /private-cloud-backup\.js\?v=\d+/, '私人入口漏掉每日云备份组件');
  for (const action of ['begin', 'chunk', 'commit', 'progress', 'abort']) {
    assert.match(backup, new RegExp(`account\\.backup\\.file\\.${action}`), `网页分片备份漏掉 ${action}`);
    assert.match(bridge, new RegExp(`account\\.backup\\.file\\.${action}`), `原生桥漏掉 ${action}`);
  }
  assert.match(backup, /const CHUNK=192\*1024/, '私人备份不得退回整份大对象跨桥传输');
  assert.match(backup, /account\.backup\.file\.commit',\{token\},1920000/, '网页成功确认必须覆盖完整原生分块上传时限');
  assert.match(bridge, /private actor PrivateBackupFileStore/, '原生临时备份文件存储缺失');
  assert.match(bridge, /privateBackupChunkBytes = 4 \* 1_024 \* 1_024/, '原生端必须把云备份切成安全大小的对象存储分块');
  assert.match(bridge, /\/storage\/v1\/object\//, '私人云备份不得退回整份 jsonb 数据库写入');
  assert.match(bridge, /save_private_phone_backup_manifest/, '全部分块上传后必须提交小型原子清单');
  assert.match(bridge, /restorePrivateBackupFile/, '对象存储备份必须保留完整恢复路径');
  assert.match(bridge, /actualChecksum == expectedChecksum/, '恢复前必须校验整份备份散列');
  assert.match(backup, /正在上传私人云备份/, '私人备份必须向用户显示真实云端上传百分比');
  assert.match(bridge, /backup_upload_timeout/, '原生上传超时不得伪装成账号认证超时');
  assert.match(webView, /action === 'account\.backup\.file\.commit' \? 1800000 : 60000/, 'WKWebView 桥不得提前中断完整分块上传');
  assert.match(project, /isa = PBXFileSystemSynchronizedRootGroup;[\s\S]*?path = PhoneCompanionTest;/, '主 App 资源目录没有纳入 Xcode 文件夹同步');
  assert.doesNotMatch(project, /membershipExceptions = \([^)]*private-cloud-backup\.js/, '私人云备份组件被排除出 Xcode Target');
});

test('the private bundle and web core stay in lockstep on shared repairs', () => {
  for (const fix of PERMANENT_FIXES.filter(x => x.scope === 'both')) {
    assert.equal(
      count(sources.web, fix.marker) > 0,
      count(sources.private, fix.marker) > 0,
      `共有修复「${fix.name}」只存在于其中一侧，两边必须同步`,
    );
  }
});

const DELIVERY_FIXES = [
  { name: '明确长期外卖偏好不依赖模型隐藏标签也会保存', marker: 'function explicitMemoryFromUserText(' },
  { name: '随便点或四件套会继承最近一轮肯德基上下文', marker: 'function contextualKfcAction(' },
  { name: '只说肯德基品牌时不再暴露内部结构错误', marker: 'function brandOnlyDeliveryRequest(' },
  { name: 'v1344 外卖偏好必须是用户本轮亲口态度且是食物', marker: 'function memoryAttitudeGrounded(' },
];


for (const fix of DELIVERY_FIXES) {
  test(`web and private keep v1330/v1331 delivery repair — ${fix.name}`, () => {
    const web = read(DELIVERY);
    const privateSource = read(PRIVATE_DELIVERY);
    assert.ok(count(web, fix.marker) >= 1, `网页外卖缺少永久修复：${fix.name}`);
    assert.ok(count(privateSource, fix.marker) >= 1, `私人外卖缺少永久修复：${fix.name}`);
  });
}

test('the private cozy bundle rejects the two mobile material regressions', () => {
  const app = read(PRIVATE_DIR + 'games/cozy-home/app.mjs');
  const female = read(PRIVATE_DIR + 'games/cozy-home/female-avatar001.mjs');
  assert.doesNotMatch(app, /renderer\.setSize\(96,96,false\)/, '不得恢复用真实房间资源做 96×96 整屋预绘制');
  assert.doesNotMatch(female, /if\(Math\.abs\(amount\)<1e-7\)return/, '不得在静止时跳过女性角色站姿');
});

test('lock screen keeps touch ownership in every shipped shell',()=>{for(const p of ['小手机.html',PRIVATE_DIR+'index.html',PRIVATE_DIR+'小手机.html']){const s=read(p);assert.match(s,/\.lockscreen\{touch-action:none;overscroll-behavior:none;/);assert.match(s,/\.lockscreen\.dragging\{transition:none;\}/);}});

test('authorization relay preserves the original backend identity in both shipped runtimes',()=>{
 for(const p of ['license-gate.js',PRIVATE_DIR+'license-gate.js']){
  const s=read(p);assert.ok(s.includes('function browserLicenseBase(endpoint)'));
  assert.ok(s.includes('https://license.smallphoneapp.com'));assert.ok(s.includes("endpoint.id === 'license-failover'"));
  assert.ok(s.includes('https://lovbzibismsjqvjujilz.supabase.co'));
 }
});

test('support retains the local sticker answer and searchable feature paths in both runtimes',()=>{
 for(const p of ['wechat-me.js',PRIVATE_DIR+'wechat-me.js']){
  const s=read(p);assert.ok(s.includes('function wxSupportCatalogHTML()'));
  assert.ok(s.includes('function wxSupportFilter(value)'));
  assert.ok(s.includes('聊天与媒体 → 角色的表情包'));
  assert.ok(s.includes('动态表情开发中'));
  assert.ok(s.includes('聊天偏好 → 电话频率'));
  assert.ok(s.includes('甜蜜日常 → 布置任务'));
 }
});

// v1532/v1533: chat taxi shorthand must complete a grounded route before execution.
test('chat taxi completion and original payer dedup remain present in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const taxi=read(prefix+'travel-taxi.js'),app=read(prefix+'app.js');assert(taxi.includes('function chatContext(c)'));assert(taxi.includes('async function prepare(content,c,repair)'));assert(taxi.includes('未叫车：'));assert(taxi.includes("o.payer===(c?'ta':'me')"));assert(app.includes('await NorthTravelTaxi.prepare(content,c,'));}});

test('hotel order details retain full-page rendering and role refund isolation in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'travel-hotel.js'),css=read(prefix+'travel-hotel.css');assert(js.includes("if(view==='detail')return detailPage()"));assert(js.includes('rolePlan,detail,backDetail'));assert(css.includes('.cth-detail-fields b{color:#243143;font-size:14px'));assert(js.includes("h.status==='upcoming'&&!NorthHotelData.roleOrder(h)"));}});

test('travel-only white dialog shells and local popular-brand search remain in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){assert(read(prefix+'app.js').includes("m.classList.toggle('north-travel-modal'"));assert(read(prefix+'travel-home.css').includes('#modal.north-travel-modal #modalSheet'));assert(read(prefix+'travel-hotel.js').includes('function requestedBrands(keyword)'));}});

 test('simulated role bookings complete omitted preferences in both runtimes',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const data=fs.readFileSync(prefix+'travel-hotel-data.js','utf8');assert(data.includes('function roleAdvice'));for(const name of ['travel-hotel.js','travel-flight-booking.js','travel-train-booking.js','travel-concert-booking.js','travel-guide.js'])assert(fs.readFileSync(prefix+name,'utf8').includes('roleDate'));}});

 test('travel transport and concert dialogs keep inner whitespace',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const css=fs.readFileSync(prefix+'travel-home.css','utf8');assert(css.includes(':is(.ctf-dialog,.ctn-dialog){padding:20px;border-radius:inherit}'));assert(css.includes('min-height:40px'));}});

 test('all travel user booking entrances offer isolated payment sources in both runtimes',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){assert(fs.readFileSync(prefix+'travel-payment.js','utf8').includes('function currentRequest'));for(const name of ['travel-hotel.js','travel-guide.js','travel-flight-booking.js','travel-train-booking.js','travel-concert-booking.js'])assert(fs.readFileSync(prefix+name,'utf8').includes('NorthTravelPayment.open'));}});

test('mail redesign preserves historical search, reply binding and forwarded snapshots in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'mail-outbox.js'),app=read(prefix+'app.js');for(const marker of ['function mailHighlight','function mailDraftKey','function mailReplySource','originalLetter','function mailForwardHistory','function renderMailRead'])assert(js.includes(marker));assert(!app.includes('if(S.mail.length>60)S.mail=S.mail.slice(0,60)'));assert(app.includes("['mailRead','mailWrite'].includes(page.p)"));assert(app.includes('acct:mailAccount'));}});

test('mail sender identity and fixed-vector actions remain available in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'mail-outbox.js');assert(js.includes('function mailSender(l)'));assert(js.includes('function mailActionIcon(forward)'));assert(js.includes('mail-home-back'));assert(js.includes("l.kind==='self'"));}});

test('independent girl/pet home controls and first-run custom-icon protection remain in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js');assert(app.includes("pixelhome:'像素少女',pet:'电子宠物'"));assert(app.includes('function homeGameEntriesMigrate()'));assert(app.includes('defaultBeautyMark();save();appIconEditor();'));assert(read(prefix+'pixel-home.js').includes("appLocked('pixelhome')"));assert(read(prefix+'pet-game.js').includes("appLocked('pet')"));}});

test('all home icons retain the approved hollow glass highlight in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const css=read(prefix+'glass-theme.css'),rim=css.match(/\.home \.app \.ic:after\{([^}]+)\}/)?.[1];assert(rim);assert(rim.includes('padding:.8px'));assert(rim.includes('mask-composite:exclude'));assert(rim.includes('pointer-events:none'));assert(!rim.includes('blur('));assert(css.includes('.ic.custom-app-icon{background:transparent!important}'));}});

test('photo album keeps role likes permission-bound, independent favorites, safe metadata and category editors, and successful share returns library',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'photo-album.js'),app=read(prefix+'app.js');for(const marker of ['function photoAlbumHasLikes','async function photoAlbumUserLike','async function photoAlbumRoleLike','_photoAlbumRoleLikeBusy','shared=!!text.trim()','function photoAlbumCategoryHTML','async function photoAlbumCategorySave','function photoAlbumEditOpen','async function photoAlbumEditSave','function photoAlbumCommentRefresh','photoAlbumLikeBadge'])assert(js.includes(marker));assert(js.includes("groups=[...PHOTO_ALBUM_GROUPS,'我的喜欢']"));assert(js.includes('options.keepViewer'));assert(js.includes("_photoAlbumTab='library'"));assert(app.includes('content=await photoAlbumConsumeLikes(content,c,outcome,userText)'));}});


test('message banners keep scoped swipe dismissal and nearby has complete couple lock entry guards in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js'),html=read(prefix+'小手机.html');for(const marker of ['function msgBannerGesture(e)','_msgBannerNoClickUntil','nearby:()=>go(\'wxnearby\')','wxnearby:\'nearby\'','function wxNearbyBlocked()','if(wxNearbyBlocked())return;','if(p===\'wxnearby\'&&wxNearbyBlocked())return'])assert(app.includes(marker));assert(html.includes('onpointermove="msgBannerGesture(event)"'));assert(html.includes('touch-action:none;user-select:none'));}});

test('web direct Screen Time upload and pre-chat owner-isolated cloud read remain',()=>{for(const prefix of ['']){const js=read(prefix+'phone-shortcuts.js');for(const marker of ['async function cloudSetup','async function cloudPull','async function cloudRevoke','function cloudPrompt',"request('screen_save'","request('screen_pull'","await cloudPull(true)","cloudSlot()!==slot"])assert(js.includes(marker));}assert(read('supabase/functions/phone-shortcuts/index.ts').includes("action==='screen_upload'"));});

test('single photo viewer trash uses durable album deletion in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'photo-album.js');assert(js.includes('onclick="photoAlbumDeleteCurrent()"'));assert(js.includes('async function photoAlbumDeleteCurrent()'));assert(js.includes('await photoAlbumDeleteSelected({owner,rows:new Set([row]),viewer:v})'));assert(js.includes('v.owner!==owner'));assert(!js.includes("photoAlbumPreviewAction('删除照片')"));}});

test('album deletion supplies bounded pre-delete facts without rerecognition or reviving photo memory',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'photo-album.js');for(const marker of ['function photoAlbumDeleteSnapshot(rows,context)','deletedFacts=photoAlbumDeleteSnapshot(removed,albumContext)',"photoAlbumNotifyOperation('delete',removed.length,[],albumContext,deletedFacts)",'rows.filter(r=>allowed.has(r)).slice(0,20)',"r.visionState==='success'?text(r.desc,300)",'不是当前相册照片','不要重新识图'])assert(js.includes(marker));}});

test('recently deleted retains originals for three days and restores complete rows in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const js=read(prefix+'photo-album.js');for(const marker of ['PHOTO_ALBUM_TRASH_MS=3*24*60*60*1000','photoAlbumTrashEntry()','async function photoAlbumTrashRestore()','async function photoAlbumTrashExpire()','S.photoAlbum.deletedItems=trash','items=before.concat(entry.row)','if(!await saveNowAsync())throw Error(\'清理未保存\')'])assert(js.includes(marker));}});


test('real-friend route recovery keeps read-only failover and single-write protection in both runtimes',()=>{for(const file of [WEB,PRIVATE]){const js=read(file);for(const marker of ['[GATE_URL,PF_RELAY_BASE].forEach','Math.min(ms||15000,15000)','attempt<(write?1:2)','backendCode:','pfSubmissionUnknown','phoneFriendSync(true,false)'])assert(js.includes(marker),file+': '+marker);}});

test('marketplace keeps couple-only cloud funds, guarded gift cards and original simulation payment isolation',()=>{
 for(const prefix of ['',PRIVATE_DIR]){
  const ui=read(prefix+'commerce-ui.js'),app=read(prefix+'app.js');
  for(const marker of ['function northMarketCoupleRole()','function northMarketTransactions()','northMarketTransactionSnapshot(d)','真人店铺不支持亲属卡','window.northMarketRoleBank','window.northMarketPinSettings','northMarketSpecChange()'])assert(ui.includes(marker));
  assert(app.includes('northMarketRoleBank(id)'));assert(app.includes('NorthMarket.giftCard(c,m)'));
 }
 const sql=read('supabase/migrations/202610070001_north_market.sql');
 for(const marker of ['values(actor,100000)','market-couple-only','market-completed-order-required','market-self-order-not-allowed','north_market_upload_boundary',"p_target not in ('wallet','couple')"])assert(sql.includes(marker));
});
test('marketplace preserves independent split confirmation, one seller reply and cloud-only new voucher purchase',()=>{
 for(const prefix of ['',PRIVATE_DIR]){
  const ui=read(prefix+'commerce-ui.js');
  for(const marker of ['northMarketResumeSplit(entry)','northMarketSplitPay(pin)','northMarketReviewInbox(false)','northMarketReplySend','northScheduleOpen(true)','window.northStartCouponPurchase=function(id){return northMarketCouponBuy(id);}','northArrivalBanner'])assert(ui.includes(marker));
 }
 const sql=read('supabase/migrations/202610070002_north_market_social_orders.sql');
 for(const marker of ['market-reply-already-sent','market-friend-only','if g.host_paid and g.guest_paid','g.state=\'pending\' and g.expires_at<=now()','market-client-used-for-split','market-scheduled-time-not-reached'])assert(sql.includes(marker));
});
test('market business retains finite paid inventory, manual couple funds, three storefronts and thirty-day visits',()=>{
 for(const prefix of ['',PRIVATE_DIR]){
  const ui=read(prefix+'commerce-ui.js'),app=read(prefix+'app.js');
  for(const marker of ['northRecentVisits(rows,now)','30*86400000','northExpireFootprints()','northBusinessRetry()','businessPending','northPreferredRoleFood','northRoleChoice','northRoleSimplePlan','northRoleOrderProgress','northRoleEnsureAction','northCompactOrderItems','northRoleBestCoupon','role_checkout','wx-north-food-result','northBusinessRoleRefresh','north-soldout','north-wallet-view'])assert(ui.includes(marker));
  assert(app.includes('NorthMarketBusiness.preferredFood'));assert(app.includes('NorthMarketBusiness.roleFacts'));
 }
 const sql=read('supabase/migrations/202610070002_north_market_social_orders.sql');
 for(const marker of ['values(actor,50000)','market-three-shop-limit','market-earned-profit-required','market-completed-order-no-refund','north_market_stock_take','north_market_stock_restore','north_market_stock_lots','north_market_role_order','notice_revision=i.restock_revision'])assert(sql.includes(marker));
});

test('cloud voucher entry keeps the colorful main page, one-line address and independent runner entry',()=>{
 for(const prefix of ['',PRIVATE_DIR]){
  const ui=read(prefix+'commerce-ui.js');
  for(const marker of ['north-voucher-header','northMarketCouponRules','northMarketCouponBuy','white-space:nowrap;overflow:hidden;text-overflow:ellipsis',"window.mtFoodErrand=function(){if(window.NorthRunner)NorthRunner.open();","c[0]==='errand'?'mtFoodErrand()'"])assert(ui.includes(marker));
  assert(ui.includes("v.page==='coupons'?' north-voucher-page'"));assert(ui.includes('return northMarketCoupons();'));
 }
});

test('market rules and distinct replenishment/wallet icons remain in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');for(const marker of ['northArrivalRoute','north_role_arrival_','.north-search-recommend>button>span:not(.north-nearby-body)','northMarketPageGet','northMarketPagePut','data-cloud-group','northMarketBack','northMarketReviewStars','auto_delivery_at','north_shop_delivery_minutes','shop_cover','northMarketUtensilSave','northMarketProgress','northMarketHomeRefresh','north-cloud-order-detail','northVisibleCartRows','进入店铺继续结算','免邀请码预览不能提交真人订单','northPlayRulesHTML','northPlayRules()', 'northMerchantDefaultSpecs','northMerchantSpecsTemplate','northMerchantSpecsApply','_northStoreSpecTemplate','northOwnShopHomeHTML','northOwnShopOpen','northMerchantProductSpecs','northMerchantPreviewTab','northSpecDialogHTML','northSpecGroupsHTML','north-spec-sheet','northAIShopCheckout','northAITemperature','northAIQuotePreview','northBusinessBatchOpen','northMerchantQuickTag','northMerchantPreviewBack','northMarketArgument','north-menu-layout', 'data-north-icon="stock"','data-north-icon="wallet"','fmtDT(Date.parse(c.expires_at))'])assert(ui.includes(marker));assert.match(read(prefix+'app.js'),/cohab-history-delete[^>]*offDelHistory/);}});

test('delivery runner retains separate reward replay and game/result music in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const game=read(prefix+'north-runner.js');for(const marker of ['function primeMusic','north-runner-game.mp3',"music(v,'result',true)","music(v,'game',true)","a.loop=kind==='game'",'function project(gap)','g.orders=Math.min(g.physicsVersion>=6?25:g.physicsVersion>=5?18:10'])assert(game.includes(marker));}const sql=read('supabase/migrations/202610080002_north_runner_rewards.sql');for(const marker of ['north_runner_sessions','runner-too-fast','runner-invalid',"status='claimed'",'3000-used','runner_reward'])assert(sql.includes(marker));});

test('portable merchant packages and raw-mode cloud order recovery stay available in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');for(const marker of ['northMerchantPackParse','northMerchantPortableImage','northMerchantExport','northMerchantImport','north-shop-pack'])assert(ui.includes(marker));const app=read(prefix+'app.js');assert(!app.includes("if(!_rawOutput&&typeof NorthMarketBusiness!=='undefined'&&typeof NorthMarketBusiness.ensureAction"));}assert(read('supabase/migrations/202610080003_north_runner_continuous_speed.sql').includes('physics_version'));});

test('dessert catalog, merchant removal and timed oral order recovery remain in both runtimes',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');for(const marker of ['northBuiltinOpen','northMerchantSaleShop','northMerchantDelete','north-pack-export','explicitOrderRequest'])assert(ui.includes(marker));assert.match(read(prefix+'north-runner.js'),/p_physics:6/);assert.match(read(prefix+'小手机.html'),/assets\/north-dessert-shop\.js/);assert.match(read(prefix+'assets/north-dessert-shop.js'),/NORTH甜品店/);}});

test('missing commerce never silently exposes the legacy food renderer',()=>{for(const prefix of ['',PRIVATE_DIR]){assert.match(read(prefix+'app.js'),/function renderFood\(\)\{return northCommerceUnavailableHTML\(\);\}/);assert.match(read(prefix+'commerce-ui.js'),/__NORTH_COMMERCE_READY__=window\.__NORTH_SHELL_BUILD__/);assert.match(read(prefix+'小手机.html'),/onerror="northCommerceLoadFailed\(\)"/);}assert.match(read('sw.js'),/kind:'commerce'/);});

test('fixed dessert visibility and clearable search remain independent of saved keywords',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');assert(ui.includes("northCard()+northBuiltinCards('')"));assert(ui.includes('window.northSearchInput='));assert(!ui.includes('northSearchClearButton'));assert(ui.includes('function northFixedShopCard('));assert(ui.includes('localMenus:localMenus'));assert(ui.includes('if(fixedShop)return northRoleVirtualReceipt')); assert(ui.includes('editEpoch!==northSearchEditEpoch'));}});

test('real dish ordering preserves minimum completion and never reimports deleted local archives',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');assert(ui.includes('function northRoleCompleteMinimum('));assert(ui.includes('intent.catalogOnly'));assert(ui.includes('archived.status===\'deleted\''));assert(ui.includes('_northOrderFailureStage:stage'));assert(ui.includes('function northRoleRequestedLines('));assert(ui.includes('northCompactOrderItems(o,true)'));assert(ui.includes('taggedItems:meta.northTaggedItems')); }});

test('merchant product positions survive publication and both public and private editors',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');assert(ui.includes('window.northMerchantProductMove='));assert(ui.includes('function northMerchantOrderedProducts('));assert(ui.includes('p._northDisplayOrder=index'));assert(ui.includes('view.products=northMerchantOrderedProducts(data.products)'));}});

test('role chooses its own search tool and deleted shops do not remain active joint businesses',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js'),ui=read(prefix+'commerce-ui.js');assert(app.includes("function autoWebQuery(){return ''; }"));assert(app.includes('NorthMarketBusiness.queryShops(c,_shopAction[1])'));assert(app.includes('_deliveryActionMeta.northRequestKey||_deliveryActionMeta.messageId'));assert(ui.includes('function northRoleOrderRequest('));assert(ui.includes('function northActiveBusinessData('));assert(ui.includes('northActiveBusinessData(v.data)'));}});

test('cloud coupon selector shares the original ticket layout',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');assert(ui.includes('function northMarketCouponCard('));assert(ui.includes('northMarketCouponCard(c,true,d.couponId===c.id)'));assert(ui.includes('northMarketCouponCard(c,false,false)'));}});


test('cloud deletion, adjacent moves, nonempty shop continuation and natural social openings remain',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js'),ui=read(prefix+'commerce-ui.js');for(const marker of ['async function northShopPostQueryReply(','_northShopReplyFailure','function roleSocialOpeningPrompt(','不要习惯性以'])assert(app.includes(marker));for(const marker of ['async function northSyncDeletedShops(',"northMarketRpc('shop_delete'",'window.northBusinessDeleteShop=','target=index+direction'])assert(ui.includes(marker));}const sql=read('supabase/migrations/202610080006_north_market_shop_delete.sql');assert(sql.includes('deleted_at'));assert(sql.includes('market-shop-deleted'));});


test('shop lookup returns a visible result card and the original McDonalds pack stays installed',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js'),ui=read(prefix+'commerce-ui.js'),html=read(prefix+'小手机.html');assert(app.includes('function northShopQueryRecord('));assert(app.includes("m.type==='shopquery'"));assert(ui.includes('function northShopQueryCard('));assert(ui.includes('查看完整店铺'));assert(html.includes('assets/north-mcdonalds-shop.js'));assert(read(prefix+'assets/north-mcdonalds-shop.js').includes('麦麦五件套'));}assert(read('sw.js').includes("GLASS_ICON_CACHE='north-glass-icons-v2'"));});


test('personal wardrobe stays account-isolated and framing never turns hand/back requests into forced portraits',()=>{for(const prefix of ['',PRIVATE_DIR]){const app=read(prefix+'app.js'),ui=read(prefix+'commerce-ui.js');for(const marker of ['function userImageStudioContact(','function roleImageFrame(','【局部构图优先】','【参考图人物绑定】','requireReferences:','本次未退回随机形象','accountId:actId()'])assert(app.includes(marker));assert(ui.includes('queriedMeal'));assert(ui.includes('plainMeal'));assert(read(prefix+'小手机.html').includes('assets/north-luckin-shop.js'));assert(read(prefix+'wechat-me.js').includes('我的形象工作室与衣柜'));}});


test('pharmacy remains in medicine category and the personal wardrobe entry stays at the profile bottom',()=>{for(const prefix of ['',PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js'),me=read(prefix+'wechat-me.js'),html=read(prefix+'小手机.html');assert(ui.includes("['medicine','看病买药','看病买药']"));assert(html.includes('assets/north-pharmacy-shop.js'));const profile=me.slice(me.indexOf('function renderWxProfile('),me.indexOf('function wxProfileAvatar'));assert(profile.indexOf('userImageStudioOpen()')>profile.indexOf("wxProfileEdit('persona')"));assert(read(prefix+'assets/north-pharmacy-shop.js').includes('布洛芬缓释胶囊'));}});

test('web and private launch isolate optional component availability',()=>{
 for(const relative of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  const launch=fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
  assert.ok(launch.includes("typeof openPixelHome!=='function'"));
  assert.ok(launch.includes("typeof openPetGame!=='function'"));
 }
});

test('store sharing, oral stock reminders and purchase/sales inspection remain in both runtimes',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const commerce=fs.readFileSync(prefix+'commerce-ui.js','utf8'),app=fs.readFileSync(prefix+'app.js','utf8');for(const marker of ['northShareVisit','northSharedCatalog','northBusinessReminderFlights','_northBusinessNoticeIds','<300000','northPrepareOrderInspection','店铺收到的顾客订单'])assert.ok(commerce.includes(marker),prefix+marker);assert.ok(app.includes("m.type==='shopshare'"));assert.ok(app.includes('NorthMarketBusiness.prepareInspection(c)'));}});

test('historical opening reward identity and ledger guards remain independent of initial grant',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');for(const marker of ['northMarketShopRewardHTML','northMarketShopRewardClaim','开店1000额度已领取'])assert.ok(s.includes(marker));}const sql=fs.readFileSync('supabase/migrations/202610080007_north_market_shop_reward.sql','utf8');for(const marker of ["north_market_identity(p_phone_id,p_secret)","where kind='shop_reward'","deleted_at is null","north-market-owner:","north-market-wallet:","rewardDuplicate"])assert.ok(sql.includes(marker));});

test('cloud review images keep direct image viewer hooks in web and private',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');assert.ok(s.includes('northMarketReviewPhoto(url,r.order_id,i,false)'));assert.ok(s.includes('northMarketReviewPhoto(url,d.id,i,true)'));assert.ok(s.includes("typeof viewImg==='function'"));}});

test('role approval pays without a second owner PIN and retains wallet PIN branch',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');assert.ok(s.includes("roleAuto:true"));assert.ok(s.includes("await northMarketRoleContinue(r.id)"));assert.ok(s.includes("return await northMarketSubmitOrder('')"));}assert.ok(fs.readFileSync('supabase/migrations/202610080007_north_market_shop_reward.sql','utf8').includes('role-card-no-second-pin'));});

test('cloud seller order totals and three minute runner cap remain inherited',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){assert.ok(fs.readFileSync(prefix+'commerce-ui.js','utf8').includes('northMyAssetOrders().count'));assert.ok(fs.readFileSync(prefix+'north-runner.js','utf8').includes('p_physics:6'));}const sql=fs.readFileSync('supabase/migrations/202610080007_north_market_shop_reward.sql','utf8');for(const marker of ['sellerOrderCount','runner-three-minute-v5','greatest(0,10000-used)'])assert.ok(sql.includes(marker));});

test('shared restaurant short buy and meal requests retain context in both runtimes',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');for(const marker of ['northRoleShortBuyContext','northRoleSharedMenuFacts','sharedShopMenu:northRoleSharedMenuFacts(c)','牛腩|小炒肉|米饭|正餐'])assert.ok(s.includes(marker));}});

test('final runner150 and hidden intermediate shop-query bubbles remain inherited',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const game=fs.readFileSync(prefix+'north-runner.js','utf8'),app=fs.readFileSync(prefix+'app.js','utf8');assert.ok(game.includes('p_physics:6'));assert.ok(game.includes('每局最长150秒'));assert.ok(app.includes("function bubbleRow(c,m){if(m&&m.type==='shopquery')return '';"));}assert.ok(fs.readFileSync('supabase/migrations/202610080008_north_runner_150_seconds.sql','utf8').includes('runner-150-seconds-v6'));});

test('missing flight query runtime cannot block role prompts or generic chat',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'travel-flight-booking.js','utf8');for(const marker of ['function flightReady()',"typeof NorthTravelFlight!=='undefined'",'flightReady()?NorthTravelFlight.state():null','Array.isArray(q.people)','!c||!flightReady()'])assert.ok(s.includes(marker));}});

test('shop reward lifetime tiers and selected restocking keep backend ownership and cloud startup fees',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');for(const marker of ['northBusinessStockSelect','northBusinessSelectionRows','northBusinessBatchOpen(true)','p_tier:tier','删店重开不重置','从本人美团云端余额支付，不要求净利润'])assert.ok(s.includes(marker),marker);}const sql=fs.readFileSync('supabase/migrations/202610080009_north_market_shop_reward_tiers.sql','utf8');for(const marker of ['north_market_one_shop_reward_tier','shop_reward_tier=1','owned<p_tier','p_tier<>claimed+1','balance=balance-fee','else 50000 end','public.north_market_shop_reward(p_phone_id,p_secret,1)'])assert.ok(sql.includes(marker),marker);});

test('realized profit remains visible and deleted shop filtering is seller-only before pagination',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const s=fs.readFileSync(prefix+'commerce-ui.js','utf8');for(const marker of ['已实现净利润','money(d.profit/100)','northMarketVisibleOrders','if(!v.seller)return rows','northMarketWalletCache=null;northMarketPageReset()'])assert.ok(s.includes(marker),marker);}const sql=fs.readFileSync('supabase/migrations/202610080010_north_market_deleted_shop_orders.sql','utf8');assert.ok(sql.indexOf('not coalesce(p_seller,false)')<sql.indexOf('limit 21'));assert.ok(sql.includes('s.deleted_at is null'));assert.ok(!/delete from|truncate/i.test(sql));});

test('role phone gallery reads only saved role likes and never routes to the legacy generated album',()=>{for(const base of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const app=fs.readFileSync(base+'app.js','utf8'),album=fs.readFileSync(base+'photo-album.js','utf8');assert.ok(app.includes("typeof renderRolePhotoAlbum==='function'?renderRolePhotoAlbum(id)"));assert.ok(!app.includes("title='相册';body=spyAlbumHTML(d)"));for(const marker of ['photoAlbumRoleLikedRows','likes[c.id]','snapshot.owner!==(S.me.active','模拟按钮不可点击','rows.includes(previous.selected)'])assert.ok(album.includes(marker),marker);}});


test('calendar role participation and real shared scheduling remain in both runtimes',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const app=fs.readFileSync(prefix+'app.js','utf8');for(const marker of ['function calParticipation(e,cid)','function calRoleCanRemind(e,cid)','async function calPlayerConsume(content,c,turn)','function calCreatedCardHTML(m)','function calFireCalendarCare(now)','async function calRoleParticipationConsume(content,c)','function calCareValid(meta,cid,owner)','async function calEventOutcome(id,date)','function calParticipationHTML(e,draft)','function calPeriodOpen('])assert.ok(app.includes(marker),marker);}});
test('merchant replenishment keeps one-shop quotes, shop-scoped lists and explicit per-product quantities',()=>{for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){const ui=fs.readFileSync(prefix+'commerce-ui.js','utf8');for(const marker of ['function northBusinessShopId(data)','function northBusinessCurrentStock(data)','window.northBusinessShopSelect=','window.northBusinessBatchQuantity=','onlyEmpty:selectedOnly!==true','new Set(rows.map(function(r){return r.shop_id;})).size!==1'])assert.ok(ui.includes(marker),marker);}});


test('calendar offers a desktop exit and warm shop remains in both built-in catalogues',()=>{for(const prefix of ['', PRIVATE_DIR]){const app=read(prefix+'app.js');assert.ok(app.includes('function calHome()'));assert.ok(app.includes('aria-label="返回主屏幕"'));assert.ok(read(prefix+'glass-theme.css').includes('.cal-integrated-page .cal-period-note'));assert.ok(read(prefix+'assets/north-dessert-shop.js').includes('north-nuanyan'));}});


test('deleted merchant recovery remains owner-authenticated and does not charge or reset rewards',()=>{for(const prefix of ['', PRIVATE_DIR]){const ui=read(prefix+'commerce-ui.js');for(const marker of ['northDeletedShopsOpen','northDeletedShopRestore','northRestoredShop','恢复不收费','恢复中…'])assert.ok(ui.includes(marker),marker);}const sql=read('supabase/migrations/202610090001_north_market_shop_restore.sql');for(const marker of ['owner_id=actor','market-revision-changed','market-shop-limit','deleted_at=null,published=false','north-market-owner:'])assert.ok(sql.includes(marker),marker);assert.ok(!/update public\.north_market_wallets|insert into public\.north_market_ledger/i.test(sql));});
