# Stabilita úložiska, záloh a PWA aktualizácií

## Cieľ

Zvýšiť ochranu používateľských dát bez zavedenia servera alebo používateľských
účtov. Zachovať súčasnú architektúru IndexedDB + localStorage, rozšíriť export
o nastavenia a upraviť PWA aktualizácie tak, aby sa vykonali až po vedomom
potvrdení používateľa.

Práce sa vykonajú v tomto poradí:

1. bezpečné ukladanie a automatická obnova,
2. verziovaný export a import,
3. riadené PWA aktualizácie.

## 1. Bezpečné ukladanie a automatická obnova

### Zdroje dát

- IndexedDB databáza `laword`, store `cards`, zostane primárnym úložiskom.
- `laword_cards` bude obsahovať posledný úspešne uložený stav kariet.
- `laword_cards_backup` bude obsahovať predchádzajúci platný stav.

Každý zdroj sa pred použitím normalizuje rovnakými validačnými pravidlami.
Poškodený JSON, hodnota iného typu než pole alebo karta bez neprázdnych polí
`front` a `back` sa nepovažujú za platný stav.

### Načítanie

Pri spustení aplikácia:

1. načíta IndexedDB,
2. ak operácia uspeje a databáza obsahuje platné karty, použije ich a
   zosynchronizuje localStorage,
3. ak je IndexedDB dostupná, ale prázdna, skúsi migráciu platných dát z
   `laword_cards` a potom z `laword_cards_backup`,
4. ak IndexedDB zlyhá alebo obsahuje neplatné dáta, skúsi rovnaké dva lokálne
   zdroje v uvedenom poradí,
5. prvú platnú lokálnu kópiu zapíše späť do IndexedDB,
6. ak boli dáta získané zo záložného kľúča alebo po chybe primárneho úložiska,
   oznámi výsledok udalosťou, z ktorej UI zobrazí toast
   `Karty boli obnovené zo zálohy.`,
7. ak žiadny zdroj neobsahuje platné karty, vráti prázdny zoznam.

Prázdna IndexedDB a neprítomné lokálne dáta predstavujú legitímny nový stav,
nie chybu. Existujúca migrácia z localStorage zostane zachovaná.

### Ukladanie

Pred prepísaním `laword_cards` sa jeho platná aktuálna hodnota uloží do
`laword_cards_backup`. Nový stav sa normalizuje pred akýmkoľvek zápisom.
IndexedDB zápis sa považuje za dokončený až po udalosti `transaction.complete`.

Zlyhanie IndexedDB nebráni zápisu do localStorage. Zlyhanie localStorage
nespôsobí zrušenie už úspešného IndexedDB zápisu. Metóda ukladania vráti
výsledok dostatočný na to, aby volajúci vedel rozlíšiť úplný úspech od
degradovaného uloženia.

### Overenie

Automatické testy pokryjú:

- platnú IndexedDB ako preferovaný zdroj,
- migráciu pri prázdnej IndexedDB,
- poškodený JSON v každom localStorage kľúči,
- neplatnú kartu v každom zdroji,
- obnovu zo záložného kľúča,
- legitímny nový stav bez dát,
- čakanie na dokončenie IndexedDB transakcie,
- nezávislé zlyhanie každého úložiska.

## 2. Verziovaný export a import

### Nový formát

Exportovaný súbor `la-carta-backup.json` bude mať túto štruktúru:

```json
{
  "format": "la-carta-backup",
  "version": 1,
  "exportedAt": "2026-07-23T12:00:00.000Z",
  "cards": [],
  "settings": {
    "translation": {
      "source": "sk",
      "target": "en"
    },
    "fontSizes": {
      "front": 100,
      "back": 100
    },
    "showArrows": true
  }
}
```

`exportedAt` bude platný ISO 8601 čas vytvorenia exportu. Export bude čítať
aktuálne karty z pamäťového modelu alebo z explicitne odovzdaného zoznamu,
nie zo zastaranej localStorage kópie.

### Podporované importy

Import prijme:

- objekt s `format: "la-carta-backup"` a `version: 1`,
- pôvodný formát, ktorého koreňom je pole kariet.

