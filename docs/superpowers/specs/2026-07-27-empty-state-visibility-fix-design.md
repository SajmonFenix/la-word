# Viditeľnosť prázdnych stavov po pridaní alebo importe kariet

## Problém

Po pridaní alebo importe prvej karty zostáva všeobecná hláška
`Zatiaľ nemáš žiadne karty.` viditeľná pod navigačnými tlačidlami.

Funkcia `updateEmptyState()` najprv hlášku správne skryje, ale následná logika
pre prázdny stav obľúbených jej triedu `hidden` znova odstráni.

## Požadované správanie

UI bude rozlišovať dva vzájomne sa vylučujúce prázdne stavy:

- všeobecný prázdny stav sa zobrazí iba vtedy, keď aplikácia nemá žiadne karty
  a filter obľúbených je vypnutý,
- prázdny stav obľúbených sa zobrazí iba vtedy, keď je filter obľúbených
  zapnutý a filtrovaný zoznam neobsahuje žiadne karty,
- ak aktuálny zoznam obsahuje aspoň jednu kartu, oba prázdne stavy zostanú
  skryté a zobrazí sa oblasť kariet.

Správanie musí platiť po inicializácii, pridaní karty, importe kariet,
odstránení karty aj prepnutí filtra obľúbených.

## Implementácia

`updateEmptyState(items)` vypočíta samostatné booleany pre všeobecný a
obľúbený prázdny stav. Trieda `hidden` sa pre každý prvok nastaví presne raz
podľa výsledného stavu. Oprava nebude meniť HTML, CSS ani texty.

## Overenie

Regresný test overí:

1. všeobecná hláška je viditeľná pri nulovom počte kariet,
2. po obnovení UI s neprázdnym modelom všeobecná hláška zmizne,
3. pri zapnutom filtri bez obľúbených kariet je viditeľná iba hláška
   obľúbených,
4. oblasť kariet je viditeľná iba pri neprázdnom aktuálnom zozname.

Po automatickom teste sa vykoná browserový smoke test pridania prvej karty.
