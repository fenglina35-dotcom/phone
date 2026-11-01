#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""发布时把网页、私人、iOS 版本号各加 1（以后每次发布都用这一个，不再按版本新写脚本）。

做法和手工发布时一样：
  1. 从当前文件读出网页 APP_VER、私人 APP_VER、iOS 构建号；
  2. 找到「把版本号升到当前值」的那次提交，只改它当时加进去的那些行；
  3. 那些行里的旧版本号换成新的（普通写法、测试里 1\\.0\\.NNN 的转义写法、(NNN)、= NNN; 都认）；
     版本说明文字只在 APP_VER 那一行里换，不会误改别处（以前开关说明文字被误改过）；
  4. tests/permanent-fix-guard.test.mjs 里 release:"pending" 的条目改成这次的版本；
  5. 核对：Xcode 工程里新的 CURRENT_PROJECT_VERSION / MARKETING_VERSION 处数和上次一样，
     改过的文件里不能再剩旧版本号，否则报错退出（文件已改的部分请自己用 git diff 看）。

用法（在仓库根目录）：
  python3 scripts/bump_version.py --label "一键体检" --dry-run   只看会改哪些，不写文件
  python3 scripts/bump_version.py --label "一键体检"             真的改
  python3 scripts/bump_version.py --label "公开版关联修复" --web-only   只升网页版

改完还要自己做的：native/private-small-phone/XcodeProject/请在Mac编译前先读.md 第一行的版本说明，
以及照常跑全量测试和两遍核心聊天检查。
"""
import argparse
import re
import subprocess
import sys

PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'
PBX = 'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'
GUARD = 'tests/permanent-fix-guard.test.mjs'
SKIP_PREFIX = ('docs/',)
SKIP_FILES = {GUARD, 'native/private-small-phone/XcodeProject/请在Mac编译前先读.md'}


def git(*args):
    return subprocess.run(['git', *args], capture_output=True, text=True, check=True).stdout


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def app_ver(path):
    m = re.search(r"const APP_VER='v(\d+) · ([^']*)'", read(path))
    if not m:
        sys.exit('读不到 ' + path + ' 的 APP_VER')
    return int(m.group(1)), m.group(2)


def ios_build():
    builds = set(re.findall(r'CURRENT_PROJECT_VERSION = (\d+);', read(PBX)))
    if len(builds) != 1:
        sys.exit('Xcode 工程里的构建号不一致：' + ', '.join(sorted(builds)))
    return int(builds.pop())


def template_commit(web):
    sha = git('log', '-1', '--format=%H', '-S', "const APP_VER='v%d " % web, '--', 'app.js').strip()
    if not sha:
        sys.exit('找不到把网页版本升到 v%d 的那次提交：如果刚升过版本号还没提交，请先提交再用（不要连升两次）' % web)
    return sha


def added_lines(sha):
    diff = git('show', sha, '-U0', '--format=')
    files, cur = {}, None
    for line in diff.split('\n'):
        if line.startswith('+++ b/'):
            cur = line[6:]
            files[cur] = set()
        elif line.startswith('+') and not line.startswith('+++') and cur:
            files[cur].add(line[1:])
    return files


def main():
    ap = argparse.ArgumentParser(description='发布时把版本号各加 1')
    ap.add_argument('--label', required=True, help='新的版本说明文字，例如「一键体检」')
    ap.add_argument('--web-only', action='store_true', help='只升网页版（私人版和 iOS 不动）')
    ap.add_argument('--dry-run', action='store_true', help='只看会改哪些，不写文件')
    a = ap.parse_args()

    web, web_label = app_ver('app.js')
    priv, priv_label = app_ver(PRIV)
    ios = ios_build()
    nw, np_, ni = web + 1, (priv if a.web_only else priv + 1), (ios if a.web_only else ios + 1)
    sha = template_commit(web)
    print('当前：网页 v%d / 私人 v%d / iOS %d　→　网页 v%d / 私人 v%d / iOS %d' % (web, priv, ios, nw, np_, ni))
    print('照着这次提交改：' + git('log', '-1', '--format=%h %s', sha).strip())

    def tr(line):
        if 'APP_VER' in line:
            line = line.replace("v%d · %s'" % (web, web_label), "v%d · %s'" % (nw, a.label))
            if not a.web_only:
                line = line.replace("v%d · %s'" % (priv, priv_label), "v%d · %s'" % (np_, a.label))
        line = re.sub(r'(?<!\d)%d(?!\d)' % web, str(nw), line)
        if not a.web_only:
            line = re.sub(r'(?<!\d)%d(?!\d)' % priv, str(np_), line)
            line = line.replace('1.0.%d' % ios, '1.0.%d' % ni).replace('1\\.0\\.%d' % ios, '1\\.0\\.%d' % ni)
            line = re.sub(r'(?<![\d.\\])%d(?!\d)' % ios, str(ni), line)
        return line

    changed, total = {}, 0
    for path, plus in added_lines(sha).items():
        if path.startswith(SKIP_PREFIX) or path in SKIP_FILES:
            continue
        if a.web_only and path.startswith('native/'):
            continue  # 只升网页版时私人版和 iOS 的文件一个都不动
        try:
            text = read(path)
        except FileNotFoundError:
            continue
        out, n = [], 0
        for line in text.split('\n'):
            if line in plus:
                new = tr(line)
                n += new != line
                out.append(new)
            else:
                out.append(line)
        if n:
            changed[path] = ('\n'.join(out), n)
            total += n

    guard = read(GUARD)
    guard_new = guard.replace('release:"pending"', ('release:"web v%d"' % nw) if a.web_only else ('release:"private v%d / web v%d"' % (np_, nw)))
    pending = guard.count('release:"pending"')

    print('会改 %d 个文件、%d 行；修复登记里 %d 条「pending」改成这次的版本' % (len(changed), total, pending))

    # 核对：只看改后的内容
    problems = []
    if not a.web_only:
        pbx_new = changed.get(PBX, (read(PBX), 0))[0]
        old_count = len(re.findall(r'CURRENT_PROJECT_VERSION = %d;|MARKETING_VERSION = 1\.0\.%d;' % (ios, ios), read(PBX)))
        new_count = len(re.findall(r'CURRENT_PROJECT_VERSION = %d;|MARKETING_VERSION = 1\.0\.%d;' % (ni, ni), pbx_new))
        if new_count != old_count:
            problems.append('Xcode 工程里新版本号 %d 处，原来是 %d 处' % (new_count, old_count))
    old_tokens = [re.compile(r"const APP_VER='v%d " % web)]
    if not a.web_only:
        old_tokens += [re.compile(r"const APP_VER='v%d " % priv), re.compile(r'1\\?\.0\\?\.%d(?!\d)' % ios), re.compile(r'CURRENT_PROJECT_VERSION = %d;' % ios)]
    for path, (text, _) in changed.items():
        for pat in old_tokens:
            if pat.search(text):
                problems.append('%s 里还剩旧版本号（%s）' % (path, pat.pattern))
    if problems:
        print('核对没通过，不写文件：')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)

    if a.dry_run:
        for path, (_, n) in sorted(changed.items()):
            print('  %4d 行  %s' % (n, path))
        print('只看不改：没有写任何文件。')
        return
    for path, (text, _) in changed.items():
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
    if pending:
        with open(GUARD, 'w', encoding='utf-8') as f:
            f.write(guard_new)
    print('已改好。还要自己改「请在Mac编译前先读.md」第一行，再跑全量测试和两遍核心聊天检查。')


if __name__ == '__main__':
    main()
