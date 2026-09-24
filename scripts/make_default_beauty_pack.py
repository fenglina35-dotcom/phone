#!/usr/bin/env python3
"""把一份导出的「小手机美化包」变成内置的默认美化包。

用法：
    python3 scripts/make_default_beauty_pack.py North美化包_2026-09-24.json

会写出 assets/default-beauty-pack.js（以及私人 App 里的同一份），
内容是 window.__NORTH_DEFAULT_BEAUTY__ = {...};
第一次打开小手机、而且一点美化都没动过的人会自动套上这一套。

故意只留「看得见的那部分」：壁纸、锁屏、通话背景、App 图标、
组件外观和照片、微信主题、颜色。凡是别人的数据一律不带：
真人好友备注、手机号归属地、角色头像、联系人和群。
"""
import json, sys, io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, 'native', 'private-small-phone', 'XcodeProject',
                      'PhoneCompanionTest', 'PhoneWeb.bundle')

# 只有这些会被带进默认包，和 app.js 里的 BEAUTY_ME_KEYS 一致，
# 但去掉了 status / place 这种「当时的状态」，默认包不该替新人决定这些。
KEEP_ME = ['avatar', 'theme', 'wxTheme', 'uiMaterial', 'appIconPack', 'homeClockColor',
           'homeDashboard', 'homeSweetie', 'homeSecondPage', 'glassWidgetAppearances',
           'homeVinylColor', '_glassAppearanceSchema', 'homeBg', 'lockBg', 'callBg',
           'momentCover', 'appIcons', 'appIconTone', 'appTextTone',
           'wColor', 'wCardColor', 'wOpacity', 'petColor', 'wPic', 'homeAvMe', 'homeAvTa']

# 这些块一律不带：都是具体某个人的数据，不是美化
DROP_TOP = ['phoneFriend', 'phoneapp', 'contacts', 'groups', 'music', 'beautyArchive']


def build(src_path):
    with io.open(src_path, encoding='utf-8') as f:
        pack = json.load(f)
    if pack.get('type') != 'north-beauty-pack':
        raise SystemExit('这不是小手机美化包（type 不是 north-beauty-pack）')
    me_src = pack.get('me') or {}
    me = {}
    for k in KEEP_ME:
        v = me_src.get(k)
        if v is None or v == '':
            continue
        me[k] = v
    if not me:
        raise SystemExit('这份美化包里没有任何可用的外观字段')
    out = {
        'type': 'north-beauty-pack',
        'ver': 1,
        'name': 'North 默认美化',
        'appVer': pack.get('appVer', ''),
        'exportedAt': pack.get('exportedAt', ''),
        'me': me,
    }
    for k in DROP_TOP:
        assert k not in out, k
    return out


def write(out):
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    # </script> 不能原样出现在内联或外链脚本里被误当成结束标签
    body = body.replace('</', '<\\/')
    text = ('/* 小手机默认美化包：第一次打开、且一点都没改过的手机才会套上。\n'
            '   由 scripts/make_default_beauty_pack.py 生成，不要手改。 */\n'
            'window.__NORTH_DEFAULT_BEAUTY__=' + body + ';\n')
    paths = [os.path.join(ROOT, 'assets', 'default-beauty-pack.js'),
             os.path.join(BUNDLE, 'assets', 'default-beauty-pack.js')]
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with io.open(p, 'w', encoding='utf-8') as f:
            f.write(text)
    return paths, len(text.encode('utf-8'))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('用法：make_default_beauty_pack.py <导出的美化包.json>')
    out = build(sys.argv[1])
    paths, size = write(out)
    imgs = len(re.findall(r'data:image/', json.dumps(out)))
    print(json.dumps({'keys': sorted(out['me'].keys()), 'images': imgs,
                      'bytes': size, 'files': paths}, ensure_ascii=False, indent=2))
