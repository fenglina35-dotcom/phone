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

test('temperature control and capability metadata use linked HomeKit services',()=>{
 assert.match(source,/\("currentTemperature", controlCharacteristic\(type: HMCharacteristicTypeCurrentTemperature, in: target\)\)/);
 assert.match(source,/\("targetTemperature", controlCharacteristic\(type: HMCharacteristicTypeTargetTemperature, in: target\)\)/);
 assert.match(source,/HMCharacteristicTypeCoolingThreshold/);
 assert.match(source,/HMCharacteristicTypeHeatingThreshold/);
 assert.match(source,/let targetTemperature = temperatureCharacteristic\(in: target\)/);
 assert.match(source,/let temperature = temperatureCharacteristic\(in: target, preferredMode:/);
});
test('mode choices come from HomeKit metadata and fan readback is exact enough to reject 99 as 100',()=>{
 assert.match(source,/metadata\?\.validValues/);
 assert.match(source,/supportedModeNames/);
 assert.doesNotMatch(source,/state\["supportedModes"\] = \["auto", "heat", "cool"\]/);
 assert.doesNotMatch(source,/case "fanSpeed":[^]*?<= 1/);
 assert.match(source,/ACN1-AIR/);
});
