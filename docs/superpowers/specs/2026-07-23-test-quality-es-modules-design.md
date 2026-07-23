# Testy, kvalita kódu a ES moduly

## Cieľ

Zaviesť jeden štandardný testovací príkaz, rozšíriť regresné pokrytie a
rozdeliť veľký `js/app.js` na malé natívne ES moduly. Aplikácia zostane bez
frameworku a bez externých runtime knižníc.

Táto etapa nemení vzhľad ani používateľské správanie. Nové učebné a organizačné
funkcie patria do nasledujúcej etapy.

## Základné rozhodnutia

- Browser bude používať natívne `type="module"` a `import`/`export`.
- Testy budú používať vstavané `node:test` a `node:assert/strict`.
- `npm test` bude jediný povinný príkaz na spustenie celého testovacieho balíka.
- Projekt nebude mať žiadne runtime ani testovacie npm závislosti.
- Moduly nebudú zapisovať aplikačné objekty alebo stav na `window`.
- Migrácia prebehne po malých krokoch so zeleným testovacím balíkom po každom
  kroku.

## Modulová architektúra

### Browser entrypoint

`index.html` bude načítavať iba:

```html
<script type="module" src="js/app.js"></script>
```

Existujúce štyri klasické script tagy sa odstránia. Registrácia service workera
sa presunie do modulového kódu.

### Dátové a renderovacie moduly

- `js/storage.js` bude exportovať persistence API, normalizáciu a formát záloh.
- `js/cards.js` bude explicitne importovať `storage` a exportovať pamäťový model
  kariet.
- `js/ui.js` bude explicitne importovať `cards` a exportovať renderovanie,
  navigáciu, swipe a vyhľadávanie.

Tieto moduly si zachovajú súčasné verejné správanie. Ich závislosti budú
explicitné; nebudú predpokladať globálne premenné vytvorené poradím script
tagov.

### Funkčné moduly

- `js/card-editor.js` bude vlastniť stav `editingId`, formulár pridania a úpravy,
  farby a vymazanie karty.
- `js/search.js` bude vlastniť otvorenie, zatvorenie a vykonanie vyhľadávania.
- `js/translation.js` bude obsahovať MyMemory požiadavku, spätnú väzbu a text
  chyby prekladu.
- `js/settings.js` bude vlastniť obrazovky nastavení, veľkosti písma, jazykové
  selecty a navigačné šípky.
- `js/backup.js` bude obsahovať export/import, mapovanie nastavení a používateľské
  správy importných chýb.
- `js/feedback.js` bude poskytovať toast a asynchrónny vlastný potvrdzovací
  dialóg.
- `js/pwa-updates.js` bude poskytovať registráciu service workera, detekciu
  čakajúcej verzie a riadenú aktiváciu.
- `js/sheet.js` bude poskytovať gesto na zatvorenie spodných modalov.

Moduly prijmú DOM elementy alebo nevyhnutné služby cez inicializačné argumenty,
ak by priamy import vytvoril kruhovú závislosť. Modulový graf nesmie obsahovať
kruhové importy.

### `js/app.js`

`app.js` bude tenký entrypoint. Jeho zodpovednosti:

1. počkať na DOM,
2. inicializovať `cards` a `ui`,
3. inicializovať funkčné moduly,
4. spojiť verejné callbacky medzi modulmi,
5. zobraziť jednorazové oznámenie obnovy,
6. zaregistrovať PWA aktualizačný tok.

Nebude obsahovať implementáciu formulárov, nastavení, importu, prekladu,
potvrdzovacích dialógov ani gest.

## Stav a dátové toky

- `editingId` patrí iba modulu `card-editor.js`.
- Veľkosti písma a jazykové nastavenia patria modulu `settings.js`; trvalé
  hodnoty číta a zapisuje cez `storage`.
- Čakajúci service worker patrí modulu `pwa-updates.js`.
- Pending resolver potvrdzovacieho dialógu patrí modulu `feedback.js`.
- Aktuálny index karty zostáva v `ui.js`.
- Karty zostávajú v pamäťovom modeli `cards.js`.

Zmena karty tečie z `card-editor` do `cards`, následne cez existujúcu
`cards-change` udalosť do `ui`. Import tečie z `backup` cez `storage`, potom
znovu inicializuje `cards` a obnoví UI nastavenia. Chyby tečú z dátových
modulov nahor a až funkčný UI modul ich prekladá na slovenskú správu.

