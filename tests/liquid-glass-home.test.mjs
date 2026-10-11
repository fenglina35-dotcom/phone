import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const part=app.slice(app.indexOf('/* ===== v1716 液态玻璃'));

test('v1716 liquid glass is baked once per widget and never redrawn while swiping',()=>{
  assert.ok(part.length>1000);
  assert.doesNotMatch(part,/MutationObserver|getImageData|toDataURL|requestAnimationFrame\(lgHomeRefresh/,'DOM 变化不能触发重算，也不能拍背景快照');
  assert.match(part,/sw\.addEventListener\('scroll',lgSwipe,\{passive:true\}\)/,'v1718：翻页时玻璃里的壁纸跟着实时变');
  assert.match(part,/if\(!g\|\|cv\._lgShift===shift&&cv\._lgScale===scale\)return;/,'没变的组件不重画');
  assert.match(part,/final\?1:0\.6/,'滑动中低分辨率、停下后原分辨率');
  assert.match(part,/function lgGeometry\(host,desk\)/);assert.match(part,/closest\('\.apppage'\)/,'位置按组件停好的那一页算，翻页时整页一起滑');
  assert.match(part,/_lg\.cache\.get\(key\)/,'重新渲染直接装回缓存的画布');
  assert.match(part,/webglcontextlost/);assert.match(part,/已经烤好放进组件的画布不受影响/);
  assert.match(part,/\.lg-host\.lg-ready\{backdrop-filter:none!important/,'只有装好画布的组件才去掉原来的玻璃');
});

test('v1716 settings values are clamped, zero is kept, and the private bundle is untouched',()=>{
  const ctx={S:{me:{liquidGlass:{on:true,tone:'white',blur:0,ior:9,thick:-5,disp:'x'}}}};vm.createContext(ctx);
  vm.runInContext(part.match(/const LG_DEFAULTS=[^\n]+/)[0]+'\n'+part.match(/const LG_FIELDS=[^\n]+/)[0]+'\n'+part.match(/function lgCfg\(\)[^\n]+/)[0]+';this.lgCfg=lgCfg;',ctx);
  const cfg=ctx.lgCfg();assert.equal(cfg.blur,0);assert.equal(cfg.ior,2);assert.equal(cfg.thick,4);assert.equal(cfg.disp,0.03);assert.equal(cfg.tone,'white');
  const priv=fs.readFileSync('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js','utf8');
  assert.doesNotMatch(priv,/v1716 液态玻璃/,'先只在网页版试，私人版不动');
});
