# Spodná navigácia a obľúbené karty

## Cieľ

Presunúť pridávanie aktuálnej karty do obľúbených z plochy slidera do spodnej
navigácie a zároveň zjednodušiť rozdelenie zodpovedností medzi sliderom a UI.

Výsledný stred spodnej navigácie bude mať tri tlačidlá:

1. vľavo prepínač zobrazenia obľúbených kariet s ikonou troch čiar,
2. v strede mierne zmenšené tlačidlo na pridanie karty,
3. vpravo hviezdičku na zmenu obľúbenosti aktuálnej karty.

Šípky predchádzajúcej a nasledujúcej karty zostanú na súčasných krajoch.

## Zvolené architektonické riešenie

Logika obľúbenosti sa presunie z `card-slider.js` do `ui.js`.

### `card-slider.js`

Slider bude zodpovedný iba za:

- vykresľovanie virtuálneho okna kariet,
- aktuálny potvrdený index,
- gestá, animácie a otočenie karty,
- oznámenie aktuálneho stavu UI vrstve.

Slider už nebude prijímať ani ovládať DOM element hviezdičky a nebude poznať
atribút `favorite`.

Nové verejné rozhranie `setOnStateChange(callback)` bude posielať:

```js
{
  currentCardId: "id-karty-alebo-null",
  busy: true
}
```

`busy` bude `true` počas ťahania, návratovej animácie a prechodu na inú kartu.
Po potvrdení novej stredovej karty slider odošle jej ID a `busy: false`.

### `ui.js`

UI vrstva bude zodpovedná za:

- prepínanie medzi všetkými a obľúbenými kartami,
- stav ľavého tlačidla filtra,
- stav pravej hviezdičky,
- zápis obľúbenosti cez `cardsModel.update()`,
- synchronizáciu ovládania s autoritatívnymi dátami z `cards.js`.

UI si nebude od slidera pýtať kópiu celej karty. Podľa prijatého
`currentCardId` ju načíta cez `cardsModel.getById()`.

Nevznikne nový modul. Existujúce rozdelenie `card-slider.js`, `ui.js` a
`cards.js` je pre túto aplikáciu dostatočné.

## DOM a rozloženie

Tlačidlo `#btn-card-favorite` sa odstráni zo `.splide__track` a presunie do
spodnej navigácie.

Stredná skupina bude mať vlastný flex kontajner:

```text
[ zoznam obľúbených ] [ pridať kartu ] [ obľúbenosť aktuálnej karty ]
```

Navrhnuté identifikátory:

- `#btn-favorites-view` — ľavý prepínač zobrazenia,
- `#btn-add` — stredné pridanie karty,
- `#btn-card-favorite` — pravá hviezdička.

Ľavé a pravé tlačidlo budú rovnako veľké. Stredné `+` zostane dominantné,
ale jeho rozsah sa zmenší približne zo súčasných 96–124 px na 80–104 px.
Bočné tlačidlá budú mať približne 48–62 px podľa šírky obrazovky.

Ikona ľavého tlačidla bude čisté inline SVG s tromi vodorovnými čiarami.
Nebude sa meniť pri zapnutí filtra. Aktívny stav vyjadrí zvýraznené pozadie,
aby sa rozloženie ani ikona pri prepnutí nepohli.

## Správanie ľavého tlačidla

- Prvý klik zobrazí iba karty s `favorite: true`.
- Druhý klik obnoví všetky karty.
- Aktívny stav bude dostupný cez `aria-pressed="true"`.
- Prístupný názov sa zmení podľa dostupnej akcie:
  - „Zobraziť obľúbené karty“,
  - „Zobraziť všetky karty“.
- Tlačidlo „Zobraziť všetky karty“ v prázdnom stave obľúbených zostane
  funkčné a vypne rovnaký filter.

## Správanie pravej hviezdičky

- `☆` znamená, že aktuálna karta nie je obľúbená.
- `★` znamená, že aktuálna karta je obľúbená.
- Použije `aria-pressed` a slovenský `aria-label` podľa dostupnej akcie.
- Pri nulovom počte zobrazených kariet bude skrytá a deaktivovaná.
- Počas `busy: true` zostane na pevnom mieste, ale bude deaktivovaná.
- Stav zmení až po potvrdení novej stredovej karty.
- Zostane dostupná aj na zadnej strane otočenej karty.

