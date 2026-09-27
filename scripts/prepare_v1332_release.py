from pathlib import Path
import re
root=Path('.')
bundle=Path('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle')
web=['app.js','index.html','小手机.html','repair.html','sw.js','web-hotfix.js']
private=[bundle/x for x in ['app.js','index.html','小手机.html','repair.html','web-hotfix.js']]
for p in [Path(x) for x in web]+private:
 s=p.read_text(encoding='utf-8'); old,new=('1331','1333') if p in private else ('1330','1332')
 s=re.sub(r'(?<!\d)'+old+r'(?!\d)',new,s).replace('delivery-context-1','license-relay-1')
 if p.name=='app.js': s=s.replace('外卖上下文与偏好记忆修复','邀请码网络兼容与原后台登记')
 p.write_text(s,encoding='utf-8',newline='\n')
base=Path('native/private-small-phone/XcodeProject')
for p in [base/'PhoneCompanionTest/LocalPhoneWebView.swift',base/'PhoneCompanionTest/PhoneNativeBridge.swift',base/'PhoneCompanionTest.xcodeproj/project.pbxproj',base/'请在Mac编译前先读.md']:
 s=p.read_text(encoding='utf-8').replace('1.0.399','1.0.400').replace('(399)','(400)').replace('CURRENT_PROJECT_VERSION = 399','CURRENT_PROJECT_VERSION = 400').replace('iOS399','iOS400')
 if p.suffix=='.md':
  s=s.replace('v1330','v1332').replace('v1331','v1333').replace('外卖上下文与偏好记忆修复','邀请码网络兼容与原后台登记')
  s+='\n本轮网页授权通过免费固定代理接回原授权项目，用户编号、邀请码与管理员数据库保持一致。私人 file 原生请求链保持原地址；共享浏览器入口带同等代理能力。OPPO 新入口健康检查真机通过，正式核销及管理员列表仍需用户实际激活验收。Mac编译、签名和iPhone实机未验证。\n'
 p.write_text(s,encoding='utf-8',newline='\n')
for p in Path('tests').glob('*.test.mjs'):
 if p.name=='permanent-fix-guard.test.mjs': continue
 s=p.read_text(encoding='utf-8'); n=re.sub(r'(?<!\d)1330(?!\d)','1332',s);n=re.sub(r'(?<!\d)1331(?!\d)','1333',n)
 n=n.replace('delivery-context-1','license-relay-1').replace('v1332 · 外卖上下文与偏好记忆修复','v1332 · 邀请码网络兼容与原后台登记').replace('v1333 · 外卖上下文与偏好记忆修复','v1333 · 邀请码网络兼容与原后台登记')
 for a,b in [('CURRENT_PROJECT_VERSION = 399','CURRENT_PROJECT_VERSION = 400'),('1.0.399','1.0.400'),('1\\.0\\.399','1\\.0\\.400'),('\\(399\\)','\\(400\\)'),('iOS399','iOS400')]:n=n.replace(a,b)
 if n!=s:p.write_text(n,encoding='utf-8',newline='\n')
p=Path('scripts/package_private_v1331_ios399.py');s=p.read_text(encoding='utf-8')
s=re.sub(r'(?<!\d)1331(?!\d)','1333',s);s=re.sub(r'(?<!\d)1330(?!\d)','1332',s);s=re.sub(r'(?<!\d)399(?!\d)','400',s)
s=s.replace('2c90caf3d66c926267d3cf69292071d182a6bbe5','84d63859f44c070f707242fba6897baa09cf4024').replace('affected-user-invitation-network-failure-not-reproduced','oppo-health-verified-live-activation-and-admin-row-pending')
s=s.replace('    app = text(files[BUNDLE + "app.js"])','    license_gate = text(files[BUNDLE + "license-gate.js"])\n    assert "https://license.smallphoneapp.com" in license_gate\n    assert "function browserLicenseBase(endpoint)" in license_gate\n    app = text(files[BUNDLE + "app.js"])')
s=s.replace('"preserved":[','"preserved":["license-relay-same-backend-admin-identity","activation-before-optional-friend-registration",')
Path('scripts/package_private_v1333_ios400.py').write_text(s,encoding='utf-8',newline='\n')
print('v1332 / v1333 / iOS400 prepared')
