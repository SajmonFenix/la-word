# Card Stack Visual — Dizajn

## Overview
Za hlavnou kartou sa zobrazujú ďalšie karty naskladané za sebou — každá mierne vyčnieva horným okrajom a ľavým bokom, s miernym natočením. Počas swipu sa ďalšia karta približuje do stredu a hlavná odchádza.

## Static Stack Layout
- Počet kariet v stacku: 3 (alebo menej, ak v balíčku nie je dosť)
- Každá ďalšia karta za hlavnou:
  - `top: -8px` oproti predchádzajúcej
  - `left: -5px` oproti predchádzajúcej
  - `transform: rotate(-1deg)` oproti predchádzajúcej (hlavná 0deg, karta+1: -1deg, karta+2: -2deg)
  - Sfarbenie: rovnaká farba ako karta s postupne nižšou `brightness` (karta+1: `brightness(0.85)`, karta+2: `brightness(0.75)`)
  - box-shadow: postupne slabší (karta+1: menší, karta+2: ešte menší)
- Stack karty majú `pointer-events: none` (neinteragujú)
- Indexy podľa poradia v `cards.getAll()`:

```
      [karta+2] (najvzdialenejšia, z-index: 1)
     [karta+1]  (z-index: 2)
    [karta]     (hlavná, z-index: 3)
```

## Swipe Animation
- Počas touchmove/mousemove sa hlavná karta posúva prstom (už implementované)
- Súčasne sa ďalšia karta (`karta+1`) posúva z offsetu do stredu:
  - `top: -8px → 0px`
  - `left: -5px → 0px`
  - `transform: rotate(-1deg) → rotate(0deg)`
  - Progress = `Math.min(1, Math.abs(dx) / 100)` (treshold pre swipe je 100px)
- Po úspešnom swipe (|dx| > 100) sa vykoná `showNext()/showPrev()`, čo render resetne
- Po neúspešnom swipe všetky karty springnú späť

## Implementation
- **Modify:** `js/ui.js`
- **CSS:** `css/style.css` — nové CSS pre stack karty
- Žiadne nové JS súbory

### ui.js changes
- `render()`: po vyrenderovaní hlavnej karty pridať 3 stack karty za ňu
- `_bindSwipe()`: počas swipu animovať aj stack karty
- Pomocná metóda `_renderStack()` na generovanie stack elementov
- Pri swipe sa stack karta +1 animuje plynule do pozície hlavnej

### CSS changes
- `.card-stack` — kontajner pre stack karty, `position: absolute` za hlavnou kartou
- `.card-stack-item` — jednotlivé stack karty s pevnou šírkou/výškou, `pointer-events: none`, `border-radius`, `box-shadow`, `transition` na zmenu transformácií

## Edge Cases
- **Menej ako 2 karty:** stack sa nezobrazuje
- **Presne 2 karty:** zobrazí sa len 1 stack karta
- **Posledná karta:** stack zobrazí karty od začiatku (cyklicky podľa `showNext`)
- **Swipe na poslednej karte:** `showNext` ide na prvú kartu, stack sa obnoví
- **Otočená karta:** swipe najprv odotočí kartu (už implementované v predchádzajúcom commite)
