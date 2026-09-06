#!/usr/bin/env python3
"""
audit-v6-colors.py — v6/index.html 私有 :root + 寫死色的盤點。

🔴 存在的理由：上一輪我用「三位數 hex 正則」去數，把中文註解裡的 PR 編號
（#231 / #148 / #106 / #103）當成顏色，得出灌水的「72 種寫死色」。
這一支把方法寫下來，數字才可重跑、可反駁：
  1. 先剝掉註解（/* */ 與 //），再掃 hex —— PR 編號都住在註解裡
  2. rgba() 一起數 —— 那才是量體（hex 只是冰山一角）
  3. 統計 **用量** 不是宣告：var(--x) 的出現次數；0 = 死 token
"""
import re, sys, math, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V6 = ROOT / 'apps/preview/v6/index.html'
TOK = ROOT / 'apps/preview/tokens.css'
src = V6.read_text()

# ── 1. 剝註解（這一步就是上一輪缺的） ────────────────────────────────
def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', ' ', s, flags=re.S)          # CSS / JS block
    s = re.sub(r'(?m)^\s*//.*$', ' ', s)                   # JS 整行
    s = re.sub(r'(?<![:/])//[^\n"\'<]*$', ' ', s, flags=re.M)  # 行尾 //
    return s

bare = strip_comments(src)

HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
hex_all  = [m.group(0).lower() for m in HEX.finditer(src)]
hex_real = [m.group(0).lower() for m in HEX.finditer(bare)]
dropped  = sorted(set(hex_all) - set(hex_real))
rgba_n   = len(re.findall(r'rgba?\(', bare))

# ── 2. 色彩數學（sRGB → Lab / LCh、WCAG 對比、Brettel-Viénot 色盲） ──
def srgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def relL(rgb):
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    L1, L2 = relL(a), relL(b)
    hi, lo = max(L1, L2), min(L1, L2)
    return (hi + 0.05) / (lo + 0.05)

def lab(rgb):
    r, g, b = (lin(c) for c in rgb)
    X = r*0.4124564 + g*0.3575761 + b*0.1804375
    Y = r*0.2126729 + g*0.7151522 + b*0.0721750
    Z = r*0.0193339 + g*0.1191920 + b*0.9503041
    wx, wy, wz = 0.95047, 1.0, 1.08883
    f = lambda t: t ** (1/3) if t > 216/24389 else (841/108) * t + 4/29
    fx, fy, fz = f(X/wx), f(Y/wy), f(Z/wz)
    return (116*fy - 16, 500*(fx-fy), 200*(fy-fz))

def lch(rgb):
    L, a, b = lab(rgb)
    return (L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360)

def de76(p, q):
    return math.dist(lab(p), lab(q))

# Brettel/Viénot LMS 模擬（與上一輪同一組矩陣，結果才可比）
_M  = ((17.8824,43.5161,4.11935),(3.45565,27.1554,3.86714),(0.0299566,0.184309,1.46709))
_Mi = ((0.080944,-0.130504,0.116721),(-0.0102485,0.0540194,-0.113615),(-0.000365294,-0.00412163,0.693513))
_SIM = {
 'deuter': ((1,0,0),(0.494207,0,1.24827),(0,0,1)),
 'protan': ((0,2.02344,-2.52581),(0,1,0),(0,0,1)),
 'tritan': ((1,0,0),(0,1,0),(-0.395913,0.801109,0)),
}
def _mul(M, v): return tuple(sum(M[i][j]*v[j] for j in range(3)) for i in range(3))
def cvd(rgb, kind):
    v = tuple(lin(c) for c in rgb)
    out = _mul(_Mi, _mul(_SIM[kind], _mul(_M, v)))
    g = lambda c: max(0, min(255, round(255 * (12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4) - 0.055))))
    return tuple(g(c) for c in out)

GROUND = srgb('#020617')   # --n-950 地面
DOCK   = srgb('#181E26')   # --n-900 底座

# ── 3. v6 私有 :root：值 + 用量 ──────────────────────────────────────
root_block = re.search(r':root\{(.*?)\n\}', src, re.S).group(1)
decls = re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', root_block)
rows = []
for name, val in decls:
    val = val.strip()
    if not re.match(r'^(#[0-9a-fA-F]{3,8}|rgba?\()', val):
        continue                                   # 只盤顏色，跳過 easing / 尺寸
    uses = len(re.findall(re.escape(f'var({name})'), bare))
    rows.append((name, val, uses))

