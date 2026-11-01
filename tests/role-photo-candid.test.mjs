// ROLE_PHOTO_CANDID_V1：「生活抓拍·不露脸」开了以后，发给出图模型的文字里绝对没有旧的手机挡脸写法。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR } from './_helpers.mjs';

const PRIV = PRIV_DIR;

function candidModule(src) {
  const start = src.indexOf('/* ROLE_PHOTO_CANDID_V1');
  assert.notEqual(start, -1, '缺少 ROLE_PHOTO_CANDID_V1');
  return src.slice(start, src.indexOf('function charImgPrompt(', start));
}

// 旧写法：这些说法只要出现在最终文字里就算走了原来的写法
const OLD = [/手机[^。；;！!\n]{0,14}(?:遮|挡)/, /(?:遮|挡)[^。；;！!\n]{0,10}手机/, /对镜自拍/, /镜中自拍/, /phone fully cover/i, /with a phone/i, /Mirror selfies are allowed/i, /hide the whole face/i];
const oldHits = (text) => OLD.filter((re) => re.test(text)).map(String);

function world(src, role) {
  const sent = [];
  const ctx = vm.createContext({
    S: { settings: { imgBase: 'https://img.test', imgKey: 'k', imgModel: 'm', chat: {} }, me: { name: '我' } },
    actId: () => 'main', Math, String, JSON, Object, Array, Promise, Error, RegExp,
    getC: () => role, roleImageStudioOwner: () => role, roleImageGenerateOptions: () => ({ faceMode: 'hidden', references: [] }),
    viewerImageSource: async () => '', imageGenerateExternal: async (b, k, m, prompt) => { sent.push(prompt); return { url: 'https://img.test/a.png' }; },
    rolePhotoSceneLogic: () => '', rolePhotoPeoplePolicy: () => '【男性角色与人物名单锁】', rolePhotoGender: () => ({ cn: '成年男性', en: 'adult man', ban: 'female' }),
    rolePhotoContextRequest: () => '', rolePhotoLatestUserImageRequest: () => '', rolePhotoSceneOnlyRequest: () => false, rolePhotoClothesOnlyRequest: () => false,
  });
  vm.runInContext(candidModule(src) + fnSource(src, 'rolePhotoPromptLocked') + fnSource(src, 'genImage')
    + ';this.gen=genImage;this.candidPrompt=rolePhotoCandidPrompt;this.on=rolePhotoCandidOn;this.look=typeof rolePhotoCandidLook===\'function\'?rolePhotoCandidLook:null;', ctx);
  return { ctx, sent };
}

