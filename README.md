# Bhutan Traffic Accidents Dashboard

Interaktyvi React + Vite aplikacija eismo įvykiams Butane analizuoti (2021–2025).

## Paleidimas

```bash
unzip bhutan-accidents.zip
cd bhutan-accidents
npm install          # vieną kartą
npm run dev          # http://localhost:5174
```

Jei nori pergeneruoti `accidents.json` iš pridėtų Excel failų:

```bash
pip install pandas openpyxl shapely
python3 etl.py       # tikisi failų /mnt/user-data/uploads/, paleisk iš projekto šaknies
```

## Duomenų šaltiniai

1. **MVA_2022-2025.xlsx** — švarūs duomenys su koordinatėmis. 4 lapai (2022, 2023, 2024, 2025). Vienas eismo įvykis = viena ar daugiau eilučių, kur kiekviena papildoma eilutė yra papildoma auka. Sujungiama pagal `Sl.No.`.
2. **Divison_*.xlsx + Traffic_Division.xlsx** — 2021 m. duomenys per padalinį. Be koordinačių, „varnelių" stulpeliuose pažymėtos eismo įvykio rūšys, priežastys, kelio sąlygos, oras ir mechaniniai gedimai. Stulpelių skaičius svyruoja (63–66), todėl ETL ekstrahuoja per **stulpelių pavadinimus**, ne fiksuotus indeksus.

## Filtrai (kairys šoninis stulpelis)

- **Year** — `All` arba 2021–2025
- **Show on map** — 4 nepriklausomos varnelės:
  - All traffic accidents (mėlynas taškas)
  - Fatal accidents (raudonas)
  - Injuries (oranžinis)
  - Vehicle damage only (pilkas) — tik tie įvykiai, kuriuose niekas nežuvo ir nebuvo sužeista
- **Time of occurrence** — dual-thumb slankiklis 0:00–24:00
- **Accident type** — visi 11 tipų iš MVA + 5 sintetinti iš 2021 markerių (Others, Two Vehicle collision, Hit and Run, Vehicle pedestrian collision)
- **Cause of accident** — visos 39 priežastys, sujungtos tarp MVA ir 2021 failų
- **Accident spot** — Running Vehicle, Pedestrian, Parked Vehicle, ir t.t. (MVA tik)
- **Vehicle type** — Light/Heavy/Medium Vehicle, Two Wheeler, Earth Moving Equipment
- **Status of victim** — Death / Injured / Vehicle damage only
- **Type of victim** — Driver, Passenger, Pedestrian, Biker, Pillion Rider, Cyclist, Others
- **2021 only** (rodomi tik pasirinkus 2021 metus):
  - Road condition
  - Weather
  - Mechanical failure
- **Division** — visi 14 fizinių padalinių + Traffic Division (Thimphu)
- **District** — visi 20 oficialių Butano dzongkhag'ų
- **Gewog** — Butano gewogai (~200)
- **Place of occurrence** — autocomplete su suggestions iš place/location/gewog laukų

## Vaizdai

- **KPI viršuje** — Eismo įvykių skaičius, žuvusių skaičius (+ %), sužeistų skaičius (+ %), dažniausias eismo įvykio tipas
- **Map view** — OpenStreetMap kaip background (matomi keliai, vietovės), virš jo Butano kontūras ir spalvoti taškai. Žemėlapis suspaustas tik ant Butano (negali pan'inti į kitas šalis). Performance — ne daugiau 3000 taškų ekrane vienu metu, su fatal įvykiais visada paliktais.
- **Table view** — rūšiuojama lentelė su 50 įrašų puslapyje. Naudinga 2021 įrašams, kurie neturi koordinačių.
- **Insights tab** — 8 įžvalgų kortelės + 4 grafikai:
  - % įvykių tamsiu paros metu (18:00–05:59)
  - Peak 2h langas
  - % drunk driving + jo aukos
  - Pavojingiausia savaitės diena
  - Mirtingiausia priežastis (su min 30 atvejų)
  - Mirtingiausias district (su min 50 atvejų)
  - Blogiausias mėnuo
  - Dažniausia transporto priemonė
  - Grafikai: pagal valandą, savaitės dieną, mėnesį, top 5 mirtingiausios priežastys
- **Charts** apačioje:
  - 3 stulpelinės diagramos pagal metus (Accidents, Deaths, Injured)
  - Top 8 accident types
  - Top 10 districts

## Filtrų semantika

- **Multi-value** laukai (`accident_type`, `cause`, `road_condition`, `weather`, `mechanical_failure`) gali turėti reikšmes kaip `"Drunk driving, Tailgating"` — filtras dirba per substring/contains, taigi pasirinkus „Tailgating" gausi ir įvykius, kur priežastys buvo ir „Drunk driving, Tailgating".
- **Map severity checkboxes** (`Show on map`) NESIAURINA KPI / grafikų / lentelės — jie keičia tik žemėlapio markeriu skaičių.
- **Visi kiti filtrai** veikia visiems vaizdams.

## 2021 duomenų priskyrimo logika (iš division failų)

Penki "varnelės" stulpeliai eismo įvykio rūšiai:

| Excel stulpelis  | Priskirtas `accident_type`        | Pastaba |
|------------------|------------------------------------|---------|
| Off-road / Self  | Others                             | + cause = "Off-road/Self" |
| Collision        | Two Vehicle collision              | sutampa su MVA pavadinimu |
| Hit and Run      | Hit and Run                        | |
| Pedestrian       | Vehicle pedestrian collision       | |
| Fatal            | Others (+ deaths>=1)               | jei No. of Death tuščias, priskiriama 1 |

Priežastys, kelio sąlygos, oras, mechaniniai gedimai — sujungiami iš atitinkamo bloko „varnelių" stulpelių.

## Eliminuoti įvykiai už Butano sienos

ETL'as turi `BHUTAN_POLY` aproksimaciją. Bet kuris MVA įrašas su koordinatėmis už šios sienos (data entry klaidos: lat=21, lon=39) nuvalo koordinates į `null`. Įrašas lieka lentelėje/grafikuose, bet nebėra žemėlapyje.

## Divisions ir Districts kanonizavimas

MVA failai vadina „Division I Paro", Divison failai — „Division 1", abu reiškia tą patį padalinį → sujungti į vieną kanoninį `"Division I — Paro"`. Sub-district sheet'ai (Phuntsholing, Gedu, Gelephu, ir kt.) sujungti su jų tikraisiais districtais (Chukha, Sarpang, ...).

## Schema

```json
{
  "id": "mva-2024-20",
  "source": "mva" | "division",
  "year": 2024,
  "date": "2024-09-23",
  "time": "13:00",
  "division": "Division I — Paro",
  "dzongkhag": "Haa",                    // = District
  "gewog": "Samar",
  "location": "Dori-sho",
  "lat": 27.272452, "lon": 89.3005,      // null jei už Butano arba 2021 įrašas
  "accident_type": "Single vehicle accident",
  "cause": "Drunk driving, Tailgating",  // gali būti kelios reikšmės
  "accident_spot": "Parked Vehicle",
  "vehicle_type": "Light Vehicle",
  "vehicle_no": "BP-2-B6511",
  "deaths": 1, "injured": 0,
  "status_of_victim": "Death" | "Injured" | "Vehicle damage only",
  "type_of_victim": ["Passenger"],
  "road_condition": "Potholes",          // tik 2021
  "weather": "Fog, Rain",                // tik 2021
  "mechanical_failure": "Brake failure", // tik 2021
  "police_station": "...",
  "case_no": "..."
}
```
