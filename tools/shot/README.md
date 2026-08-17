# tools/shot — автономные скриншот-проверки

Эта папка живёт **внутри репозитория**, чтобы переживать пересоздание песочницы
Arena. Раньше скрипты лежали в `/home/user/shot/` и пропадали между ходами — это
было одной из причин обрыва диалогов.

## Восстановление на свежей песочнице (одна команда)

```bash
cd /home/user/Wonderful-Land-children-s-game-
npm install
cd tools/shot && npm install && node unpack-libs.mjs && cd ../..
```

`unpack-libs.mjs` распаковывает системные библиотеки (`libnspr4.so` и др.) из
`@sparticuz/chromium` в `tools/shot/al2023/lib`. **Без экспорта
`LD_LIBRARY_PATH` на эту папку chromium не запускается.**

## Сборка и съёмка

```bash
# из корня репозитория
npm run build
python3 tools/build_preview.py            # → wonder-meadow-preview.html
cd tools/shot
export LD_LIBRARY_PATH="$PWD/al2023/lib:$LD_LIBRARY_PATH"
export FONTCONFIG_PATH="$PWD/fonts"
node shoot.mjs hedge world                # имена хук-сценариев без #shot-
```

Картинки появляются как `tools/shot/<сценарий>-<tablet|phone>.png`.

## Почему не системный Playwright Chromium

В песочнице:
- `npx playwright install chromium` падает на загрузке бинарника;
- `npx playwright install-deps chromium` падает в apt (нет root и прав на
  блокировку `/var/lib/apt/lists`);
- системного chromium/chrome нет.

Поэтому используется `@sparticuz/chromium` (его бинарник и библиотеки AL2023
идут внутри npm-пакета) + `playwright-core`.

## Важные технические факты (не терять)

- WebGL включается только после удаления флагов `--disable-webgl`,
  `--single-process`, `--disable-gpu` из дефолтных аргументов и добавления
  `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- `build_preview.py` инлайнит JS **как `<script type="module">`**. Убирать
  `type="module"` нельзя: инлайн-модуль выполняется отложенно (после DOM), а
  обычный инлайн-скрипт бежит раньше и Three.js падает на `appendChild`
  (`document.body === null`).
- В песочнице swiftshader ~4–10 fps; скрипт ждёт 7 с после `goto`. Никогда не
  делать вывод «зависло» по одному кадру.
- Хеш-сценарии: `#shot-world|hedge|owl|frog|mole|sq|fire|beaver|pause|gate|
  parent|break|choir|choirnight|portal|travel|l2|l2night|walk|walk2|walk3|
  whedge|wfrog` и `#solo-<зверь>`.
