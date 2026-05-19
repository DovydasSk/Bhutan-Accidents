"""
ETL: Normalize Bhutan accident data from heterogeneous Excel files into a single JSON.

Two data sources:
1. MVA_2022-2025.xlsx -> sheets per year (2022, 2023, 2024, 2025). Has coordinates.
   Per-row schema: one row per VICTIM, aggregated into accidents by Sl.No.
2. Divison_*.xlsx + Traffic_Division.xlsx -> 2021 data per division. NO coordinates.
   Wide schema with check-mark columns for accident type, cause, road condition,
   weather, and mechanical failure. Columns vary slightly per sheet (63–66 cols,
   some include "Sleep driving" some don't), so we extract by HEADER NAME not index.

Output: public/data/accidents.json with a unified schema.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path

import pandas as pd
from shapely.geometry import Polygon, Point

UPLOADS = Path('/mnt/user-data/uploads')
# Output goes next to the script (Vite serves from ./public/data)
SCRIPT_DIR = Path(__file__).resolve().parent
OUT = SCRIPT_DIR / 'public' / 'data' / 'accidents.json'

# ---------- Bhutan boundary polygon (hand-coded approximation) ----------
BHUTAN_POLYGON_COORDS = [
    [88.75, 27.32], [88.80, 27.85], [89.10, 28.05], [89.35, 28.18],
    [89.50, 28.32], [90.00, 28.27], [90.45, 28.30], [90.85, 28.10],
    [91.20, 28.05], [91.50, 27.95], [91.80, 27.93], [92.00, 27.95],
    [92.12, 27.85], [92.13, 27.27], [92.12, 26.92], [91.90, 26.78],
    [91.70, 26.72], [91.40, 26.72], [91.10, 26.72], [90.70, 26.70],
    [90.35, 26.70], [90.00, 26.70], [89.65, 26.65], [89.35, 26.65],
    [89.05, 26.70], [88.83, 26.85], [88.80, 27.00], [88.75, 27.10],
    [88.75, 27.32],
]
BHUTAN_POLY = Polygon(BHUTAN_POLYGON_COORDS)


def write_geojson():
    out = SCRIPT_DIR / 'public' / 'data' / 'bhutan.geojson'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"name": "Bhutan"},
            "geometry": {"type": "Polygon", "coordinates": [BHUTAN_POLYGON_COORDS]},
        }],
    }))


# ---------- Canonical Division and District names ----------
DIVISION_MAP = {
    'Division 1': 'Division I — Paro',
    'Division I Paro': 'Division I — Paro',
    'Division 2': 'Division II — Punakha',
    'Division II Punakha': 'Division II — Punakha',
    'Division 3': 'Division III — Phuentsholing',
    'Division III Phuntsholing': 'Division III — Phuentsholing',
    'Division 4': 'Division IV — Samtse',
    'Division IV Samtse': 'Division IV — Samtse',
    'Division 5': 'Division V — Gelephu',
    'Division V Gelephu': 'Division V — Gelephu',
    'Division 6': 'Division VI — Tsirang',
    'Division VI Tsirang': 'Division VI — Tsirang',
    'Division 7': 'Division VII — Trongsa',
    'Division VII Trongsa': 'Division VII — Trongsa',
    'Division 8': 'Division VIII — Samdrup Jongkhar',
    'Division VIII Samdrupjongkhar': 'Division VIII — Samdrup Jongkhar',
    'Division 9': 'Division IX — Trashigang',
    'Division IX Trashigang': 'Division IX — Trashigang',
    'Division 10': 'Division X — Mongar',
    'Division X Mongar': 'Division X — Mongar',
    'Division 12': 'Division XII — Wangdue',
    'Division XII Wangdue': 'Division XII — Wangdue',
    'Division 13': 'Division XIII — Bumthang',
    'Division XIII Bumthang': 'Division XIII — Bumthang',
    'Division 14': 'Division XIV — Trashiyangtse',
    'Division XIV Trashiyangtse': 'Division XIV — Trashiyangtse',
    'Traffic Division': 'Traffic Division (Thimphu)',
}

DZONGKHAG_MAP = {
    'Bumthang': 'Bumthang', 'Chukha': 'Chukha', 'Dagana': 'Dagana', 'Gasa': 'Gasa',
    'Haa': 'Haa', 'Lhuentse': 'Lhuentse', 'Lhuntse': 'Lhuentse', 'Mongar': 'Mongar',
    'Paro': 'Paro', 'Pemagatshel': 'Pemagatshel', 'P,gatshel': 'Pemagatshel',
    'Punakha': 'Punakha', 'Samdrup Jongkhar': 'Samdrup Jongkhar',
    'S.jongkhar': 'Samdrup Jongkhar', 'Samtse': 'Samtse', 'Sarpang': 'Sarpang',
    'Thimphu': 'Thimphu', 'Trashigang': 'Trashigang', 'Trashiyangtse': 'Trashiyangtse',
    'Trongsa': 'Trongsa', 'Tsirang': 'Tsirang', 'Wangduephodrang': 'Wangdue Phodrang',
    'Wangdue': 'Wangdue Phodrang', 'Zhemgang': 'Zhemgang',
    'Phuntsholing': 'Chukha', 'Gedu': 'Chukha', 'Tsimasham': 'Chukha', 'Pasakha': 'Chukha',
    'Gelephu': 'Sarpang', 'Panbang': 'Zhemgang',
    'Gyelposhing': 'Mongar', 'Weringla': 'Mongar',
    'Dorokha. D.chen': 'Samtse', 'Norbugang.Chmari': 'Samtse',
    'Tashicholing.sibsoo': 'Samtse', 'Pendeling': 'Samtse', 'Pendeling ': 'Samtse',
    'L.zingkha': 'Dagana',
    'Wamrong': 'Trashigang', 'Saktang': 'Trashigang', 'Thimshing': 'Trashigang',
    'Samdrupcholing': 'Samdrup Jongkhar', 'Jomotsangkha': 'Samdrup Jongkhar',
    'Nganglam': 'Pemagatshel',
    'Zawakha': 'Wangdue Phodrang',
}


def canonical_division(name):
    if not name:
        return None
    return DIVISION_MAP.get(name.strip(), name.strip())


def canonical_dzongkhag(name):
    if not name:
        return None
    return DZONGKHAG_MAP.get(name.strip(), name.strip())


# ---------- helpers ----------

def parse_date(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if isinstance(val, pd.Timestamp):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if not s or s.lower() == 'nan':
        return None
    for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%d-%m-%y'):
        try:
            return datetime.strptime(s.split(' ')[0], fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


def parse_time(val):
    """Parse e.g. '2030 hrs' / '1336hrs' / '930 hrs' -> 'HH:MM'."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    if not s or s.lower() == 'nan':
        return None
    m = re.search(r'(\d{3,4})', s)
    if m:
        t = m.group(1).zfill(4)
        hh, mm = t[:2], t[2:]
        try:
            if 0 <= int(hh) <= 23 and 0 <= int(mm) <= 59:
                return f'{hh}:{mm}'
        except ValueError:
            return None
    return None


