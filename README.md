# Волшебная полянка 🌳

Детская развивающая 3D-игра для Android (3–6 лет). Офлайн, без рекламы,
без покупок, без сбора данных. Бесплатно.

- 📜 Дизайн-документ: [ГДД.md](ГДД.md)
- 🤝 Правила работы с ИИ: [AI_GUIDE_WONDERMEADOW.md](AI_GUIDE_WONDERMEADOW.md)

## Технологии

Three.js + Vite, упаковка в Android через Capacitor.
APK собирается автоматически в GitHub Actions при каждом пуше в `main`
(см. Actions → последняя успешная сборка → артефакт `wonder-meadow-apk`).
Версия берётся из `version.txt`.

## Локальный запуск (для разработчика)

```bash
npm install
npm run dev
```
