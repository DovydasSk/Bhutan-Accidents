"""
ETL: Normalize Bhutan accident data from heterogeneous Excel files into a single JSON.

Two data sources:
1. MVA_2022-2025.xlsx -> sheets per year (2022, 2023, 2024, 2025). Has coordinates.
2. Divison_*.xlsx + Traffic_Division.xlsx -> 2021 data per division. NO coordinates,
   uses "Place of Occurrence" string and categorical flag columns.

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
OUT = Path('/home/claude/bhutan-accidents/public/data/accidents.json')

# ---------- Bhutan boundary polygon (hand-coded approximation) ----------
# Used to filter out records with bogus coordinates (data entry errors that
# put accidents outside the country).
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
    """Write the Bhutan boundary polygon as GeoJSON for the frontend map."""
    out = Path('/home/claude/bhutan-accidents/public/data/bhutan.geojson')
    out.write_text(json.dumps({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"name": "Bhutan"},
            "geometry": {"type": "Polygon", "coordinates": [BHUTAN_POLYGON_COORDS]},
        }],
    }))


# ---------- Canonical Division and Dzongkhag (Region) names ----------
# The Royal Bhutan Police uses 15 divisions. MVA data labels them with named
# Roman numerals (e.g. "Division I Paro"), the 2021 division files just say
# "Division 1". Both refer to the same physical division. Map all to a single
# canonical name so the filter dropdown is clean.
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


# Map sheet names in division files (often police-station/dungkhag names) to
# canonical dzongkhags (Bhutan's 20 official districts).
DZONGKHAG_MAP = {
    # Variants of canonical dzongkhag names
    'Bumthang': 'Bumthang',
    'Chukha': 'Chukha',
    'Dagana': 'Dagana',
    'Gasa': 'Gasa',
    'Haa': 'Haa',
    'Lhuentse': 'Lhuentse',
    'Lhuntse': 'Lhuentse',
    'Mongar': 'Mongar',
    'Paro': 'Paro',
    'Pemagatshel': 'Pemagatshel',
    'P,gatshel': 'Pemagatshel',
    'Punakha': 'Punakha',
    'Samdrup Jongkhar': 'Samdrup Jongkhar',
    'S.jongkhar': 'Samdrup Jongkhar',
    'Samtse': 'Samtse',
    'Sarpang': 'Sarpang',
    'Thimphu': 'Thimphu',
    'Trashigang': 'Trashigang',
    'Trashiyangtse': 'Trashiyangtse',
    'Trongsa': 'Trongsa',
    'Tsirang': 'Tsirang',
    'Wangduephodrang': 'Wangdue Phodrang',
    'Wangdue': 'Wangdue Phodrang',
    'Zhemgang': 'Zhemgang',
    # Sub-district / police-station sheet names mapped up to their dzongkhag
    'Phuntsholing': 'Chukha',
    'Gedu': 'Chukha',
    'Tsimasham': 'Chukha',
    'Pasakha': 'Chukha',
    'Gelephu': 'Sarpang',
    'Panbang': 'Zhemgang',
    'Gyelposhing': 'Mongar',
    'Weringla': 'Mongar',
    'Dorokha. D.chen': 'Samtse',
    'Norbugang.Chmari': 'Samtse',
    'Tashicholing.sibsoo': 'Samtse',
    'Pendeling': 'Samtse',
    'Pendeling ': 'Samtse',
    'L.zingkha': 'Dagana',
    'Wamrong': 'Trashigang',
    'Saktang': 'Trashigang',
    'Thimshing': 'Trashigang',
    'Samdrupcholing': 'Samdrup Jongkhar',
    'Jomotsangkha': 'Samdrup Jongkhar',
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
    """Return ISO date string YYYY-MM-DD or None."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if isinstance(val, pd.Timestamp):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if not s or s.lower() == 'nan':
        return None
    # Try common formats
    for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%d-%m-%y'):
        try:
            return datetime.strptime(s.split(' ')[0], fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


def parse_time(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    if not s or s.lower() == 'nan':
        return None
    # e.g. "2030 hrs." or "1336 hrs" or "1030 hrs"
    m = re.search(r'(\d{3,4})', s)
    if m:
        t = m.group(1).zfill(4)
        return f'{t[:2]}:{t[2:]}'
    return None


def to_float(v):
    try:
        if v is None or pd.isna(v):
            return None
        f = float(v)
        return f
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


# ---------- MVA 2022-2025 (clean, geocoded) ----------

def process_mva():
    """Process MVA_2022-2025 file. Each row = one victim entry; we aggregate by Sl.No within year+division."""
    rows = []
    file = UPLOADS / 'MVA_2022-2025.xlsx'
    for year in ['2022', '2023', '2024', '2025']:
        df = pd.read_excel(file, sheet_name=year, header=1)
        # group consecutive rows with same Sl.No into a single accident
        # but Sl.No may repeat for multiple victims per accident. Use forward-fill on Sl.No.
        df['Sl.No.'] = df['Sl.No.'].ffill()
        # Forward fill the accident-level fields (the spreadsheet leaves them blank for additional victims)
        accident_cols = ['Division', 'Dzongkhag', 'Gewog', 'Location', 'Latitude', 'Longitude',
                         'Date of Occurance', 'Time of Occurance', 'Accident Type',
                         'Cause of Accident', 'Accident spot', 'Vehicle Type', 'Vehicle No.']
        for c in accident_cols:
            if c in df.columns:
                df[c] = df[c].ffill()

        # Group by Sl.No.
        for sl_no, group in df.groupby('Sl.No.'):
            first = group.iloc[0]
            victims = group[['Status of Victim', 'Type of victim']].dropna(how='all')
            deaths = int((victims['Status of Victim'].astype(str).str.lower() == 'death').sum())
            injured = int((victims['Status of Victim'].astype(str).str.lower() == 'injured').sum())

            lat = to_float(first.get('Latitude'))
            lon = to_float(first.get('Longitude'))

            # Filter out coordinates outside Bhutan (data entry errors)
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
                'place': clean_str(first.get('Location')),  # unified location filter
            })
    return rows


