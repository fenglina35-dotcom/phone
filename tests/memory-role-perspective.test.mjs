import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundled = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0, quote = '', escape = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('role-authored memories keep the role as first-person and preserve the role name for the user', () => {
  const context = vm.createContext({ S:{me:{name:'小狗'}}, String });
  vm.runInContext(`${functionSource(app, 'roleMemoryPerspectiveText')}this.normalize=roleMemoryPerspectiveText;`, context);
  assert.equal(
    context.normalize({name:'North',remark:'North'}, '小狗要求North把承诺记进记忆里，North当面写好给她看了。'),
    '小狗要求我把承诺记进记忆里，我当面写好给她看了。'
  );
  assert.equal(context.normalize({name:'North',remark:'先生'}, '小狗要求我不要重复，让我记住这句话。'), '小狗要求我不要重复，让我记住这句话。');
});

test('model memory tags use role-perspective storage while manual user notes keep the old path', () => {
  assert.match(functionSource(app, 'rememberForChar'), /rolePerspective/);
  assert.match(functionSource(app, 'offlineApplyMemoryTags'), /rolePerspective:true/);
  assert.match(app, /rememberFromConversation\(c,mm\[1\],_userText,content,\{rolePerspective:true\}\)/);
  assert.match(app, /rememberFromConversation\(c,tx,\(_luc&&msgToText\(_luc\)\)\|\|'',content,\{rolePerspective:true\}\)/);
  assert.match(functionSource(app, 'offlineRememberExplicitRequest'), /rememberFromConversation\(c,v,text,''\)/);
  assert.equal(functionSource(app, 'roleMemoryPerspectiveText'), functionSource(bundled, 'roleMemoryPerspectiveText'));
});