def to_float(v):
    try:
        if v is None or pd.isna(v):
            return None
        return float(v)
    except (ValueError, TypeError):
        return None


def to_int(v):
    try:
        if v is None or pd.isna(v):
            return 0
        return int(float(v))
    except (ValueError, TypeError):
        return 0


def clean_str(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == 'nan':
        return None
    return s


def is_marked(v):
    """A checkbox column is 'marked' if the cell has any truthy / non-empty value.
    Excel files use 1, 'yes', '1', occasionally 'x'."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return False
    s = str(v).strip().lower()
    if not s or s == 'nan':
        return False
    try:
        return float(s) > 0
    except (ValueError, TypeError):
        return s in ('yes', 'y', 'x', '✓', 'true')


# ---------- MVA 2022-2025 (clean, geocoded) ----------

# Canonical "Status of Victim" values: only 'Death', 'Injured' present in MVA.
# A blank Status of Victim with no death/injured victim entries == "Vehicle damage only".
def victim_status_label(deaths, injured):
    if deaths > 0:
        return 'Death'
    if injured > 0:
        return 'Injured'
    return 'Vehicle damage only'


def process_mva():
    rows = []
    file = UPLOADS / 'MVA_2022-2025.xlsx'
    for year in ['2022', '2023', '2024', '2025']:
        df = pd.read_excel(file, sheet_name=year, header=1)
        df['Sl.No.'] = df['Sl.No.'].ffill()
        # Forward-fill accident-level fields (blank for additional victim rows)
        accident_cols = ['Division', 'Dzongkhag', 'Gewog', 'Location', 'Latitude', 'Longitude',
                         'Date of Occurance', 'Time of Occurance', 'Accident Type',
                         'Cause of Accident', 'Accident spot', 'Vehicle Type', 'Vehicle No.']
        for c in accident_cols:
            if c in df.columns:
                df[c] = df[c].ffill()

        for sl_no, group in df.groupby('Sl.No.'):
            first = group.iloc[0]
            victims = group[['Status of Victim', 'Type of victim']].copy()
            statuses = victims['Status of Victim'].astype(str).str.strip().str.lower()
            deaths = int((statuses == 'death').sum())
            injured = int((statuses == 'injured').sum())

            # Collect distinct victim types reported for this accident
            victim_types = sorted({
                str(t).strip() for t in victims['Type of victim'].dropna()
                if str(t).strip() and str(t).strip().lower() != 'nan'
            })

            lat = to_float(first.get('Latitude'))
            lon = to_float(first.get('Longitude'))
            if lat is not None and lon is not None:
                if not BHUTAN_POLY.contains(Point(lon, lat)):
                    lat = None
                    lon = None

            rows.append({
                'id': f'mva-{year}-{int(sl_no)}',
                'source': 'mva',
                'year': int(year),
                'date': parse_date(first.get('Date of Occurance')),
                'time': parse_time(first.get('Time of Occurance')),
                'division': canonical_division(clean_str(first.get('Division'))),
                'dzongkhag': canonical_dzongkhag(clean_str(first.get('Dzongkhag'))),
                'gewog': clean_str(first.get('Gewog')),
                'location': clean_str(first.get('Location')),
                'lat': lat,
                'lon': lon,
                'accident_type': clean_str(first.get('Accident Type')),
                'cause': clean_str(first.get('Cause of Accident')),
                'accident_spot': clean_str(first.get('Accident spot')),
                'vehicle_type': clean_str(first.get('Vehicle Type')),
                'vehicle_no': clean_str(first.get('Vehicle No.')),
                'deaths': deaths,
                'injured': injured,
                'place': clean_str(first.get('Location')),
                'status_of_victim': victim_status_label(deaths, injured),
                'type_of_victim': victim_types,
                # MVA file doesn't capture these
                'road_condition': None,
                'weather': None,
                'mechanical_failure': None,
            })
    return rows


# ---------- Division files (2021, no coords) ----------

# Map of "raw column header label" -> canonical category value.
# Header labels are lowercased & whitespace-collapsed before lookup,
# so "brake Failure " and "Streeing Failure" still match.
def _norm(label):
    return re.sub(r'\s+', ' ', str(label)).strip().lower()


# Accident type columns (J–N in the spec). Marked column -> type.
ACCIDENT_TYPE_FROM_COL = {
    'off-road/ self': 'Others',                # spec: "Others" with cause "Off-road/Self"
    'collision': 'Two Vehicle collision',      # spec: "new accident type for collisions" — reuse MVA's "Two Vehicle collision" label
    'hit amd run': 'Hit and Run',
    'pedestrian': 'Vehicle pedestrian collision',
    'fatal': 'Others',                          # "type Others, but counted as having fatalities"
}

# Causes — column header -> canonical cause string. Multiple columns may
# be marked; we join them with ', '. Names use the MVA file's casing so
# the dropdown stays clean.
CAUSE_FROM_COL = {
    'using cell phone': 'Using cell phone',
    'reaching for object in the vehicle': 'Reaching for object in the vehicle',
    'speeding': 'Over speeding',                # match MVA
    'drink driving': 'Drunk driving',           # match MVA
    'tailgating': 'Tailgating',
    'not keeping left': 'Not keeping left',
    'not giving right of way': 'Not giving right of way',
    'un safe over taking': 'Unsafe overtaking',
    'unlicensed driving': 'Unlicensed driving',
    'reversing when unsafe': 'Reverse when unsafe',
    'unsafe u turn': 'Unsafe U-turn',
    'not having proper control': 'Not having proper control over the Vehicle',
    'not following general duty of driver': 'Not following general duty of driver',
    'sleep driving': 'Sleep-deprived driving',
    'ove loading': 'Overloading',
    # "Others" col in the cause block is handled specially (it's one of several "Others")
}

ROAD_CONDITION_FROM_COL = {
    'pothholes': 'Potholes',
    'icy or snowiy road': 'Icy or snowy road',
    'sinking road': 'Sinking road',
    'landslide': 'Landslide',
    'improper conning off of construction zones': 'Improper coning off construction zones',
    'falling boulders/pibbles': 'Falling boulders/pebbles',
}

WEATHER_FROM_COL = {
    'rain': 'Rain',
    'fog': 'Fog',
    'snow': 'Snow',
    'hail stone': 'Hail',
    'windy': 'Windy',
}

MECHANICAL_FROM_COL = {
    'brake failure': 'Brake failure',
    'tyre wheel failure': 'Tyre/wheel failure',
    'streeing failure': 'Steering failure',
    'light failure': 'Light failure',
}


def _resolve_block_others(headers):
    """
    The division sheets have FOUR identical 'Others' columns sitting at the
    end of the Cause, Road Condition, Weather and Mechanical Failure blocks.
    We need to know which 'Others' belongs to which block. Resolve by scanning
    the header row and tagging each 'others' occurrence by its position
    relative to the surrounding marker columns.

    Returns a dict {col_idx -> block_name} for the four 'Others' columns.
    """
    n = len(headers)
    # Anchors that mark the END of each known block, in order:
    cause_end = None
    road_end = None
    weather_end = None
    mech_end = None
    for i, h in enumerate(headers):
        nh = _norm(h)
        if nh == 'ove loading':
            cause_end = i
        elif nh == 'falling boulders/pibbles':
            road_end = i
        elif nh == 'windy':
            weather_end = i
        elif nh == 'light failure':
            mech_end = i

    # An 'Others' column at index i belongs to the block whose end is the
    # largest end-index < i.
    others_map = {}
    for i, h in enumerate(headers):
        if _norm(h) == 'others':
            # decide block
            if cause_end is not None and i == cause_end + 1:
                others_map[i] = 'cause'
            elif road_end is not None and i == road_end + 1:
                others_map[i] = 'road'
            elif weather_end is not None and i == weather_end + 1:
                others_map[i] = 'weather'
            elif mech_end is not None and i == mech_end + 1:
                others_map[i] = 'mechanical'
    return others_map


def process_divisions():
    rows = []
    division_files = sorted(UPLOADS.glob('Divison_*.xlsx')) + [UPLOADS / 'Traffic_Division.xlsx']

    for f in division_files:
        if not f.exists():
            continue
        if f.stem.startswith('Divison_'):
            div_name = f'Division {f.stem.split("_")[1]}'
        else:
            div_name = 'Traffic Division'

        xl = pd.ExcelFile(f)
        for sheet in xl.sheet_names:
            raw = pd.read_excel(f, sheet_name=sheet, header=None)
            if len(raw) < 2:
                continue

            # Find the header row (one containing 'Case No' somewhere)
            header_row = None
            for i in range(min(4, len(raw))):
                row = raw.iloc[i].astype(str).str.lower()
                if any('case no' in v for v in row if isinstance(v, str)):
                    header_row = i
                    break
            if header_row is None:
                continue

            headers = list(raw.iloc[header_row])
            normalized = [_norm(h) if pd.notna(h) else '' for h in headers]

            # Build column-name -> col-index map (use first occurrence for non-'others' names)
            col_idx = {}
            for i, n in enumerate(normalized):
                if n and n != 'others' and n not in col_idx:
                    col_idx[n] = i
            others_map = _resolve_block_others(headers)

            def col(label):
                """Find column index by normalized header label, return None if missing."""
                return col_idx.get(_norm(label))

            # Required columns (same name in every file)
            ic_case = col('case no')
            ic_place = col('place of occurrence')
            ic_dto = col('dto')
            ic_ps = col('name of p.s.')
            ic_veh_no = col('vehicle no.')
            ic_veh_type = col('type of vehicle')
            ic_death = col('no. of death')
            ic_injured = col('no of injured')
            # There are TWO columns labeled 'Time' (DTR time and DTO time). The
            # second occurrence is the time-of-occurrence we want.
            time_indices = [i for i, n in enumerate(normalized) if n == 'time']
            ic_time_occ = time_indices[1] if len(time_indices) >= 2 else None

            if ic_case is None or ic_place is None:
                continue

            data = raw.iloc[header_row + 1:].reset_index(drop=True).copy()
            if data.empty:
                continue

            def _to_case(v):
                try:
                    if v is None or pd.isna(v):
                        return None
                    return int(float(v))
                except (ValueError, TypeError):
                    return None

            data['_case'] = data[ic_case].map(_to_case)
            data['_case'] = data['_case'].ffill()
            data = data[data['_case'].notna()]
            if data.empty:
                continue

            for case_no, group in data.groupby('_case'):
                first = group.iloc[0]

                def cell(c):
                    """Safe cell access — returns None for missing columns or out-of-range indices."""
                    if c is None or c >= len(first):
                        return None
                    return first.iloc[c]

                place = clean_str(cell(ic_place))
                dto = cell(ic_dto)
                if place is None and (dto is None or pd.isna(dto)):
                    continue

                # ----- Accident types from the 5 marker columns -----
                acc_types = set()
                has_fatal_marker = False
                has_offroad_marker = False
                for header_label, mapped_type in ACCIDENT_TYPE_FROM_COL.items():
                    ci = col(header_label)
                    if ci is None:
                        continue
                    # ANY row in the group having this marker counts
                    marked = any(is_marked(r.iloc[ci]) for _, r in group.iterrows() if ci < len(r))
                    if marked:
                        acc_types.add(mapped_type)
                        if header_label == 'fatal':
                            has_fatal_marker = True
                        if header_label == 'off-road/ self':
                            has_offroad_marker = True
                if not acc_types:
                    acc_types.add('Others')
                accident_type = ', '.join(sorted(acc_types))

                # ----- Causes from the cause block -----
                causes = set()
                for header_label, canonical in CAUSE_FROM_COL.items():
                    ci = col(header_label)
                    if ci is None:
                        continue
                    if any(is_marked(r.iloc[ci]) for _, r in group.iterrows() if ci < len(r)):
                        causes.add(canonical)
                # Cause-block 'Others'
                cause_others_col = next((i for i, b in others_map.items() if b == 'cause'), None)
                if cause_others_col is not None:
                    if any(is_marked(r.iloc[cause_others_col]) for _, r in group.iterrows() if cause_others_col < len(r)):
                        causes.add('Others')
                # Special: if Off-road/Self marker was set, spec says cause = 'Off-road/Self'
                if has_offroad_marker:
                    causes.add('Off-road/Self')

                cause = ', '.join(sorted(causes)) if causes else None

                # ----- Road condition / Weather / Mechanical -----
                road_conditions = set()
                for header_label, canonical in ROAD_CONDITION_FROM_COL.items():
                    ci = col(header_label)
                    if ci is None: continue
                    if any(is_marked(r.iloc[ci]) for _, r in group.iterrows() if ci < len(r)):
                        road_conditions.add(canonical)
                road_others = next((i for i, b in others_map.items() if b == 'road'), None)
                if road_others is not None and any(is_marked(r.iloc[road_others]) for _, r in group.iterrows() if road_others < len(r)):
                    road_conditions.add('Others')

                weather = set()
                for header_label, canonical in WEATHER_FROM_COL.items():
                    ci = col(header_label)
                    if ci is None: continue
                    if any(is_marked(r.iloc[ci]) for _, r in group.iterrows() if ci < len(r)):
                        weather.add(canonical)
                weather_others = next((i for i, b in others_map.items() if b == 'weather'), None)
                if weather_others is not None and any(is_marked(r.iloc[weather_others]) for _, r in group.iterrows() if weather_others < len(r)):
                    weather.add('Others')

                mechanical = set()
                for header_label, canonical in MECHANICAL_FROM_COL.items():
                    ci = col(header_label)
                    if ci is None: continue
                    if any(is_marked(r.iloc[ci]) for _, r in group.iterrows() if ci < len(r)):
                        mechanical.add(canonical)
                mech_others = next((i for i, b in others_map.items() if b == 'mechanical'), None)
                if mech_others is not None and any(is_marked(r.iloc[mech_others]) for _, r in group.iterrows() if mech_others < len(r)):
                    mechanical.add('Others')

                # ----- Deaths / injured -----
                deaths = 0
                injured = 0
                if ic_death is not None:
                    for _, r in group.iterrows():
                        if ic_death < len(r):
                            deaths += to_int(r.iloc[ic_death])
                if ic_injured is not None:
                    for _, r in group.iterrows():
                        if ic_injured < len(r):
                            injured += to_int(r.iloc[ic_injured])
                # If "Fatal" marker is set but No. of Death is blank, assume at least 1 death
                if has_fatal_marker and deaths == 0:
                    deaths = 1

                vehicle_type = clean_str(cell(ic_veh_type))
                vehicle_no = clean_str(cell(ic_veh_no))
                police_station = clean_str(cell(ic_ps))

                # Time
                time_val = cell(ic_time_occ) if ic_time_occ is not None else None
                # Date
                date = parse_date(dto)
                year = 2021
                if date:
                    try:
                        year = int(date[:4])
                    except ValueError:
                        pass

                rows.append({
                    'id': f'div-{f.stem}-{sheet}-{int(case_no)}',
                    'source': 'division',
                    'year': year,
                    'date': date,
                    'time': parse_time(time_val),
                    'division': canonical_division(div_name),
                    'dzongkhag': canonical_dzongkhag(clean_str(sheet)),
                    'gewog': None,
                    'location': place,
                    'lat': None,
                    'lon': None,
                    'accident_type': accident_type,
                    'cause': cause,
                    'accident_spot': None,            # not captured in 2021 sheets
                    'vehicle_type': vehicle_type,
                    'vehicle_no': vehicle_no,
                    'deaths': deaths,
                    'injured': injured,
                    'place': place,
                    'police_station': police_station,
                    'case_no': str(int(case_no)),
                    'status_of_victim': victim_status_label(deaths, injured),
                    'type_of_victim': [],            # not captured in 2021 sheets
                    'road_condition': ', '.join(sorted(road_conditions)) if road_conditions else None,
                    'weather': ', '.join(sorted(weather)) if weather else None,
                    'mechanical_failure': ', '.join(sorted(mechanical)) if mechanical else None,
                })
    return rows


def main():
    write_geojson()
    mva = process_mva()
    div = process_divisions()
    all_rows = mva + div
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w') as fp:
        json.dump(all_rows, fp, indent=None, separators=(',', ':'))
    print(f'Total accidents: {len(all_rows)} (MVA: {len(mva)}, Division: {len(div)})')
    print(f'Wrote: {OUT} ({OUT.stat().st_size / 1024:.1f} KB)')

    by_year = {}
    geocoded = 0
    for r in all_rows:
        by_year[r['year']] = by_year.get(r['year'], 0) + 1
        if r['lat'] and r['lon']:
            geocoded += 1
    print('By year:', sorted(by_year.items()))
    print(f'Geocoded: {geocoded}')

    # Stats for verification
    from collections import Counter
    print('\nStatus of Victim:')
    for v, n in Counter(r['status_of_victim'] for r in all_rows).most_common():
        print(f'  {v}: {n}')

    print('\nRoad conditions (2021 only):')
    for v, n in Counter(r['road_condition'] for r in all_rows if r['road_condition']).most_common(15):
        print(f'  {v}: {n}')

    print('\nWeather (2021 only):')
    for v, n in Counter(r['weather'] for r in all_rows if r['weather']).most_common(15):
        print(f'  {v}: {n}')

    print('\nMechanical failure (2021 only):')
    for v, n in Counter(r['mechanical_failure'] for r in all_rows if r['mechanical_failure']).most_common(15):
        print(f'  {v}: {n}')


if __name__ == '__main__':
    main()