# ---------- Division files (2021, no coords) ----------

# Column indices in division layout (header in row 0):
# 0: Name of P.S., 1: Month, 2: Case No, 3: Despetch No, 4: Place of Occurrence,
# 5: DTR (date of report), 6: Time, 7: DTO (date of occurrence), 8: Time,
# 9: Off-road/Self, 10: Collision, 11: Hit and Run, 12: Pedestrian, 13: Fatal,
# 14: Driver's name, ... 22: No. of Death, 23: No of Injured

ACCIDENT_TYPE_COLS = {
    9: 'Off-road / Self',
    10: 'Collision',
    11: 'Hit and Run',
    12: 'Pedestrian',
    13: 'Fatal',
}

def process_divisions():
    """
    Layout per sheet:
      - 1-2 top rows hold groupings (mostly empty, with occasional merged labels like 'Human Error')
      - The header row contains 'Case No' in col 2, 'Place of Occurrence' in col 4, etc.
      - Data starts on the next row.
      - Multi-row accidents: accident-level fields appear only on the first row of a case;
        subsequent rows are extra victims/drivers for the SAME case (NaN in case_no column).
    """
    rows = []
    division_files = sorted(UPLOADS.glob('Divison_*.xlsx')) + [UPLOADS / 'Traffic_Division.xlsx']

    # Column indices (constant across division files)
    COL_PS = 0
    COL_CASE = 2
    COL_PLACE = 4
    COL_DTO = 7
    COL_TIME_OCC = 8
    COL_VEH_NO = 20
    COL_VEH_TYPE = 21
    COL_DEATH = 22
    COL_INJURED = 23

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

            # Find header row: scan first 4 rows for one containing 'Case No' in col 2
            header_row = None
            for i in range(min(4, len(raw))):
                v = raw.iloc[i, COL_CASE] if COL_CASE < raw.shape[1] else None
                if isinstance(v, str) and 'case no' in v.lower():
                    header_row = i
                    break
            if header_row is None:
                continue

            data = raw.iloc[header_row + 1:].reset_index(drop=True).copy()
            if data.empty:
                continue

            # Helper: case_no as integer where present (NaN for continuation rows)
            def _to_case(v):
                try:
                    if v is None or pd.isna(v):
                        return None
                    return int(float(v))
                except (ValueError, TypeError):
                    return None

            data['_case'] = data[COL_CASE].map(_to_case)
            # Forward-fill the case marker so continuation rows attach to their parent
            data['_case'] = data['_case'].ffill()
            # Drop any rows before the first real case (e.g. blank header padding)
            data = data[data['_case'].notna()]
            if data.empty:
                continue

            for case_no, group in data.groupby('_case'):
                first = group.iloc[0]
                place = clean_str(first.iloc[COL_PLACE])
                dto = first.iloc[COL_DTO]
                time = first.iloc[COL_TIME_OCC]

                if place is None and (pd.isna(dto) or dto is None):
                    continue

                acc_types = []
                for idx, label in ACCIDENT_TYPE_COLS.items():
                    val = None
                    for _, r in group.iterrows():
                        v = r.iloc[idx] if idx < len(r) else None
                        if v is not None and not pd.isna(v):
                            val = v
                            break
                    if val is not None:
                        try:
                            if float(val) > 0:
                                acc_types.append(label)
                        except (ValueError, TypeError):
                            acc_types.append(label)
                accident_type = ', '.join(acc_types) if acc_types else None

                deaths = 0
                injured = 0
                for _, r in group.iterrows():
                    deaths += to_int(r.iloc[COL_DEATH]) if COL_DEATH < len(r) else 0
                    injured += to_int(r.iloc[COL_INJURED]) if COL_INJURED < len(r) else 0

                vehicle_type = clean_str(first.iloc[COL_VEH_TYPE]) if COL_VEH_TYPE < len(first) else None
                vehicle_no = clean_str(first.iloc[COL_VEH_NO]) if COL_VEH_NO < len(first) else None
                police_station = clean_str(first.iloc[COL_PS])

                date = parse_date(dto)
                year = None
                if date:
                    try:
                        year = int(date[:4])
                    except ValueError:
                        pass
                if year is None:
                    year = 2021

                rows.append({
                    'id': f'div-{f.stem}-{sheet}-{int(case_no)}',
                    'source': 'division',
                    'year': year,
                    'date': date,
                    'time': parse_time(time),
                    'division': canonical_division(div_name),
                    'dzongkhag': canonical_dzongkhag(clean_str(sheet)),
                    'gewog': None,
                    'location': place,
                    'lat': None,
                    'lon': None,
                    'accident_type': accident_type,
                    'cause': None,
                    'accident_spot': None,
                    'vehicle_type': vehicle_type,
                    'vehicle_no': vehicle_no,
                    'deaths': deaths,
                    'injured': injured,
                    'place': place,
                    'police_station': police_station,
                    'case_no': str(int(case_no)),
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

    # Quick stats
    by_year = {}
    geocoded = 0
    for r in all_rows:
        by_year[r['year']] = by_year.get(r['year'], 0) + 1
        if r['lat'] and r['lon']:
            geocoded += 1
    print('By year:', sorted(by_year.items()))
    print(f'Geocoded (after Bhutan boundary filter): {geocoded}')

    from collections import Counter
    print('\nDivisions in output:')
    for d, n in sorted(Counter(r['division'] for r in all_rows if r['division']).items()):
        print(f'  {d}: {n}')
    print('\nRegions (Dzongkhags) in output:')
    for d, n in sorted(Counter(r['dzongkhag'] for r in all_rows if r['dzongkhag']).items()):
        print(f'  {d}: {n}')


if __name__ == '__main__':
    main()
