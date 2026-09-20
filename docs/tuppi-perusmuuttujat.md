# Perus-tupin ominaisuudet ja muuttujat

Kokoelma vakio-tupin ominaisuuksista ja muuttujista. Tarkoitettu suunnittelun "paletiksi": uusi ominaisuus rakentuu käytännössä *ehdosta* (jokin näistä muuttujista ylittää rajan / saa tietyn arvon) ja *vaikutuksesta* (muuttaa pistelaskua, laukaisee tapahtuman, antaa bonuksen).

Ei sisällä projektin omia lisäyksiä (puolueet, molo, neliväri, roguelike yms.) — vain perus-tuppiin kuuluvat asiat, rami ja nolo mukaan lukien.

**(vaihtelee)** = riippuu siitä, mitä tupin varianttia toteutus noudattaa; kannattaa varmistaa koodista.

## Peli- ja kierrostaso
- Pelaajien määrä (4)
- Parit / tiimit (2 paria vastakkain) — sekä pelaaja- että tiimikohtainen tarkastelu
- Käsien (jakojen) määrä pelissä
- Tikkien määrä per käsi (13)
- Kädessä olevien korttien määrä per pelaaja (13)
- Pakan koko ja koostumus (52 korttia, 4 maata × 13 arvoa)
- Jakaja ja jaon kierto
- Aloittava pelaaja ja kiertosuunta
- Valttimaa **(vaihtelee — käytetäänkö valttia, ja miten se määräytyy)**
- Pelitila: rami / nolo

## Kortin ominaisuudet (per kortti)
- Maa (♠ ♥ ♦ ♣)
- Arvo / rank (2–A)
- Onko valttia (boolean)
- Onko kunniakortti **(vaihtelee — mitkä kortit lasketaan kunniakorteiksi)**
- Pisteluku per kortti **(vaihtelee — käytössä lähinnä nolossa vältettävinä miinuksina)**

## Tikin muuttujat (yksittäinen tikki)
- Tikin numero (1–13)
- Aloitusmaa (mitä väriä lähdettiin viemään)
- Tikissä olevat kortit (4 kpl täydessä pöydässä)
- Voittava kortti (korkein valtti, tai korkein aloitusmaassa)
- Voittaja (pelaaja / tiimi)
- Pelattiinko valttia tikissä (boolean)

## Kerätyt kortit (saalis = voitetut tikit)
- Voitettujen tikkien määrä
- Kerättyjen korttien kokonaismäärä
- Kerättyjen korttien pistelukujen summa
- Korttimäärä per maa (montako ♥, montako ♠ …)
- Eri maiden lukumäärä saaliissa
- Korttimäärä per arvo / rank (montako ässää, montako kuningasta …)
- Kunniakorttien määrä saaliissa
- Valttien määrä saaliissa

## Pelaaja- ja tiimitaso
- Kädessä olevat kortit (ja niiden edellä mainitut ominaisuudet)
- Renonssit eli maat, joista pelaaja on loppu (void suits)
- Kumulatiivinen kokonaispistemäärä (koko peli)
- Tämän käden pisteet / voitetut tikit
- Sija pöydässä pistemäärän mukaan
- Tiimikohtaiset yhteissummat kaikista yllä olevista

## Käden pistelasku
- Rami-pistelasku (voitetut tikit / pisteet → plussaa)
- Nolo-pistelasku (vältetyt kortit → miinusta / palkinto välttämisestä)
- Tavoitteen / sopimuksen täyttyminen **(vaihtelee — onko pelissä bidausta tai tavoitteita)**
- Bonukset ja sakot **(vaihtelee — esim. kaikki tikit, "puhdas nolo")**