# tokens.css 的語義色，用來查「這個值是不是已經有主人」
tok = TOK.read_text()
owners = {n: v.strip() for n, v in re.findall(r'(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;', tok)}

print('═' * 74)
print('① 掃描方法的自我修正')
print('═' * 74)
print(f'  hex（含註解，上一輪用的方法）  : {len(set(hex_all))} 種 / {len(hex_all)} 處')
print(f'  hex（剝掉註解，正確）          : {len(set(hex_real))} 種 / {len(hex_real)} 處')
print(f'  被誤算成顏色的註解片段          : {dropped}')
print(f'  🔴 rgba()／rgb() 字面           : {rgba_n} 處  ← 真正的量體')

print()
print('═' * 74)
print('② v6 私有 :root 的顏色 token：值 · 用量 · 誰已經擁有這個值')
print('═' * 74)
print(f'{"token":<16}{"值":<26}{"用量":>5}  對地面   對底座  同值的主人')
for name, val, uses in rows:
    if val.startswith('#'):
        rgb = srgb(val)
        cg, cd = f'{contrast(rgb, GROUND):5.2f}', f'{contrast(rgb, DOCK):5.2f}'
        same = [k for k, v in owners.items() if srgb(v) == rgb]
    else:
        cg = cd = '  —  '
        same = []
    flag = ' 💀死' if uses == 0 else ''
    print(f'{name:<16}{val:<26}{uses:>5}{flag}  {cg}   {cd}  {",".join(same) or "-"}')

print()
print('═' * 74)
print('③ 六個模板的身分色 —— 它有自己的色域嗎')
print('═' * 74)
TEMPLATES = re.findall(r"(\w+):\s*\{name:'([^']+)'.*?color:'(#[0-9A-Fa-f]{6})'", src)
for tid, nm, col in TEMPLATES:
    rgb = srgb(col)
    same = [k for k, v in owners.items() if srgb(v) == rgb]
    L, C, H = lch(rgb)
    print(f'  {nm:<18}{col}  L*{L:5.1f} h{H:6.1f}°  地面{contrast(rgb,GROUND):5.2f}  '
          f'底座{contrast(rgb,DOCK):5.2f}  ={",".join(same) or "自己的值"}')

print()
print('═' * 74)
print('④ 暖色弧：五個主人，跨多少度')
print('═' * 74)
warm = {'error': '#FF3B30', '--sns(v6)': '#FF6B35', 'zone-strain': '#C2703D',
        'amber-400': '#FFA028', 'warning': '#F5A623', 'gold-secured': '#FFD46E'}
items = sorted(((n, v, lch(srgb(v))) for n, v in warm.items()), key=lambda x: x[2][2])
for n, v, (L, C, H) in items:
    print(f'  {n:<14}{v}  h{H:6.1f}°  L*{L:5.1f}')
print(f'  → 弧寬 {items[-1][2][2] - items[0][2][2]:.1f}°，{len(items)} 個主人')

print()
print('═' * 74)
print('⑤ 色盲下最近的鄰居（只驗承載語義的那一階）')
print('═' * 74)
sem = {'cyan-400': '#22D3EE', 'zone-clear': '#00B4D8', 'zone-neutral': '#64748B',
       'zone-strain': '#C2703D', 'amber-400': '#FFA028', 'success': '#34C759',
       'error': '#FF3B30', 'warning': '#F5A623', 'gold': '#FFD46E'}
names = list(sem)
for kind in ('deuter', 'protan', 'tritan'):
    worst = None
    for i in range(len(names)):
        for j in range(i+1, len(names)):
            a, b = srgb(sem[names[i]]), srgb(sem[names[j]])
            d = de76(cvd(a, kind), cvd(b, kind))
            if worst is None or d < worst[0]:
                worst = (d, names[i], names[j], de76(a, b))
    print(f'  {kind:<8} 最近的一組：{worst[1]} × {worst[2]}  ΔE {worst[0]:5.1f}（正常視覺 {worst[3]:5.1f}）')
