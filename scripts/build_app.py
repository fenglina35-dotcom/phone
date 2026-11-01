#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""app.js 的源码在 src/app/ 里，两版（网页 app.js、私人 PhoneWeb.bundle/app.js）都由它拼出来。

为什么：两个 app.js 有 97% 一模一样，以前每次修改都要在两个文件里各写一遍，还容易漏改一边。
现在两版相同的代码只存一份；两版不同的地方在同一个小文件里并排写着：

    //@@ web
    （只给网页版的行）
    //@@ private
    （只给私人版的行）
    //@@ end

用法（在仓库根目录）：
  python3 scripts/build_app.py            按 src/app 拼出两个 app.js（改完小文件后运行）
  python3 scripts/build_app.py --check    只核对：两个 app.js 是否和 src/app 拼出来的一字节不差（测试会跑这个）
  python3 scripts/build_app.py --import   反过来：有人直接改了 app.js 时，用两个 app.js 重新生成 src/app

手机和网页实际加载的仍然是那两个 app.js，加载方式、安装包、网页缓存都不变。
"""
import argparse
import difflib
import json
import os
import re
import sys

WEB = 'app.js'
PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'
SRC = 'src/app'
MANIFEST = os.path.join(SRC, 'manifest.json')
M_WEB, M_PRIV, M_END = '//@@ web\n', '//@@ private\n', '//@@ end\n'
CHUNK_LINES = 500
TOP = re.compile(r'^(?:async\s+)?function\s+|^(?:const|let|var)\s+[A-Za-z_$]|^/\*')
NAME = re.compile(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', re.M)


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def build():
    """返回 (网页 app.js 文本, 私人 app.js 文本)。"""
    man = json.loads(read(MANIFEST))
    out = {'web': [], 'private': []}
    for name in man['files']:
        state = 'both'
        for n, line in enumerate(read(os.path.join(SRC, name)).splitlines(keepends=True), 1):
            if line == M_WEB:
                state = 'web'
            elif line == M_PRIV:
                state = 'private'
            elif line == M_END:
                state = 'both'
            elif state == 'both':
                out['web'].append(line)
                out['private'].append(line)
            else:
                out[state].append(line)
        if state != 'both':
            sys.exit('%s 里有没收尾的 //@@ %s（少了 //@@ end）' % (name, state))
    return ''.join(out['web']), ''.join(out['private'])


def split():
    """用现在的两个 app.js 生成 src/app（--import）。"""
    w, p = read(WEB), read(PRIV)
    for label, text in (('网页', w), ('私人', p)):
        if not text.endswith('\n'):
            sys.exit(label + ' app.js 最后没有换行，先补上再导入')
        for marker in (M_WEB, M_PRIV, M_END):
            if marker in text.splitlines(keepends=True):
                sys.exit(label + ' app.js 里有一行正好是 ' + marker.strip() + '，和分隔标记冲突')
    wl, pl = w.splitlines(keepends=True), p.splitlines(keepends=True)
    unified = []  # (行, 是否两版共用)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wl, pl, autojunk=False).get_opcodes():
        if tag == 'equal':
            unified += [(x, True) for x in wl[i1:i2]]
            continue
        block = []
        if i2 > i1:
            block += [M_WEB] + wl[i1:i2]
        if j2 > j1:
            block += [M_PRIV] + pl[j1:j2]
        block += [M_END]
        unified += [(x, False) for x in block]
    # 按大约 500 行一段切开，只在两版共用、而且是顶层函数/变量/注释开头的地方切
    chunks, cur = [], []
    for line, shared in unified:
        if cur and shared and len(cur) >= CHUNK_LINES and TOP.match(line):
            chunks.append(cur)
            cur = []
        cur.append(line)
    if cur:
        chunks.append(cur)
    if os.path.isdir(SRC):
        for old in os.listdir(SRC):
            if old.endswith('.js') or old == 'manifest.json':
                os.remove(os.path.join(SRC, old))
    names = []
    for i, chunk in enumerate(chunks, 1):
        text = ''.join(chunk)
        m = NAME.search(text)
        name = '%03d-%s.js' % (i, m.group(1) if m else 'part')
        names.append(name)
        write(os.path.join(SRC, name), text)
    write(MANIFEST, json.dumps({'note': '按这个顺序拼出两个 app.js；改代码请改这些小文件，再运行 python3 scripts/build_app.py', 'files': names}, ensure_ascii=False, indent=1) + '\n')
    return len(names)


def first_diff(a, b):
    al, bl = a.splitlines(), b.splitlines()
    for i, (x, y) in enumerate(zip(al, bl), 1):
        if x != y:
            return i
    return min(len(al), len(bl)) + 1


def main():
    ap = argparse.ArgumentParser(description='src/app 和两个 app.js 互相生成')
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--check', action='store_true', help='只核对，不写文件')
    g.add_argument('--import', dest='do_import', action='store_true', help='用两个 app.js 重新生成 src/app')
    a = ap.parse_args()
    if a.do_import:
        n = split()
        w, p = build()
        if w != read(WEB) or p != read(PRIV):
            sys.exit('导入后拼回去和原文件不一样，src/app 不能用（请把这个情况告诉维护的人）')
        print('已从两个 app.js 生成 src/app：%d 个小文件，拼回去一字节不差。' % n)
        return
    if not os.path.exists(MANIFEST):
        sys.exit('还没有 src/app，先运行 python3 scripts/build_app.py --import')
    w, p = build()
    bad = [(label, path, text) for label, path, text in (('网页', WEB, w), ('私人', PRIV, p)) if read(path) != text]
    if a.check:
        if bad:
            for label, path, text in bad:
                print('%s app.js 和 src/app 拼出来的不一样（第 %d 行起）：%s' % (label, first_diff(read(path), text), path))
            print('改代码请改 src/app 下的小文件，再运行 python3 scripts/build_app.py；')
            print('如果是故意直接改了 app.js，运行 python3 scripts/build_app.py --import 把改动收回 src/app。')
            sys.exit(1)
        print('两个 app.js 和 src/app 一致。')
        return
    for label, path, text in bad:
        write(path, text)
        print('已更新' + label + ' app.js')
    if not bad:
        print('两个 app.js 本来就和 src/app 一致，没有改动。')


if __name__ == '__main__':
    main()