Iný identifikátor alebo verzia sa odmietne bez zmeny dát. Nový balík musí mať
platné pole `cards`. Nastavenia sú voliteľné; ak chýbajú, zachovajú sa aktuálne
hodnoty. Prítomné nastavenia sa normalizujú:

- jazyk musí patriť medzi podporované jazyky a zdroj sa nesmie rovnať cieľu,
- veľkosť písma musí byť celé číslo od 70 do 150,
- `showArrows` musí byť boolean.

Neplatná prítomná sekcia nastavení spôsobí odmietnutie celého importu. Starý
formát zmení iba karty a všetky aktuálne nastavenia ponechá bez zmeny.

### Bezpečný priebeh

Celý súbor sa najprv parsuje, validuje a normalizuje bez zápisu. Až po úspešnej
validácii a potvrdení používateľa sa vykoná import.

Bezprostredne pred importom sa aktuálne karty uložia do
`laword_cards_backup`. Karty sa potom zapíšu do IndexedDB a `laword_cards`.
Nastavenia sa zapíšu až po úspešnom uložení kariet. Ak zápis kariet zlyhá vo
všetkých dostupných úložiskách, nastavenia sa nezmenia a aplikácia ponechá
aktuálny pamäťový model.

Po úspechu UI znovu načíta model a zobrazí počet importovaných kariet, napríklad
`Importovaných kariet: 12.` Pri chybe zobrazí konkrétnu slovenskú správu pre
neplatný súbor, nepodporovanú verziu alebo zlyhanie uloženia.

### Overenie

Automatické testy pokryjú:

- export s kartami, nastaveniami, verziou a platným časom,
- import verzie 1,
- import pôvodného poľa kariet,
- zachovanie nastavení pri pôvodnom formáte,
- chýbajúce voliteľné nastavenia,
- neplatné a nepodporované verzie,
- neplatné karty a nastavenia,
- nulovú zmenu dát pri chybe validácie,
- nulovú zmenu nastavení pri úplnom zlyhaní zápisu kariet.

## 3. Riadené PWA aktualizácie

### Životný cyklus

Service worker počas udalosti `install` predpripraví app shell, ale nezavolá
`skipWaiting()`. Nainštalovaná nová verzia zostane v stave `waiting`, kým ju
používateľ nepotvrdí.

Aplikácia zobrazí banner `Je dostupná nová verzia.`:

- keď `navigator.serviceWorker.ready` vráti registráciu s čakajúcim workerom,
- keď nový worker prejde do stavu `installed` a stránku už ovláda starší worker.

Kliknutie na `Aktualizovať` pošle čakajúcemu workeru správu
`{ type: "SKIP_WAITING" }`. Až spracovanie tejto správy vo workeri zavolá
`self.skipWaiting()`. Po `controllerchange` sa stránka načíta znova presne raz.

Ak je otvorený formulár novej alebo upravovanej karty, aktualizácia sa sama
nespustí. Banner môže zostať viditeľný; používateľ musí vedome kliknúť.

### Cache

Každá zmena nasadzovaných súborov zvýši názov cache. Nový app shell sa vytvorí
počas inštalácie. Staré cache sa odstránia až pri aktivácii potvrdeného workera.
Fetch stratégia zostane:

- network-first s offline HTML fallbackom pre navigácie,
- cache-first s doplnením cache pre statické same-origin GET požiadavky,
- externé požiadavky, vrátane MyMemory API, sa nebudú ukladať do app-shell
  cache.

### Overenie

Automatické testy pokryjú:

- absenciu automatického `skipWaiting()` počas inštalácie,
- zachovanie spracovania správy `SKIP_WAITING`,
- banner pre už čakajúceho workera,
- banner po nainštalovaní novej verzie,
- odoslanie správy iba po kliknutí,
- jeden reload po `controllerchange`.

## Hranice rozsahu

Táto etapa nezavádza cloudovú synchronizáciu, používateľské účty, šifrovanie
exportu, históriu viacerých záloh ani synchronizáciu medzi zariadeniami.
Upratovanie repozitára, širšia refaktorizácia `app.js` a nové vzdelávacie
funkcie budú samostatné nadväzujúce etapy.
