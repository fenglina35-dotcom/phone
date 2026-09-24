#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""液态玻璃气泡：外轮廓 + 描边环的 clip-path 生成器。

用法：
    python3 scripts/glass_ring_polygon.py            # 打印四条 clip-path
    python3 scripts/glass_ring_polygon.py --check    # 核对三个壳子里的 CSS 是不是这里生成的

为什么要有「环」，见 docs/maintenance/液态玻璃_磨砂加细高光_做法.md。
一句话：白色只要铺满整块形状、又压在 backdrop-filter 下面，就一定会糊成一片白雾。
所以描边层必须被剪成一条真正的环——中间是洞，底下磨砂的身子才露得出来。

环的做法（不依赖 fill-rule，nonzero 就够）：
    外圈正着走一圈 → 回到起点 → 桥到内圈起点 → 内圈【倒着】走一圈 → 回到内圈起点
两条桥完全重合，面积相互抵消，看不见；内圈方向和外圈相反，nonzero 下就是一个洞。

改尺寸只改下面四个常量，然后把打印出来的四条 clip-path 贴回三个壳子：
    小手机.html
    native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html
    native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html
（两个私人壳子必须逐字节相同，有测试卡着。）
"""
import math
import sys
from pathlib import Path

R = 18.0        # 圆角
TW = 7.0        # 尾巴那一条的宽度（气泡身子的左边缘就在这儿）
TH = 10.0       # 尾巴高
INSET = 0.75    # 描边有多细。她说过「描边的高光弄得细一点」，0.75 是她认可的那一版
W, H = 200.0, 40.0   # 只是算偏移用的名义尺寸，真实宽高由 calc(100% - n) 顶掉

# 轮廓：每个点带着「从哪条边量」的标记（L/R、T/B），换算回 calc(100% - n) 才不会错
def _arc(mx, my, pts):
    return [(x, y, mx, my) for x, y in pts]

P = []
# 左上圆角：从左边 (TW,R) 转到 (TW+R,0)
P += _arc('L', 'T', [(TW + R - R * math.cos(math.radians(k * 15)), R - R * math.sin(math.radians(k * 15))) for k in range(7)])
# 右上圆角：从 (W-R,0) 转到 (W,R)
P += _arc('R', 'T', [(R - R * math.sin(math.radians(k * 15)), R - R * math.cos(math.radians(k * 15))) for k in range(7)])
# 右下圆角：从 (W,H-R) 转到 (W-R,H)
P += _arc('R', 'B', [(R - R * math.cos(math.radians(k * 15)), R - R * math.sin(math.radians(k * 15))) for k in range(7)])
# 左下：先到尾巴根，再是尾巴，最后回到左边
P += _arc('L', 'B', [(TW + 2, 0), (4.2, .5), (1.2, 1.5), (2.6, 4.2), (4.6, 6.6), (TW, TH)])


def _fmt(v):
    v = round(v, 2)
    if abs(v) < 0.005:
        return '0px'
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s + 'px'


def _side(v):
    return '100%' if round(v, 2) == 0 else 'calc(100%% - %s)' % _fmt(v)


def _absxy(p):
    x, y, mx, my = p
    return (x if mx == 'L' else W - x, y if my == 'T' else H - y)


def _sym(p, x, y):
    _, _, mx, my = p
    sx = _fmt(x) if mx == 'L' else _side(W - x)
    sy = _fmt(y) if my == 'T' else _side(H - y)
    return sx + ' ' + sy


def _inter(l1, l2):
    x1, y1, x2, y2 = l1
    x3, y3, x4, y4 = l2
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-9:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    if abs(t) > 40:
        return None
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def _offset(pts, d):
    """把多边形整体往里缩 d：每条边沿内法线平移，再和相邻边求交。"""
    n = len(pts)
    a = [_absxy(p) for p in pts]
    area = sum(a[i][0] * a[(i + 1) % n][1] - a[(i + 1) % n][0] * a[i][1] for i in range(n)) / 2.0
    sgn = -1.0 if area < 0 else 1.0   # 屏幕坐标 y 向下，内法线方向靠符号定
    lines = []
    for i in range(n):
        x1, y1 = a[i]
        x2, y2 = a[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1e-9
        nx, ny = sgn * (-dy / L), sgn * (dx / L)
        lines.append((x1 + nx * d, y1 + ny * d, x2 + nx * d, y2 + ny * d))
    out = []
    for i in range(n):
        pt = _inter(lines[(i - 1) % n], lines[i])
        out.append(pt if pt else (lines[i][0], lines[i][1]))
    return out


def _mirror(mirror):
    return [(x, y, ('R' if mx == 'L' else 'L') if mirror else mx, my) for x, y, mx, my in P]


def outline(mirror=False):
    """外轮廓：贴在 .imsg-row.<who> .imsg-b 上，气泡连尾巴是一整块剪出来的。"""
    src = _mirror(mirror)
    return 'polygon(' + ','.join(_sym(p, *_absxy(p)) for p in src) + ')'


def ring(mirror=False):
    """描边环：贴在 .imsg-row.<who> .imsg-b:before 上，白只落在这一条上。"""
    src = _mirror(mirror)
    n = len(src)
    out = [_sym(src[i], *_absxy(src[i])) for i in range(n)]
    off = _offset(src, INSET)
    ins = [_sym(src[i], off[i][0], off[i][1]) for i in range(n)]
    # 外圈 → 回起点 → 桥 → 内圈倒着走 → 回内圈起点；两条桥重合，面积抵消
    pts = out + [out[0], ins[0]] + [ins[n - k] for k in range(1, n)] + [ins[0]]
    return 'polygon(' + ','.join(pts) + ')'


SHELLS = [
    '小手机.html',
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
]
RULES = [
    ('.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:', lambda: outline(False)),
    ('.imsg-row.them .imsg-b:before{clip-path:', lambda: ring(False)),
    ('.imsg-row.me .imsg-b{padding:8px 21px 8px 14px;clip-path:', lambda: outline(True)),
    ('.imsg-row.me .imsg-b:before{clip-path:', lambda: ring(True)),
    # 线下约会的气泡走同一套轮廓和环（v1314 起），所以连小尾巴都和信息页一模一样
    ('.offmsg.them .offbubble{padding:9px 15px 9px 22px;background:var(--offc-them);color:var(--offc-them-ink);clip-path:', lambda: outline(False)),
    ('.offmsg.them .offbubble:before{clip-path:', lambda: ring(False)),
    ('.offmsg.me .offbubble{padding:9px 22px 9px 15px;background:var(--offc-me);color:var(--offc-me-ink);clip-path:', lambda: outline(True)),
    ('.offmsg.me .offbubble:before{clip-path:', lambda: ring(True)),
]


def check(root):
    bad = []
    for name in SHELLS:
        text = (root / name).read_text(encoding='utf-8')
        for prefix, make in RULES:
            want = prefix + make() + ';}'
            if text.count(want) != 1:
                bad.append('%s 里 %s 和脚本生成的对不上' % (name, prefix.split('{')[0]))
    return bad


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    if '--check' in sys.argv:
        bad = check(root)
        print('\n'.join(bad) if bad else '三个壳子里的 clip-path 都是这个脚本生成的 ✅')
        sys.exit(1 if bad else 0)
    print('R=%g 圆角，TW=%g 尾巴宽，TH=%g 尾巴高，INSET=%g 描边粗细\n' % (R, TW, TH, INSET))
    print('THEM_OUT=' + outline(False) + '\n')
    print('THEM_RING=' + ring(False) + '\n')
    print('ME_OUT=' + outline(True) + '\n')
    print('ME_RING=' + ring(True))
