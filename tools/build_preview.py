#!/usr/bin/env python3
"""Собирает ОДИН автономный HTML-файл превью игры из dist/.

Инлайнит JS-бандл, арт (в CSS) и все голосовые mp3 (base64 data URI),
чтобы превью работало в просмотрщике файлов Arena БЕЗ сети и сервера.

Запуск (из корня репозитория):
    npm run build && python3 tools/build_preview.py
Результат:
    wonder-meadow-preview.html в корне репозитория (он в .gitignore).

Кладём скрипт ВНУТРЬ репозитория (а не в /home/user/), потому что песочница
Arena пересоздаётся между ходами/диалогами и стирает всё вне рабочей папки.
"""
import base64
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(REPO, "dist")
OUT = os.path.join(REPO, "wonder-meadow-preview.html")

if not os.path.isdir(DIST):
    print("ERROR: dist/ not found — сначала выполни: npm run build", file=sys.stderr)
    sys.exit(1)

html = open(os.path.join(DIST, "index.html"), encoding="utf-8").read()

# 1) Найти JS-бандл (vite кладёт его как <script type="module" src="/assets/...">)
js_match = re.search(r'<script[^>]+src="([^"]*assets/[^"]+\.js)"', html)
if not js_match:
    print("ERROR: JS bundle not found in dist/index.html", file=sys.stderr)
    sys.exit(1)
js_src = js_match.group(1).lstrip("/")
js_path = os.path.join(DIST, js_src)
if not os.path.isfile(js_path):
    print("ERROR: JS file missing:", js_path, file=sys.stderr)
    sys.exit(1)
js = open(js_path, encoding="utf-8").read()

# 2) Инлайнить ВСЕ mp3 из dist/voice как base64 data URI.
# В коде пути вида 'voice/hedge_hello.mp3' (иногда с ведущим /).
inlined = 0
voice_dir = os.path.join(DIST, "voice")
if os.path.isdir(voice_dir):
    for fn in sorted(os.listdir(voice_dir)):
        if not fn.lower().endswith(".mp3"):
            continue
        data = open(os.path.join(voice_dir, fn), "rb").read()
        b64 = base64.b64encode(data).decode("ascii")
        data_uri = "data:audio/mpeg;base64," + b64
        for pat in (f"'voice/{fn}'", f'"voice/{fn}"', f"'/voice/{fn}'", f'"/voice/{fn}"'):
            if pat in js:
                quote = pat[0]
                js = js.replace(pat, quote + data_uri + quote)
                inlined += 1
                break

# 3) Инлайнить арт (webp/png/jpg), на который ссылается CSS в html.
art_dir = os.path.join(DIST, "art")
if os.path.isdir(art_dir):
    for fn in sorted(os.listdir(art_dir)):
        if not fn.lower().endswith((".webp", ".png", ".jpg", ".jpeg")):
            continue
        data = open(os.path.join(art_dir, fn), "rb").read()
        b64 = base64.b64encode(data).decode("ascii")
        ext = fn.rsplit(".", 1)[-1].lower()
        mime = "image/webp" if ext == "webp" else ("image/png" if ext == "png" else "image/jpeg")
        data_uri = f"data:{mime};base64,{b64}"
        for pat in (f"./art/{fn}", f"/art/{fn}", f"url({data_uri})", ):
            pass
        for pat in (f"./art/{fn}", f"/art/{fn}"):
            if pat in html:
                html = html.replace(pat, data_uri)

# 4) Заменить <script src=...> на инлайн <script type="module">.
# ВАЖНО про type="module": у инлайн-скрипта (без внешнего src) он даёт отложенное
# выполнение (как defer) — скрипт бежит ПОСЛЕ построения DOM. Если убрать module,
# document.body === null в момент выполнения и Three.js падает на appendChild.
# Внешних module-загрузок нет (весь JS встроен), CORS file:// не мешает.
# Строковую замену используем НАМЕРЕННО: re.sub ломается на \-последовательностях
# в минифицированном JS (\w, \d), трактуя их как escape в подстановке.
inline_tag = '<script type="module">\n' + js + "\n</script>"
old_script_tag = js_match.group(0)
if old_script_tag not in html:
    print("ERROR: script tag not found verbatim in html", file=sys.stderr)
    sys.exit(1)
html = html.replace(old_script_tag, inline_tag, 1)

# 5) Подстраховки.
if 'src="./assets' in html or "src='/assets" in html:
    print("WARNING: внешний assets script остался в html!", file=sys.stderr)
if "__APP_VERSION__" in html:
    print("WARNING: __APP_VERSION__ не подставлен!", file=sys.stderr)
if "THREE" not in js:
    print("WARNING: в JS-бандле не найден THREE — сборка могла сломаться", file=sys.stderr)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

size_mb = os.path.getsize(OUT) / (1024 * 1024)
print(f"OK: JS inlined, mp3 inlined={inlined}, output={OUT} ({size_mb:.2f} MB)")
