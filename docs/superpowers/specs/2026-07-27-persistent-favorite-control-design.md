# Stabilné ovládanie obľúbenej karty

## Cieľ

Odstrániť krátke zmiznutie hviezdičky pri prechode medzi kartami bez zmeny
významu funkcie obľúbených kariet.

Hviezdička bude vizuálne naďalej patriť aktuálnej stredovej karte, ale nebude
súčasťou dočasných slide prvkov, ktoré slider po každom prechode nanovo
vytvára.

## Príčina súčasného správania

Každý virtuálny slide dnes vytvára vlastný prvok `.star`. Po dokončení
animácie `renderWindow()` nahradí všetky slide prvky cez `replaceChildren()`.
Pôvodná hviezdička preto zanikne a nová sa vytvorí až s novou zostavou
slideov. To sa prejaví ako krátke bliknutie.

## Zvolené riešenie

V `#card-container` bude jeden trvalý element
`button#btn-card-favorite`. CSS ho umiestni nad pravý dolný roh stredovej
karty. Nebude sa nachádzať v pohybujúcom sa `.splide__list`, takže ho
`renderWindow()` nikdy neodstráni.

Tlačidlo bude:

- zobrazovať `☆`, keď aktuálna karta nie je obľúbená,
- zobrazovať `★`, keď aktuálna karta je obľúbená,
- používať `aria-pressed` a aktuálny slovenský `aria-label`,
- skryté, keď nie je dostupná žiadna karta,
- skryté na otočenej zadnej strane, čím zachová súčasné správanie,
- dočasne neaktívne počas ťahania a prechodovej animácie.

Po potvrdení nového indexu slider aktualizuje stav tlačidla podľa novej
stredovej karty a znova ho aktivuje. Počas pohybu teda ovládací prvok
neblikne a zároveň nemôže zmeniť obľúbenosť nesprávnej karty.

## Tok interakcie

1. Slider vykreslí okno kariet a zosynchronizuje trvalé tlačidlo s aktuálnou
   kartou.
2. Pri začatí horizontálneho ťahu sa tlačidlo dočasne deaktivuje.
3. Ak sa gesto zruší, tlačidlo sa opäť aktivuje pre pôvodnú kartu.
4. Ak sa prechod dokončí, slider potvrdí nový index, prekreslí virtuálne
   slidy a následne aktualizuje tlačidlo pre novú kartu.
5. Kliknutie na tlačidlo zastaví šírenie udalosti, takže kartu neotočí.
6. Po úspešnom uložení sa aktualizuje ikona aj prístupné atribúty.
7. Ak je zapnutý filter obľúbených a karta sa odoberie z obľúbených,
   existujúci refresh ju odstráni zo zobrazenej množiny a ovládanie sa
   zosynchronizuje s nasledujúcou kartou alebo sa skryje.

## Rozdelenie zodpovedností

- `index.html` poskytne jeden trvalý button v kontajneri slidera.
- `js/card-slider.js` odstráni hviezdičky zo slideov, synchronizuje trvalé
  tlačidlo a spracuje jeho aktiváciu.
- `js/ui.js` naďalej vykoná perzistentnú zmenu cez model a vráti výsledok
  slideru.
- `css/style.css` umiestni tlačidlo nad stredovú kartu a zachová dnešný
  vizuálny štýl hviezdičky.
- `service-worker.js` dostane novú verziu cache, aby sa zmena spoľahlivo
  načítala aj používateľom s nainštalovanou PWA.

## Zvážené alternatívy

### Zachovať hviezdičku v každom slide

Menšia úprava, ale hviezdičky sa naďalej pohybujú a zanikajú pri
`replaceChildren()`. CSS prechod môže bliknutie iba maskovať, nie odstrániť
jeho príčinu.

### Opätovne používať existujúce slide DOM prvky

Zachovalo by identitu hviezdičiek, ale vyžadovalo by väčší zásah do
virtualizácie slidera. Pre túto opravu prináša zbytočne vysoké riziko chýb
v nekonečnom listovaní.

## Overenie

Automatické testy pokryjú:

- vo virtuálnych slidoch sa nevytvárajú samostatné hviezdičky,
- trvalé tlačidlo prežije prekreslenie slidera ako ten istý DOM prvok,
- po navigácii zobrazuje stav novej aktuálnej karty,
- kliknutie prepne správnu kartu a neotočí ju,
- počas animácie je neaktívne,
- pri prázdnej množine a na zadnej strane je skryté,
- chyba pri ukladaní nezanechá nepravdivý stav rozhrania.

Nakoniec sa spustí celá testovacia sada a mobilný tok sa overí v reálnom
prehliadači vrátane listovania, otočenia karty a filtra obľúbených.
