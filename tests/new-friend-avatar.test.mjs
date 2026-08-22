import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = source.indexOf("function friendLineAvatar(");
const end = source.indexOf("function friendDiscoveryProfile", start);
const avatarFn = source.slice(start, end);
const cardStart = source.indexOf("function friendRequestCard(");
const cardEnd = source.indexOf("function renderNewFriends", cardStart);
const cardFn = source.slice(cardStart, cardEnd);

assert.ok(start >= 0 && end > start);
assert.match(avatarFn, /fill="#050506"/);
assert.equal((avatarFn.match(/stroke-width="4"/g) || []).length, 2, "head and shoulder lines should both be slightly thicker");
assert.equal((avatarFn.match(/<circle/g) || []).length, 1, "only the head circle should remain");
assert.equal((avatarFn.match(/<path/g) || []).length, 1, "only the shoulder outline should remain");
assert.doesNotMatch(avatarFn, /linearGradient|url\(#g\)|cx="76"|M31 72/);
assert.doesNotMatch(cardFn, /<i><\/i>/, "friend request cards should not render a status dot");

console.log("new friend avatar tests passed");
