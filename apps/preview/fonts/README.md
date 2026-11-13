# apps/preview/fonts

自架的 Geist / Geist Mono（SIL Open Font License 1.1，全文見 `OFL.txt`）。
只含拉丁字集；中文照舊落到系統字。為什麼自架、為什麼改度量，見 `../tokens.css` 的 `@font-face` 註解。

| 檔案 | 上游 |
|------|------|
| `geist-latin-wght-normal.woff2` | `@fontsource-variable/geist@5.3.0` → `files/geist-latin-wght-normal.woff2` |
| `geist-mono-latin-wght-normal.woff2` | `@fontsource-variable/geist-mono@5.3.0` → `files/geist-mono-latin-wght-normal.woff2` |

## 這兩個檔不是上游原檔

垂直度量改成 SF Pro 的行框（字形一個點都沒動）：

| 欄位 | 上游 | 這裡 |
|------|------|------|
| `hhea.ascent` / `OS/2.sTypoAscender` | 1005 | 952 |
| `hhea.descent` / `OS/2.sTypoDescender` | −295 | −241 |
| `hhea.lineGap` / `OS/2.sTypoLineGap` | 0 | 0 |

## 換版時重做

```bash
pip install fonttools brotli
npm pack @fontsource-variable/geist @fontsource-variable/geist-mono   # 解開取 files/*-latin-wght-normal.woff2
python3 - <<'PY'
from fontTools.ttLib import TTFont
for src, dst in [("<上游>/geist-latin-wght-normal.woff2", "geist-latin-wght-normal.woff2"),
                 ("<上游>/geist-mono-latin-wght-normal.woff2", "geist-mono-latin-wght-normal.woff2")]:
    t = TTFont(src); h, o = t["hhea"], t["OS/2"]
    h.ascent = o.sTypoAscender = 952
    h.descent = o.sTypoDescender = -241
    h.lineGap = o.sTypoLineGap = 0
    t.flavor = "woff2"; t.save(dst)
PY
node scripts/preview-datum.mjs && node scripts/preview-today-layout.mjs
```
