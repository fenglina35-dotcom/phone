import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const volume=read('./light-volume062.mjs'),app=read('./app.mjs'),index=read('./index.html');
// Lights stay authored and switchable; only per-pixel loops of converted rough materials are replaced.
assert.match(volume,/l\.visible\?l\.intensity:0/,'volume follows live switches and visibility');
assert.doesNotMatch(volume,/player\.[xyz]|camera\.position|getWorldPosition\(camera/,'volume never depends on the observer position');
for(const block of ['NUM_POINT_LIGHTS','NUM_SPOT_LIGHTS','NUM_RECT_AREA_LIGHTS'])assert.match(volume,new RegExp(block),'replaces '+block+' loop');
assert.match(volume,/if\(at<0\)\{shader\.fragmentShader=fs;return;\}/,'unexpected chunk layout keeps exact shading');
assert.match(volume,/roughness>=\.5&&!\(m\.clearcoat>0\)&&!\(m\.transmission>0\)&&!near\.has\(m\)/,'glossy, clearcoat, transmissive and near-light materials stay exact');
assert.match(volume,/minInterval/,'fading switches regenerate at a bounded rate');
// Integration: generated before drawing, warmed for every room and the mirror target, rebuilt after context loss.
assert.match(app,/lightVolume\?\.update\(\);residency\?\.begin\(time\)/,'volume refreshes before the main render');
assert.match(app,/installLightVolume\(renderer,scene\);lightVolume\.update\(true\);\s*\r?\n?\s*\{mobileRendering\.restore\(\);/,'all rooms visible while compiling converted programs');
assert.match(app,/renderer\.setRenderTarget\(volumeCompileTarget\);await renderer\.compileAsync/,'mirror output variant compiled at boot');
assert.match(app,/lightVolume\?\.invalidate\(\);await renderer\.compileAsync/,'context restore regenerates the volume');
assert.match(app,/revision:62/);assert.match(index,/app\.mjs\?build=062/);
console.log('062 light volume source guards passed (not a device visual or frame-rate acceptance test)');
