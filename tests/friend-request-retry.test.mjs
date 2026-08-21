import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /const FRIEND_REQ_DELAYS=\[10000,20000,30000\]/);
assert.match(source, /function friendRetryReset\(c,now\)/);
assert.match(source, /function friendRetryAfterIgnore\(c,attempt,now\)/);
assert.match(source, /function friendRequestSweep\(\)/);
assert.match(source, /setInterval\(friendRequestSweep,5000\)/);
assert.doesNotMatch(source, /setInterval\(friendRequestSweep,1000\)/);
assert.match(source, /if\(isLover\(c\)\)\{friendRetryReset\(c\)/);
assert.match(source, /function rejectFriendRequestRecord\(rid\)[\s\S]*?friendRetryAfterIgnore\(c,r\.attempt,Date\.now\(\)\)/);
assert.match(source, /if\(\(\+st\.attempt\|\|0\)>=3\)return/);
assert.doesNotMatch(source, /8000\+Math\.random\(\)\*9000/);

const helperStart = source.indexOf("const FRIEND_REQ_DELAYS=");
const helperEnd = source.indexOf("function friendRequestSweep()", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const helperSandbox = {};
vm.runInNewContext(
  source.slice(helperStart, helperEnd) +
    ";const c={};" +
    "let st=friendRetryReset(c,1000);globalThis.first={attempt:st.attempt,nextAt:st.nextAt};" +
    "st.attempt=1;st=friendRetryAfterIgnore(c,1,12000);globalThis.second={attempt:st.attempt,nextAt:st.nextAt};" +
    "st.attempt=2;st=friendRetryAfterIgnore(c,2,33000);globalThis.third={attempt:st.attempt,nextAt:st.nextAt};" +
    "st.attempt=3;st=friendRetryAfterIgnore(c,3,64000);globalThis.done={attempt:st.attempt,nextAt:st.nextAt};",
  helperSandbox,
);
assert.deepEqual({ ...helperSandbox.first }, { attempt: 0, nextAt: 11000 });
assert.deepEqual({ ...helperSandbox.second }, { attempt: 1, nextAt: 32000 });
assert.deepEqual({ ...helperSandbox.third }, { attempt: 2, nextAt: 63000 });
assert.deepEqual({ ...helperSandbox.done }, { attempt: 3, nextAt: 0 });

const sweepStart = source.indexOf("function friendRequestSweep()");
const sweepEnd = source.indexOf("setInterval(friendRequestSweep", sweepStart);
assert.ok(sweepStart >= 0 && sweepEnd > sweepStart);
let sweepSaveCalls = 0;
const sweepCreateCalls = [];
const sweepSandbox = {
  S: {
    contacts: [{ id: "c1", _blk: { main: true }, _friendReqRetry: { attempt: 0, nextAt: 500 } }],
    friendRequests: [],
  },
  Date: { now: () => 1000 },
  save() {
    sweepSaveCalls += 1;
  },
  createFriendRequest(id) {
    sweepCreateCalls.push(id);
  },
  wxNearbySweep() {},
};
vm.runInNewContext(
  source.slice(helperStart, helperEnd) +
    source.slice(sweepStart, sweepEnd) +
    ";friendRequestSweep();",
  sweepSandbox,
);
assert.deepEqual(sweepCreateCalls, ["c1"]);
assert.equal(sweepSandbox.S.contacts[0]._friendReqRetry.nextAt, 0);
assert.equal(sweepSaveCalls, 1);
assert.match(source, /async function createFriendRequest\(id\)\{const c=getC\(id\);if\(!friendMainBlocked\(c\)\)return/);
assert.match(source, /function rejectFriendRequestRecord\(rid\)[\s\S]*?if\(r\.kind==='readd'&&c\)\{[\s\S]*?if\(friendMainBlocked\(c\)\)friendRetryAfterIgnore/);
assert.match(source, /function acceptFriend\(rid\)[\s\S]*?friendMainUnblock\(c\)/);

const accountSandbox = {
  active: "alt_1",
  isMain() {
    return globalThis.active === "main";
  },
};
vm.runInNewContext(
  source.slice(source.indexOf("function friendMainBlocked"), source.indexOf("function friendRequestSweep")) +
    ";const c={blocked:false,_blk:{main:true,alt_1:false}};" +
    "globalThis.before=friendMainBlocked(c);" +
    "friendMainUnblock(c);" +
    "globalThis.after={main:c._blk.main,active:c.blocked};",
  accountSandbox,
);
assert.equal(accountSandbox.before, true);
assert.deepEqual({ ...accountSandbox.after }, { main: false, active: false });

console.log("friend request retry tests passed");
