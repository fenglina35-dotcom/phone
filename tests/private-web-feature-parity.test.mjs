import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const privateRoot=path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle');
const publicShell=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const privateShell=fs.readFileSync(path.join(privateRoot,'小手机.html'),'utf8');

function localAssets(shell,tag,attr){
  const re=new RegExp(`<${tag}[^>]*\\b${attr}="([^"?#]+)(?:[?#][^"]*)?"`,'g');
  return [...shell.matchAll(re)].map(match=>match[1]).filter(value=>!/^https?:|^data:|^blob:/.test(value));
}

const deploymentOnly=new Set(['web-hotfix.js']);

test('private shell contains every public runtime and stylesheet',()=>{
  for(const [tag,attr] of [['script','src'],['link','href']]){
    const publicAssets=localAssets(publicShell,tag,attr).filter(asset=>!deploymentOnly.has(asset));
    const privateAssets=new Set(localAssets(privateShell,tag,attr));
    for(const asset of publicAssets){
      assert.ok(privateAssets.has(asset),`private shell omitted public asset ${asset}`);
      assert.ok(fs.existsSync(path.join(privateRoot,asset)),`private package omitted public file ${asset}`);
    }
  }
});
