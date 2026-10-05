import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/const PHONE_NOTICE_ACCEPTED_KEY='north_ai_account_notice_accepted'/);
assert.match(source,/欢迎来到小手机。/);
assert.match(source,/这里的角色由人工智能生成，是基于设定与用户互动的虚拟角色，并非现实中的真人。/);
assert.match(source,/AI无法替代现实中的亲友关系，也无法代替专业人士提供医疗、心理、法律、金融等方面的帮助。/);
assert.match(source,/未满18岁的用户如需使用或购买相关服务，请提前取得监护人同意，并遵守相关年龄限制。/);
assert.match(source,/正常调用成功产生的消耗不支持退还，调用失败将按照页面规则处理，法律另有规定的除外。/);
assert.match(source,/感谢大家喜欢小手机，希望它能给大家带来快乐和陪伴/);
assert.match(source,/继续进入，即表示您已阅读并同意以上内容。/);

assert.match(source,/onclick="acceptPhoneNotice\(\)">我已阅读并同意/);
assert.match(source,/localStorage\.setItem\(PHONE_NOTICE_ACCEPTED_KEY,'1'\)/);
const acceptStart=source.indexOf('function acceptPhoneNotice('),acceptEnd=source.indexOf('\nfunction exitPhoneNotice(',acceptStart);
assert.ok(acceptStart>=0&&acceptEnd>acceptStart);
assert.doesNotMatch(source.slice(acceptStart,acceptEnd),/maybeFirstRun/);
assert.match(source,/function maybePhoneNotice\(\).*phoneNoticeAccepted\(\)/s);
assert.match(source,/setTimeout\(maybeFirstRun,600\)/);
assert.match(source,/licenseFinishGate\(\).*setTimeout\(maybeFirstRun,400\)/s);
assert.doesNotMatch(source,/renderSettings\(\)[\s\S]*?onclick="showPhoneNotice\(false\)"/);
assert.match(source,/e\.target\.id==='modal'&&!_phoneNoticeRequired/);
assert.doesNotMatch(source,/PHONE_NOTICE[^\n]*(birth|birthday|idcard)/i);

console.log('phone notice tests passed');
