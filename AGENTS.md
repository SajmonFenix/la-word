# la-word — Flashcard Learning App

PWA aplikácia na učenie sa slovíčok pomocou otočných kartičiek.

## Stack
- Vanilla HTML/CSS/JS (žiadny framework)
- IndexedDB pre primárne ukladanie dát
- localStorage ako fallback a záloha
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
│   ├── storage.js        # IndexedDB + localStorage persistence
│   └── ui.js             # DOM manipulácia, vlastný slider, renderovanie
├── docs/superpowers/     # Špecifikácie a plány
├── AGENTS.md
```

## Konvencie
- Kód v slovenčine/angličtine podľa kontextu (UI text v slovenčine)
- CSS triedy: kebab-case
- JS funkcie: camelCase
- localStorage kľúč: `laword_cards`
- IndexedDB databáza: `laword`, store: `cards`
- Žiadne externé knižnice — čistý vanilla JS/CSS

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
