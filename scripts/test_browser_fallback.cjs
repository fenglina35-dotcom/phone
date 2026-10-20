// Lets the browser tests run on a machine that is not the Windows development PC.
//
// About ninety tests and check scripts launch Chromium with executablePath set to Edge at its
// fixed Windows location. On any other machine that launch fails (and a test that has already
// opened a local server then never exits). Preloading this file changes nothing in those
// tests: when the requested executable does not exist, Playwright's own Chromium is used
// instead. Where the executable exists (the Windows PC) nothing is altered. Every Chromium
// launched through here is also started with --mute-audio, so tests stay silent.
//
// A few database tests load PGlite from a fixed folder under the Windows user profile. When
// that file does not exist, the PGlite installed on NODE_PATH is used instead.
//
// Usage, from the repository root, with playwright and @electric-sql/pglite installed
// somewhere on NODE_PATH (not inside the repository):
//   NODE_OPTIONS="--require ./scripts/test_browser_fallback.cjs" node --test tests/*.test.mjs
'use strict';
const Module=require('module'),fs=require('fs');
const load=Module._load;
function patch(playwright){
  for(const name of ['chromium']){
    const type=playwright&&playwright[name];
    if(!type||type.__northFallback||typeof type.launch!=='function')continue;
    const launch=type.launch.bind(type);
    type.launch=function(options){
      if(options&&options.executablePath&&!fs.existsSync(options.executablePath)){options={...options};delete options.executablePath;}
      // Headless Chromium still plays audio through the speakers; pages that read replies aloud
      // made the Mac speak at random while other sessions ran tests. Mute every launched browser.
      const args=(options&&options.args)||[];
      if(!args.includes('--mute-audio'))options={...(options||{}),args:[...args,'--mute-audio']};
      return launch(options);
    };
    type.__northFallback=true;
  }
  return playwright;
}
Module._load=function(request){
  if(typeof request==='string'&&/CodexHardwareTests[\\/].*@electric-sql[\\/]pglite[\\/]/.test(request)&&!fs.existsSync(request)){
    const rest=Array.prototype.slice.call(arguments,1);
    return load.apply(this,['@electric-sql/pglite',...rest]);
  }
  const loaded=load.apply(this,arguments);
  return request==='playwright'||request==='playwright-core'?patch(loaded):loaded;
};