Po kliknutí UI:

1. overí, že slider nie je zaneprázdnený a existuje aktuálna karta,
2. dočasne deaktivuje tlačidlo,
3. uloží opačnú hodnotu cez `cardsModel.update()`,
4. po úspechu načíta potvrdený stav z modelu a aktualizuje ovládanie,
5. pri chybe zachová pôvodnú ikonu a tlačidlo znovu aktivuje.

Ak používateľ odoberie aktuálnu kartu počas aktívneho filtra obľúbených,
existujúci refresh ju odstráni zo zobrazenej množiny. Slider vyberie platnú
nasledujúcu kartu alebo UI zobrazí prázdny stav obľúbených.

## Dátový tok

### Listovanie

```text
gesto -> slider busy:true -> UI deaktivuje pravú hviezdičku
      -> slider potvrdí index -> currentCardId + busy:false
      -> UI načíta kartu z modelu -> nastaví ☆ alebo ★
```

### Zmena obľúbenosti

```text
pravá hviezdička -> UI získa currentCardId
                 -> cardsModel.update()
                 -> cards-change / refresh
                 -> UI synchronizuje obe ovládania a zobrazenú množinu
```

## Odstránená logika

Z `card-slider.js` sa odstráni:

- `favoriteButton` z `elements`,
- `onToggleFavorite` a `setOnToggleFavorite`,
- `favoritePending`,
- `syncFavoriteButton()`,
- `handleFavoriteClick()`,
- väzby udalostí pravej hviezdičky,
- `currentCardFlipped`, ktorý slúžil iba na skrývanie hviezdičky na zadnej
  strane.

CSS `.card-favorite` viazané na geometriu stredovej karty sa nahradí štýlom
bočného tlačidla v spodnej skupine.

## Chybové stavy

Zlyhanie ukladania nesmie optimisticky zmeniť `☆` na `★` ani naopak. UI
zachová posledný potvrdený stav z modelu, odblokuje tlačidlo a zapíše chybu
do konzoly rovnakým spôsobom ako súčasná implementácia.

Opakované kliknutie počas prebiehajúceho ukladania alebo animácie sa
ignoruje.

## Prístupnosť

- Všetky tri stredné prvky budú skutočné elementy `button`.
- Ľavý prepínač aj pravá hviezdička použijú `aria-pressed`.
- SVG ikona zoznamu bude prezentačná pomocou `aria-hidden="true"`.
- Každé tlačidlo bude mať minimálne 44 × 44 px dotykovú plochu.
- Deaktivované tlačidlo si zachová čitateľný kontrast a nebude meniť polohu.

## Testovanie

Automatické testy pokryjú:

- slider emituje ID potvrdenej karty a stav `busy`,
- slider už nevytvára ani neovláda hviezdičku,
- UI nastavuje pravú hviezdičku podľa aktuálnej karty z modelu,
- počas ťahania a animácie je pravé tlačidlo deaktivované,
- kliknutie mení iba aktuálnu kartu a čaká na perzistenciu,
- chyba ukladania zachová potvrdený stav,
- ľavé tlačidlo prepína obľúbené a všetky karty a správne nastavuje
  `aria-pressed`,
- odobranie poslednej obľúbenej karty zobrazí správny prázdny stav,
- DOM obsahuje trojtlačidlovú strednú skupinu v správnom poradí,
- CSS už neukotvuje hviezdičku ku karte.

V mobilnom prehliadači sa overí:

- rozloženie troch tlačidiel bez kolízie so šípkami,
- stabilita pravého tlačidla počas swipu,
- aktualizácia `☆/★` po usadení novej karty,
- filter, návrat ku všetkým kartám a prázdny stav,
- dostupnosť hviezdičky na prednej aj zadnej strane,
- nulový počet chýb a varovaní v konzole.

Po statických zmenách sa zvýši generácia service-worker cache z
`la-word-v15` na `la-word-v16`.
