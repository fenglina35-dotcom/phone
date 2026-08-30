import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'vendor');
const read=name=>fs.readFileSync(path.join(vendor,name),'utf8');
const stripModuleSyntax=source=>source
  .replace(/^import\s+.*;\r?\n/gm,'')
  .replace(/^export\s+\{.*\};\r?\n?/gm,'')
  .replace(/^\/\/# sourceMappingURL=.*\r?\n?/gm,'');

const runtime=stripModuleSyntax(read('rolldown-runtime-w6R9maHv.mjs'));
const boxes=stripModuleSyntax(read('styp-9TIZZDLN.mjs'));
const all=stripModuleSyntax(read('mp4box.all.mjs'));
const output=`/* Generated from the vendored MP4Box modules. Do not edit by hand. */\n(function(global){\n'use strict';\n${runtime}\n${boxes}\n${all}\nglobal.NorthMP4Box=Object.freeze({createFile:createFile});\n})(typeof globalThis!=='undefined'?globalThis:window);\n`;

const outputs=[
  path.join(vendor,'mp4box.all.js'),
  path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','vendor','mp4box.all.js')
];
for(const target of outputs){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,output);
}
