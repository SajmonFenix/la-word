# Stabilný virtualizovaný slider kartičiek

## Cieľ

Odstrániť pády aplikácie na iOS Safari spôsobené rastúcou pamäťovou
náročnosťou súčasného slidera. Aplikácia musí zachovať existujúci vzhľad,
nekonečné listovanie a ovládanie, spoľahlivo fungovať minimálne s 1 000
kartami a po opätovnom otvorení obnoviť poslednú zobrazenú kartu.

Táto etapa je stabilizačná. Nepridáva kategórie, učebné relácie, spaced
repetition, štatistiky ani cloudovú synchronizáciu.

## Zistený problém

Súčasné `ui.js` vytvára pri renderovaní DOM prvok pre každú kartu vrátane
prednej a zadnej 3D plochy. CSS drží celý pás v transformovanej vrstve a každá
karta používa `transform-style: preserve-3d`. Pamäťová a grafická náročnosť
preto rastie s počtom kariet.

Na iPhone 14 Pro s 92 kartami sa webový proces pri listovaní občas ukončí.
Safari stránku prvýkrát automaticky načíta znova, čím sa aplikácia vráti na
prvú kartu. Po opakovanom páde Safari zobrazí hlásenie „A problem repeatedly
occurred“. Tento priebeh zodpovedá ukončeniu WebContent procesu pri pamäťovom
tlaku.

## Zvolené riešenie

Slider bude virtualizovaný pomocou piatich recyklovaných DOM slotov:

- dve karty pred aktuálnou,
- aktuálna karta,
- dve karty za aktuálnou.

Počet DOM kariet zostane konštantný bez ohľadu na celkový počet uložených
kariet. Používateľ bude naďalej vidieť rovnaký slider, susedné karty, 3D
otáčanie, počítadlo a nekonečný prechod cez začiatok a koniec zoznamu.

## Architektúra

### `card-slider.js`

Nový modul bude vlastniť:

- potvrdený aktuálny index a `id` aktuálnej karty,
- päť recyklovaných slotov s logickými pozíciami `-2`, `-1`, `0`, `+1`, `+2`,
- nekonečné mapovanie indexov,
- swipe a navigáciu tlačidlami,
- stav rozpracovaného gesta a animácie,
- obnovu poslednej karty,
- vyčistenie event listenerov a dočasného stavu.

Verejné rozhranie:

```js
init(cards)
setCards(cards, options)
showCard(id)
showIndex(index)
next()
previous()
getCurrentCardId()
destroy()
```

`setCards` prijme nový snapshot dát po pridaní, úprave, vymazaní alebo importe.
Voliteľné nastavenie určí preferované `id`; bez neho modul zachová aktuálnu
kartu, ak ešte existuje.

### `ui.js`

`ui.js` zostane integračnou vrstvou medzi aplikáciou a sliderom. Nebude
vytvárať DOM pre celý zoznam ani pri udalosti `cards-change`. Vyhľadávanie,
editor a nastavenia budú používať verejné metódy slidera a nebudú poznať jeho
sloty alebo animačný stav.

### `cards.js` a `storage.js`

Formát kariet a existujúce persistence pravidlá zostanú nezmenené. IndexedDB
zostane primárnym úložiskom a `localStorage` zálohou. Tým zostane zachovaná
kompatibilita existujúcich kariet a exportov.

## Navigácia a recyklácia

Pri dokončenom posune:

1. slider dokončí animáciu o jeden slot,
2. vypočíta a potvrdí nový aktuálny index,
3. recykluje krajný DOM slot na opačnú stranu,
4. naplní ho obsahom ďalšej karty cez `textContent`,
5. bez prechodu vráti pás do stredovej pozície,
6. znovu povolí prechod a uloží `id` aktuálnej karty.

Pri zoznamoch kratších ako päť kariet slider nevytvorí duplicitné interaktívne
kópie tej istej karty. Počet slotov sa obmedzí na počet kariet; nekonečné
mapovanie bude stále fungovať pre dve a viac kariet. Pri jednej karte sa
navigácia nepohne.

## Gestá a animácie

- Slider spracuje iba jedno gesto alebo animáciu naraz.
- Počas animácie môže evidovať najviac jeden ďalší navigačný úmysel.
- Pohyb pod vzdialenostnou hranicou vráti kartu späť.
- Rýchle švihnutie môže uspieť aj pri kratšej vzdialenosti podľa rýchlosti.
- Po určení vodorovného gesta sa vertikálny pohyb nebude miešať so sliderom.
- `pointercancel`, strata viditeľnosti a prerušenie pointer capture vrátia
  slider na posledný potvrdený index.
- Tlačidlá a swipe použijú rovnakú navigačnú cestu.
- Kliknutie bezprostredne po swipe neotočí kartu.
- Karta opúšťajúca aktuálnu pozíciu sa vráti na prednú stranu.
- `prefers-reduced-motion` vypne alebo výrazne skráti prechod.

CSS ponechá 3D transformáciu iba na kartách v piatich slotoch. `will-change`
bude aktívne iba počas ťahania alebo animácie a po skončení sa odstráni.

