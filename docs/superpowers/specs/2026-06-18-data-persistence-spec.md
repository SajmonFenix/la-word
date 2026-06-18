# Data Persistence Improvement — Design Spec

## Cieľ
Zabezpečiť, aby používateľ nestratil svoje karty ani pri vymazaní cache/histórie prehliadača. Poskytnúť manuálne zálohovanie.

## Riešenie

### 1. IndexedDB ako primárne úložisko
- Nahradí localStorage ako hlavný storage
- localStorage zostane ako fallback záloha
- Pri prvom načítaní migruje existujúce dáta z localStorage do IndexedDB

### 2. Export / Import
- Tlačidlo ⚙️ v headeri (vedľa `+`)
- Modal s možnosťami Exportovať / Importovať
- Export: stiahne `la-word-backup.json` so všetkými kartami
- Import: nahranie .json súboru, potvrdzovací dialóg, prepíše existujúce karty

### Zmeny v súboroch

#### `js/storage.js`
- Pridaná funkcia `openDB()` — otvorí/wrapper nad IndexedDB
- `storage.load()` — skúsi IndexedDB → fallback localStorage
- `storage.save(cards)` — zapíše do oboch (IndexedDB primárne)
- `storage.export()` — vráti JSON string všetkých kariet
- `storage.import(jsonString)` — nahradí všetky karty
- Pridaná redundancia: ukladanie na 2 localStorage kľúče (`laword_cards`, `laword_cards_backup`)

#### `js/cards.js`
- `cards.init()`, `cards._persist()` → async (kvôli IndexedDB API)
- Ostatné metódy zostávajú synchrónne (držia si lokálnu cache)

#### `js/app.js`
- Pridané `initSettings()` — eventy pre settings tlačidlo
- Pridaný settings modal (export/import)
- `cards.init()` → `await cards.init()` (init bude async)

#### `index.html`
- Pridaný settings modal do HTML (alebo generovaný z JS)
- Pridané tlačidlo ⚙️ do headeru

## IndexedDB Schema
- **Database name:** `laword`
- **Object store:** `cards`
- **Key path:** `id`
- **Index:** `createdAt` (pre prípadné radenie)
