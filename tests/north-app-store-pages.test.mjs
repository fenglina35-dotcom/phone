import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const support=readFileSync(new URL('../north-support.html',import.meta.url),'utf8');
const privacy=readFileSync(new URL('../north-privacy.html',import.meta.url),'utf8');
const controller=readFileSync(new URL('../north-role-controller.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('North support page gives review-safe setup and recovery guidance',()=>{
  assert.match(support,/<title>North 支持<\/title>/);
  assert.match(support,/屏幕使用时间/);
  assert.match(support,/锁定或解锁没有立即生效/);
  assert.match(support,/不能查看第三方 App 的聊天、私信或页面内容/);
  assert.match(support,/north-support\.html\?role-controller=1/);
  assert.match(support,/fetch\('\.\/north-role-controller\.html',\{cache:'no-store'\}\)/);
  assert.match(support,/north-privacy\.html/);
  assert.match(support,/无需注册即可在自己的浏览器创建独立控制端/);
  assert.match(support,/管理员操作顺序：创建控制端/);
  assert.doesNotMatch(support,/service_role|owner_secret|pair_secret|eyJ[A-Za-z0-9_-]+\./);
});

test('North privacy page truthfully describes sensitive-data boundaries',()=>{
  assert.match(privacy,/<title>North 隐私政策<\/title>/);
  for(const phrase of ['屏幕使用时间','步数和睡眠','位置数据','不出售个人数据','Supabase','HealthKit','取消配对']){
    assert.match(privacy,new RegExp(phrase));
  }
  assert.match(privacy,/不读取微信、抖音或其他第三方 App 的聊天、私信、照片、页面内容/);
  assert.match(privacy,/north-support\.html/);
  assert.match(privacy,/服务器只保存密钥哈希/);
  assert.match(privacy,/网页删除控制端及其服务器配对数据/);
  assert.doesNotMatch(privacy,/service_role|owner_secret|pair_secret|eyJ[A-Za-z0-9_-]+\./);
});

test('service worker never replaces App Store public documents or role controller with the app shell',()=>{
  const publicDocumentGuard="if(request.mode==='navigate'&&/\\/north-(?:support|privacy|role-controller)\\.html$/.test(url.pathname))return;";
  assert.match(sw,/request\.mode==='navigate'&&\/\\\/north-\(\?:support\|privacy\|role-controller\)\\\.html\$\//);
  assert.ok(sw.indexOf(publicDocumentGuard)<sw.indexOf("if(request.mode==='navigate'){"));
  assert.match(controller,/north-role-controller\.js\?v=20260821-2/);
  assert.match(controller,/Content-Security-Policy/);
  assert.match(controller,/普通用户或角色管理员/);
});