## Testovací systém

Projekt dostane minimálny `package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

Testy budú importovať:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
```

Súčasné vlastné `test()` helpery a CommonJS `require()` sa odstránia. Testy
čistej logiky budú importovať verejné exporty priamo. DOM moduly budú
navrhnuté tak, aby ich bolo možné testovať s malými falošnými elementmi alebo
injektovanými callbackmi, nie s rozsiahlym globálnym falošným dokumentom.

`npm test` spustí všetky súbory `tests/*.test.js`. Jeden testovací súbor bude
možné spustiť napríklad:

```bash
node --test tests/search.test.js
```

## Povinné regresné pokrytie

Zachová sa všetkých súčasných 39 scenárov. Doplnia sa scenáre pre:

- pridanie, úpravu a vymazanie karty vrátane zlyhania persistence,
- vyhľadávanie v `front`, `hint` a `back`,
- výsledok nenájdeného a prázdneho vyhľadávania,
- cyklickú navigáciu dopredu a dozadu,
- úspešný swipe a pohyb pod hranicou swipe,
- zapnutie a vypnutie šípok,
- hranice veľkosti písma 70 až 150 percent,
- zamedzenie rovnakého zdrojového a cieľového jazyka,
- úspešnú odpoveď, prázdnu odpoveď a sieťovú chybu MyMemory,
- starý a nový importný formát a zachovanie dát pri chybe,
- jeden reload riadenej PWA aktualizácie,
- import celého modulového grafu bez globálnych kolízií.

Testy nesmú vykonávať živé volania na MyMemory API. Inicializačná funkcia
`translation.js` prijme `fetch` ako závislosť, aby testy používali
deterministickú odpoveď.

## Chybové správanie

- Dátové moduly vracajú výsledok alebo vyhodia konkrétnu chybu.
- UI moduly zachytávajú iba chyby, ktoré dokážu preložiť na existujúcu
  slovenskú spätnú väzbu.
- Importná validácia musí skončiť pred potvrdením a pred akýmkoľvek zápisom.
- Zlyhanie zmeny karty ponechá formulár otvorený a model v pôvodnom stave.
- Zlyhanie prekladu ponechá ručný vstup použiteľný.
- Zlyhanie registrácie service workera nesmie zablokovať aplikáciu.
- Testovací výstup nesmie obsahovať neočakávané errors alebo warnings.

## Poradie migrácie

1. Pridať `package.json` a previesť existujúcich 39 testov na `node --test`.
2. Doplniť chýbajúce regresné testy nad aktuálnym správaním.
3. Vyčleniť `sheet.js`, `feedback.js` a `pwa-updates.js`.
4. Vyčleniť `translation.js`, `settings.js`, `backup.js`, `search.js` a
   `card-editor.js`.
5. Previesť `storage.js`, `cards.js` a `ui.js` na explicitné ES exporty/importy.
6. Zmenšiť `app.js` na inicializáciu a prepojenie modulov.
7. Prepnúť `index.html` na jediný modulový entrypoint.
8. Pridať nové JS súbory do app-shell cache a zvýšiť jej verziu.
9. Spustiť celý testovací balík a browserové online/offline smoke testy.

Po každom kroku musia prejsť všetky dovtedy existujúce testy. Presun kódu sa
nebude kombinovať so zmenou vzhľadu alebo používateľského správania.

## Akceptačné kritériá

- `npm test` spustí celý balík bez externých npm balíkov.
- Všetky súčasné a nové testy prejdú bez neočakávaného výstupu.
- `app.js` je stručný entrypoint, nie viacúčelový funkčný modul.
- Žiadny aplikačný modul nevytvára globálny aplikačný stav.
- Modulový graf nemá kruhové importy ani globálne kolízie.
- Aktuálne používateľské správanie a slovenské texty zostanú zachované.
- PWA app shell obsahuje každý produkčný modul.
- Aplikácia sa načíta online aj offline bez chýb alebo warningov v konzole.
- Pracovný strom je po dokončení čistý.

## Mimo rozsahu

Táto etapa nepridáva balíčky kariet, kategórie, spaced repetition, štatistiky,
cloudovú synchronizáciu, nový dizajn ani upratovanie historických artefaktov.
Tieto práce patria do ďalších samostatných etáp.
