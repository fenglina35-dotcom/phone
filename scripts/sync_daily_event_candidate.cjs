// Mechanical mirror for this shared component only; never copies private app.js.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const from=path.join(root,'daily-event-ledger.js'),to=path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/daily-event-ledger.js');
fs.writeFileSync(to,fs.readFileSync(from));
console.log('Mirrored daily-event-ledger.js only');
