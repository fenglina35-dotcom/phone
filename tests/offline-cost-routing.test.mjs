import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(source, /function offlineHistoryMessages\(o,limit,opt\)[\s\S]*?return out\.slice\(-Math\.max\(1,limit\|0\)\)/);
assert.match(source, /text:text\.slice\(0,320\)/);
assert.match(source, /function offlinePickRelevant\(rows,query,recent,max,textOf\)/);
assert.match(source, /filter\(x=>x&&x\.text&&!x\.offlineId\)/);
assert.match(source, /offlinePickRelevant\(o\.memory\|\|\[\],query,3,6,offMemText\)/);
assert.match(source, /function offlineRepairMessages\(c,o,turn,candidate,repair\)[\s\S]*?offlineHistoryMessages\(o,10,\{deferCurrent:true\}\)/);
assert.match(source, /_offAudit=life\?null:roleInterceptDiagnosticTurn\(c,'offline',null,'单次约会'\)/);
assert.match(source, /auditOpt=\(opt,stage\)=>Object\.assign\(\{\},opt,\{roleInterceptAudit:_offAudit,roleInterceptStage:stage\}\)/);
assert.match(source, /rawReply=await chatAPI\(req,auditOpt\(\{aux:false,max:replyMax,temp:\.75\},'单次约会主候选'\)\);let r=roleVisibleEnvelopeText\(rawReply\)/);
assert.match(source, /chatAPI\(offlineRepairMessages\(c,o,turn,r,offlineRoleRepairPrompt\(c,r\)\),auditOpt\(\{aux:true,max:replyMax,temp:\.72\},'单次约会格式纠正候选'\)\)/);
assert.match(source, /offlineRepeatRepairNote\(c,repeats\)[\s\S]{0,220}auditOpt\(\{aux:true,max:replyMax,temp:\.78\},'单次约会复读纠正候选'\)/);
assert.match(source, /roleInterceptDiagnosticTurnSelect\(_offAudit,r\)/);
assert.match(source, /finally\{[\s\S]{0,500}roleInterceptDiagnosticTurnFinish\(_offAudit,_offAuditFinal,\{delivered:_offAuditDelivered\|\|_offAuditActionHandled,partial:_offAuditPartial\}\)/);
assert.doesNotMatch(source, /roleInterceptDiagnosticOnlyHandled\(_offAuditFinal\)/, 'single-date delivery must use actual action results instead of tag-shaped syntax');
assert.match(source, /function offlineReplyBudget\(input\)[\s\S]*?700[\s\S]*?650[\s\S]*?600/);
assert.match(source, /单次约会保留原规则：正常回复用主模型、纠错优先副模型/);

console.log('offline date cost routing tests passed');
