import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The private WKWebView deliberately keeps its native viewport/status-bar
// contract. Shared application markup must remain byte-equivalent to the web
// core so confirmed phone, reply, delivery and notification fixes are not
// silently reverted while staging.
export async function applyPrivatePhoneWebTransforms(outputRoot, entry) {
  const bundledEntry = path.join(outputRoot, entry);
  let privateHtml = await readFile(bundledEntry, 'utf8');
  privateHtml = privateHtml
    .replace(', viewport-fit=cover', '')
    .replace('apple-mobile-web-app-status-bar-style" content="black-translucent"', 'apple-mobile-web-app-status-bar-style" content="black"')
    .replace('apple-mobile-web-app-status-bar-style" content="default"', 'apple-mobile-web-app-status-bar-style" content="black"')
    .replace(/var url='sw\.js\?v=(\d+)&r=[^']+';/, "var url='sw.js?v=$1';")
    .replace(/\/\* v953[^\n]*\*\/[\s\S]*?(?=\/\* 苹果主屏幕 Web App)/, '');
  await writeFile(bundledEntry, privateHtml, 'utf8');
}
