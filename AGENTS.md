# la-word — Flashcard Learning App

PWA aplikácia na učenie sa slovíčok pomocou otočných kartičiek.

## Stack
- Vanilla HTML/CSS/JS (žiadny framework)
- localStorage pre ukladanie dát
- Service Worker pre offline režim
- MyMemory API pre automatický preklad

## Struktúra projektu
```
la-word/
├── index.html            # Hlavný HTML súbor
├── manifest.json         # PWA manifest
├── service-worker.js     # Service worker pre offline
├── css/
│   └── style.css         # Všetky štýly
├── js/
│   ├── app.js            # Inicializácia, eventy, routing
│   ├── cards.js          # CRUD operácie s kartami
│   ├── storage.js        # localStorage persistence
│   └── ui.js             # DOM manipulácia, renderovanie
├── plans/                # Implementačné plány
├── AGENTS.md
```

## Konvencie
- Kód v slovenčine/angličtine podľa kontextu (UI text v slovenčine)
- CSS triedy: kebab-case
- JS funkcie: camelCase
- localStorage kľúč: `laword_cards`
- Žiadne externé knižnice — čistý vanilla JS

## Cards dátová štruktúra
```js
{
  id: "timestamp_nanoid",
  front: "slovo",         // predná strana
  hint: "pomôcka",        // voliteľné
  back: "translation",    // zadná strana (preklad)
  color: "#4A90D9",       // farba karty
  createdAt: 1700000000000
}
```