## Posledná zobrazená karta

Nový lokálny kľúč:

```text
laword_last_card_id
```

Po úspešnom dokončení navigácie sa uloží iba `id` aktuálnej karty. Pri
spustení sa aplikácia pokúsi nájsť toto `id` v načítaných kartách. Ak neexistuje,
zobrazí prvú kartu. Uložený index sa nepoužije, pretože poradie sa môže zmeniť.

Správanie pri dátových operáciách:

- pridanie zobrazí a uloží novú kartu,
- úprava zachová aktuálnu kartu,
- vymazanie zobrazí kartu na rovnakom indexe, alebo predchádzajúcu kartu pri
  vymazaní poslednej,
- import zachová aktuálne `id`, ak existuje aj v importe; inak zobrazí prvú
  kartu,
- prázdny zoznam odstráni uložené `id`.

Zápis pozície nesmie zapisovať celý zoznam kariet ani meniť jeho persistence
tok.

## Stabilita ostatných častí

- Listener `cards-change` odovzdá slideru nový snapshot namiesto kompletného
  prerenderovania.
- Event listenery sa pripoja iba raz a `destroy()` ich všetky odstráni.
- Chyba persistence nezmení potvrdený viditeľný stav.
- Poškodené alebo neplatné karty sa nebudú renderovať.
- Chyba animačného callbacku vráti slider na potvrdený index.
- PWA aktualizácia zostane riadená používateľom a obyčajný swipe nesmie
  aktivovať ani reloadnúť aplikáciu.
- Po potvrdenej PWA aktualizácii sa obnoví posledná karta.
- Service Worker bude cacheovať iba produkčný app shell.

Historické screenshoty, prototypy a testovacie artefakty sa v tejto etape
nebudú hromadne odstraňovať. Ich archivácia alebo odstránenie zostáva
samostatnou upratovacou etapou.

## Chybové správanie

Slider odlišuje:

- potvrdený index,
- dočasný drag offset,
- cieľ práve prebiehajúcej animácie.

Len dokončená navigácia môže zmeniť potvrdený index a uložené `id`. Zrušené
gesto, animačná chyba alebo prechod aplikácie do pozadia odstráni dočasný stav
a obnoví potvrdenú pozíciu bez reloadu.

Ak karta počas animácie zmizne v dôsledku dátovej operácie, `setCards` dokončí
alebo zruší animáciu, nájde najbližšiu platnú kartu a nanovo naplní sloty.

## Testovanie

### Jednotkové testy

- mapovanie piatich slotov na začiatku, v strede a na konci,
- najviac päť slotov pri 1 000 kartách,
- počet slotov pri nule až štyroch kartách,
- nekonečné prechody `1000 → 1` a `1 → 1000`,
- swipe do oboch strán,
- pohyb pod hranicou a rýchlostná hranica,
- `pointercancel` a strata viditeľnosti,
- blokovanie alebo jednočlenný rad počas animácie,
- obnovenie posledného `id`,
- fallback pri chýbajúcom `id`,
- správanie po pridaní, úprave, vymazaní a importe,
- otočenie karty späť po odchode,
- odstránenie event listenerov cez `destroy()`,
- žiadny reload PWA bez potvrdenia.

### Integračné a browserové testy

Mobilný stress test vytvorí 1 000 kariet a vykoná stovky prechodov. Overí:

- konštantný počet DOM slotov,
- správny text, farbu, počítadlo a aktívnu kartu,
- žiadne chyby ani warningy v konzole,
- zachovanie pozície po reloade,
- pridanie, úpravu, vymazanie, import a vyhľadávanie,
- online a offline načítanie.

Chromium stress test overí logiku a stabilitu DOM, ale nenahrádza iOS WebKit
pamäťový test. Pred finálnym nasadením sa výsledok manuálne preverí na iPhone
14 Pro s reálnymi 92 kartami a rýchlym listovaním v oboch smeroch.

## Akceptačné kritériá

- Slider zachová súčasný vzhľad a nekonečné ovládanie.
- V DOM nikdy nie je viac ako päť slide prvkov.
- Aplikácia funguje minimálne s 1 000 kartami.
- Pamäťová náročnosť renderovania nerastie s počtom kariet.
- Posledná karta sa obnoví podľa `id` po reloade, páde alebo aktualizácii.
- Pridanie, úprava, vymazanie, import a vyhľadanie zobrazia správnu kartu.
- Zrušené alebo rýchle gestá nepoškodia index.
- Bežné listovanie nespôsobí aplikačný reload.
- Všetky existujúce a nové automatické testy prejdú.
- Produkčný browserový test nemá chyby ani warningy.
- Existujúce dáta a exportný formát zostanú kompatibilné.

## Mimo rozsahu

- nový vizuálny dizajn,
- kategórie a balíčky,
- učebné relácie a hodnotenie vedomostí,
- spaced repetition,
- štatistiky,
- cloudová synchronizácia,
- hromadné odstránenie historických projektových artefaktov.
