import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateSource=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function sliceBetween(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  assert.notEqual(start,-1,`missing source marker: ${startMarker}`);
  const end=source.indexOf(endMarker,start+startMarker.length);
  assert.notEqual(end,-1,`missing source marker: ${endMarker}`);
  return source.slice(start,end);
}

function relevantFragments(source){
  return {
    render:sliceBetween(source,'function render(){','/* ---------- 主屏幕 ---------- */'),
    apply:sliceBetween(source,'function settingsCategoryApply(){','function settingsTabTap('),
    settings:sliceBetween(source,'function renderSettings(){','function saveSettings(){'),
    save:sliceBetween(source,'function saveSettings(){','function clearPhoneFriendChatsKeepPeople(')
  };
}

const entries=[
  ['private PhoneWeb.bundle/app.js',privateSource,relevantFragments(privateSource)]
];

test('iOS257 settings category filtering is synchronous after the private DOM mount',()=>{
  for(const [label,source,fragment] of entries){
    assert.doesNotMatch(source,/setTimeout\s*\(\s*settingsCategoryApply\s*,\s*0\s*\)/,`${label} must not defer settings filtering to a later task`);

    const mounted=fragment.render.indexOf("app.innerHTML='<div class=\"page'");
    const applied=fragment.render.indexOf("if(c.p==='settings'&&_setCategory)settingsCategoryApply();");
    const hydrated=fragment.render.indexOf('hydrateStoredImageNodes();');
    const sampled=fragment.render.indexOf("northNativePerformanceSample('render-'+c.p");

    assert.ok(mounted>=0,`${label} must mount the rendered page`);
    assert.ok(applied>mounted,`${label} must filter the mounted settings DOM synchronously`);
    assert.ok(hydrated>applied,`${label} must filter settings before stored-image hydration`);
    assert.ok(sampled>hydrated,`${label} must filter settings before render performance sampling`);
    assert.equal((fragment.render.match(/settingsCategoryApply\(\);/g)||[]).length,1,`${label} must apply category visibility exactly once per render`);
  }
});

test('root and private entry keep the shared settings apply and save contracts identical',()=>{
  const root=relevantFragments(publicSource),native=relevantFragments(privateSource);
  const normalize=value=>value.replaceAll('\r\n','\n');
  assert.equal(normalize(native.apply),normalize(root.apply),'settingsCategoryApply() must stay identical across root and private entry');
  assert.equal(normalize(native.save),normalize(root.save),'saveSettings() must stay identical across root and private entry');
});

test('category filtering keeps every hidden settings section and every field read by saveSettings',()=>{
  const expectedSections=[
    'setpage1','set_chat','set_aux','set_search','set_vision','set_tts','set_image',
    'setpage2','set_prefs','set_look','set_media','setpage3'
  ];

  for(const [label,,fragment] of entries){
    for(const id of expectedSections){
      assert.ok(fragment.settings.includes(`id="${id}"`),`${label} must keep hidden settings DOM #${id} mounted`);
    }

    const requiredFieldIds=new Set([
      ...Array.from(fragment.save.matchAll(/\bg\('([^']+)'\)/g),match=>match[1]),
      ...Array.from(fragment.save.matchAll(/\$\('#([^']+)'\)/g),match=>match[1])
    ]);
    assert.ok(requiredFieldIds.size>=35,`${label} saveSettings field audit unexpectedly found too few fields`);
    for(const id of requiredFieldIds){
      assert.ok(fragment.settings.includes(`id="${id}"`),`${label} saveSettings requires mounted field #${id}`);
    }

    assert.match(fragment.apply,/Array\.from\(page\.children\)\.forEach\(el=>\{el\.style\.display=/,`${label} must hide non-current categories with display only`);
    assert.doesNotMatch(fragment.apply,/\.remove\s*\(|removeChild\s*\(|replaceChildren\s*\(/,`${label} must not delete category DOM`);
  }
});
