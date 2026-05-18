# Bhutan Traffic Accidents Dashboard

Interaktyvi React + Vite aplikacija eismo įvykiams Butane analizuoti (2021–2025).

## Funkcionalumas

**KPI viršuje** (atsinaujina pagal filtrus):
- Eismo įvykių skaičius
- Žuvusių skaičius + procentas nuo visų pasirinktame rinkinyje
- Sužeistų skaičius + procentas nuo visų pasirinktame rinkinyje
- Dažniausias eismo įvykio tipas

**Žemėlapis** — užfiksuotas tik ant Butano kontūro, jokio pasaulio žemėlapio. Negali nutempti view'o į kitas šalis. Butano forma — baltas užpildytas kontūras pilkame fone. 3 spalvų taškai:
- Raudoni (didesni) — eismo įvykiai su žuvusiais
- Oranžiniai — eismo įvykiai su sužeistais (be žuvusių)
- Mėlyni (maži) — be aukų

Paspaudus tašką iškrenta kortelė su data, laiku, vieta, regionu, padaliniu, žuvusių/sužeistų skaičiumi, transporto priemone, priežastimi.

**Filtrai**:
- **Year** — `All` arba 2021–2025. Pasirinkus 2021, žemėlapis pažymi, kad tų metų duomenys neturi koordinačių — naudok Table view.
- **Show on map** — trys nepriklausomos varnelės: `All traffic accidents`, `Fatal accidents`, `Injuries`. Šitos varnelės keičia tik tai, ką rodo žemėlapis, bet ne KPI/grafikus/lentelę.
- **Accident type** / **Division** / **Region** / **Place of occurrence** — kategoriniai ir teksto filtrai, kurie veikia visiems vaizdams (KPI, žemėlapis, grafikai, lentelė).

**Žemėlapis riboja markerius iki ~3000** dėl performance — visi mirtini visada paliekami; ne mirtini imami su žingsniu.

**Eliminuoti įvykiai už Butano sienos** — ETL'as turi `BHUTAN_POLY` kontūrą; bet kuris įrašas su koordinatėmis už šios sienos (data entry klaidos, pvz. `lat=21` Bangladeše, `lon=39` Saudo Arabijoje) nuvalo savo koordinates į `null`. Įrašas lieka lentelėje/grafikuose, bet nebėra žemėlapyje.

**Divisions ir Regions** — sukanonizuoti. MVA failai vadina "Division I Paro", Divison failai — "Division 1", abu reiškia tą patį padalinį, taigi sujungti į vieną `"Division I — Paro"`. Visi 14 fizinių padalinių + Traffic Division (Thimphu) atskirti. Visi 20 oficialių Butano dzongkhag'ų (regionų) išrūšiuoti pagal pavadinimą — sub-district sheet'ai (Phuntsholing, Gedu, Gelephu, ir pan.) sujungti su jų tikraisiais regionais (Chukha, Sarpang, ...).

## Duomenų šaltiniai

- `MVA_2022-2025.xlsx` — švarūs duomenys su koordinatėmis. Vienas sheet'as kiekvieniems metams.
- `Divison_1.xlsx` … `Divison_14.xlsx`, `Traffic_Division.xlsx` — 2021 m. duomenys, be koordinačių, su kategorinėmis žymėmis (Collision, Hit and Run, Fatal ir t.t.) ir laisvo teksto `Place of Occurrence`.

ETL skriptas (`etl.py`) abu šaltinius normalizuoja į `public/data/accidents.json`. Taip pat sukuria `public/data/bhutan.geojson` — Butano kontūrą.

## Paleidimas

Reikalavimai: Node.js 18+. Veikia ant **`http://localhost:5174`** (kad nekonfliktuotų su kita tavo sistema ant `:5173`).

```bash
cd bhutan-accidents
npm install
npm run dev
```

Atidaryk **http://localhost:5174**.

## Jei reikia perdaryti duomenis

```bash
pip install pandas openpyxl shapely
python3 etl.py
```

Skriptas tikisi rasti Excel failus `/mnt/user-data/uploads/` (tas pats kelias, iš kur dabar buvo paimti). Jei keisi vietą, pataisyk `UPLOADS = Path(...)` `etl.py` viršuje.

## Project struktūra

```
bhutan-accidents/
├── etl.py                          # Excel → JSON normalizatorius
├── package.json
├── vite.config.js                  # Portas 5174
├── index.html
├── public/
│   └── data/
│       ├── accidents.json          # Sukurtas ETL
│       └── bhutan.geojson          # Butano kontūras žemėlapiui
└── src/
    ├── main.jsx
    ├── styles.css
    ├── App.jsx                     # Layout + filter state + map data logic
    └── components/
        ├── Filters.jsx
        ├── KPICards.jsx
        ├── AccidentMap.jsx         # Leaflet, locked viewport
        ├── AccidentCharts.jsx      # Recharts
        └── AccidentTable.jsx
```