// 旧版 charImgPrompt 写出来的那种照片说明（聊天里可能还存着）
const STALE = '【最高优先级构图锁】整张图片绝对不能出现任何人的脸。人物入镜时必须用手机、手、阴影把整张脸完全遮住。这次拍到的是：手机完全遮住脸的对镜自拍，在卧室。人物构图优先选：手机完全遮脸的自拍/对镜自拍。背景和地点严格服从描述。';

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);

  test(label + ' candid on: what reaches the image model never contains the old phone-over-face wording, even from a stale prompt', async () => {
    const role = { id: 'r1', name: '先生', photoStyle: 'candid', photoBody: '手白、修长、骨节分明' };
    const { ctx, sent } = world(src, role);
    await ctx.gen(STALE, { roleId: 'r1' });
    assert.deepEqual(oldHits(sent[0]), [], sent[0].slice(0, 400));
    assert.match(sent[0], /^CANDID NO-FACE COMPOSITION/);
    assert.match(sent[0], /背景和地点严格服从描述/, '旧说明里的其他要求照样保留');
  });

  test(label + ' candid is recognised from the prompt mark even when the role was not passed along', async () => {
    const role = { id: 'r1', name: '先生', photoStyle: 'candid' };
    const { ctx, sent } = world(src, role);
    const prompt = ctx.candidPrompt(role, '对镜自拍，手机挡脸，在卧室', { test: true });
    await ctx.gen(prompt, {});
    assert.deepEqual(oldHits(sent[0]), []);
    assert.match(sent[0], /^CANDID NO-FACE COMPOSITION/);
  });

  test(label + ' candid photos rotate between hands, body, back, silhouette, point of view and shadow, and use her body traits', () => {
    const role = { id: 'r1', name: '先生', photoStyle: 'candid', photoBody: '手白、修长、骨节分明' };
    const { ctx } = world(src, role);
    const seen = new Set();
    for (let i = 0; i < 80; i += 1) {
      const p = ctx.candidPrompt(role, '随手拍一张你现在在做的事', { test: true });
      assert.deepEqual(oldHits(p), []);
      assert.match(p, /手白、修长、骨节分明/);
      seen.add(p.match(/【本张构图】(.{0,6})/)[1]);
    }
    assert.ok(seen.size >= 4, '构图要换着来，不能每张一样：' + [...seen].join('|'));
    assert.match(ctx.candidPrompt(role, '拍一下你的手', { test: true }), /【本张构图】手部特写/);
  });


  test(label + ' candid v2: the persona looks (handsome, muscular) reach the photo even when written late, face details become one handsome line', () => {
    const persona = '他是公司的总经理，平时话不多，对下属很严厉，但对她很温柔，喜欢在深夜加班后给她打电话，偶尔会抽烟，烟味很淡。他长相非常帅，眉眼深邃，鼻梁高挺。身高188，宽肩窄腰，身材很壮，有明显的腹肌和胸肌。手很大，骨节分明，手背有青筋。';
    const role = { id: 'r1', name: '先生', photoStyle: 'candid', persona };
    const { ctx } = world(src, role);
    assert.ok(ctx.look, '缺少 rolePhotoCandidLook');
    const look = ctx.look(role);
    assert.match(look, /^长相非常帅气精致/);
    assert.match(look, /身高188，宽肩窄腰，身材很壮，有明显的腹肌和胸肌/);
    assert.match(look, /骨节分明/);
    assert.doesNotMatch(look, /眉眼|鼻梁/, '写五官的句子不直接带进去，免得去画脸');
    const p = ctx.candidPrompt(role, '在办公室加班', { test: true, shot: 'torso' });
    assert.match(p, /身材很壮/);
    assert.match(p, /strikingly handsome/);
    assert.match(p, /muscular build/);
    assert.match(p, /stubby fingers/);
    assert.doesNotMatch(p, /虚焦|手抖|噪点|不端正|imperfect framing/, '不再要求拍糊');
    assert.match(ctx.candidPrompt(role, '在办公室加班，喝咖啡', { test: true }), /【本张构图】/, '咖啡这类东西拍他拿着，不变成空镜');
    assert.match(ctx.candidPrompt(role, '窗外的夜景', { test: true }), /ZERO PEOPLE/, '夜景照旧只拍景色');
  });
  test(label + ' candid off: the original behaviour is untouched (so switching off really rolls back)', async () => {
    const role = { id: 'r1', name: '先生' };
    const { ctx, sent } = world(src, role);
    await ctx.gen('普通照片说明。', { roleId: 'r1' });
    assert.match(sent[0], /^ABSOLUTE COMPOSITION AND GENDER RULE/);
  });

  test(label + ' every role photo path hands the style over: chat photos, the chat model rules and the settings switch', () => {
    assert.match(fnSource(src, 'charImgPrompt'), /^function charImgPrompt\(c,desc\)\{\n\s*if\(rolePhotoCandidOn\(c\)\)return rolePhotoCandidPrompt\(c,desc\);/);
    assert.match(src, /genOptions:rolePhotoCandidOn\(cch\)\?\{roleId:cch\.id,accountId:actId\(\),photoStyle:'candid'\}/);
    assert.match(src, /&&!rolePhotoCandidOn\(c\)&&roleImageFaceMode\(c\)!=='allowed'\)s\+='\\n  · 【遮脸硬规则/);
    assert.match(fnSource(src, 'roleImageStudioRoleLine'), /^function roleImageStudioRoleLine\(c\)\{if\(rolePhotoCandidOn\(c\)\)return'/);
    assert.match(src, /onclick="rolePhotoCandidToggle\('\$\{id\}'\)"/);
  });
}
