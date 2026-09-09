import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/HomeKitClimateBridge.swift',import.meta.url),'utf8');
test('HomeKit linkedServices optional is unwrapped before iteration (Xcode screenshot regression)',()=>{
 assert.match(source,/for linked in target\.service\.linkedServices\s*\?\?\s*\[\]\s*\{/);
 assert.doesNotMatch(source,/for\s+\w+\s+in\s+\S+\.linkedServices\s*\{/);
 assert.doesNotMatch(source,/linkedServices!/,'do not force unwrap a legitimate nil property');
});
test('direct control remains first; unavailable linked services fall through to nil',()=>{
 const part=source.slice(source.indexOf('private func controlCharacteristic('),source.indexOf('private func modernModeName('));
 assert(part.indexOf('if let direct')<part.indexOf('for linked'));
 assert.match(part,/characteristic\(type: type, in: linked\)/);
 assert.match(part,/return nil\s*\}/);
});
