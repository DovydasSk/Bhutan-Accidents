import { useEffect, useMemo, useState } from 'react';
import KPICards from './components/KPICards.jsx';
import Filters from './components/Filters.jsx';
import AccidentMap from './components/AccidentMap.jsx';
import AccidentCharts from './components/AccidentCharts.jsx';
import AccidentTable from './components/AccidentTable.jsx';
import AccidentInsights from './components/AccidentInsights.jsx';

/** Parse "HH:MM" -> hour number 0..23, or null. "24:00" -> 0. */
function parseHour(time) {
  if (!time || typeof time !== 'string') return null;
  const m = time.match(/^(\d{1,2}):/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (h === 24) h = 0;
  if (h < 0 || h > 23) return null;
  return h;
}

/**
 * Check whether a stored field "matches" a selected filter value.
 * Several fields in our data may contain multiple values joined by ", "
 * (e.g. cause = "Drunk driving, Tailgating"). We treat the field as a
 * set of comma-separated tokens and match against any of them.
 */
function multiMatch(fieldValue, selected) {
  if (selected === 'all') return true;
  if (!fieldValue) return false;
  const tokens = String(fieldValue).split(',').map((s) => s.trim());
  return tokens.includes(selected);
}

const DEFAULT_FILTERS = {
  year: 'all',
  accidentType: 'all',
  cause: 'all',
  accidentSpot: 'all',
  vehicleType: 'all',
  statusOfVictim: 'all',
  typeOfVictim: 'all',
  // 2021-only filters
  roadCondition: 'all',
  weather: 'all',
  mechanicalFailure: 'all',
  division: 'all',
  dzongkhag: 'all',
  gewog: 'all',
  place: '',
  // Time-of-day window (hour range, 0..24)
  timeStart: 0,
  timeEnd: 24,
  // Map display layer toggles (independent of base filters)
  showAll: true,
  showFatal: true,
  showInjured: true,
  showVehicleDamage: true,
};

export default function App() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('map');

  useEffect(() => {
    fetch('/data/accidents.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setAllData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Base filtered set — applies year + categorical filters + free-text place search + time-of-day window.
  // Map severity checkboxes (showAll / showFatal / showInjured / showVehicleDamage) do NOT narrow this —
  // they only decide which subset gets rendered on the map.
  const filtered = useMemo(() => {
    const tStart = filters.timeStart;
    const tEnd = filters.timeEnd;
    const timeFilterActive = !(tStart === 0 && tEnd === 24);

    return allData.filter((a) => {
      if (filters.year !== 'all' && a.year !== filters.year) return false;
      if (!multiMatch(a.accident_type, filters.accidentType)) return false;
      if (!multiMatch(a.cause, filters.cause)) return false;
      if (filters.accidentSpot !== 'all' && a.accident_spot !== filters.accidentSpot) return false;
      if (filters.vehicleType !== 'all' && a.vehicle_type !== filters.vehicleType) return false;
      if (filters.statusOfVictim !== 'all' && a.status_of_victim !== filters.statusOfVictim) return false;
      if (filters.typeOfVictim !== 'all') {
        const arr = Array.isArray(a.type_of_victim) ? a.type_of_victim : [];
        if (!arr.includes(filters.typeOfVictim)) return false;
      }
      if (!multiMatch(a.road_condition, filters.roadCondition)) return false;
      if (!multiMatch(a.weather, filters.weather)) return false;
      if (!multiMatch(a.mechanical_failure, filters.mechanicalFailure)) return false;
      if (filters.division !== 'all' && a.division !== filters.division) return false;
      if (filters.dzongkhag !== 'all' && a.dzongkhag !== filters.dzongkhag) return false;
      if (filters.gewog !== 'all' && a.gewog !== filters.gewog) return false;
      if (filters.place) {
        const haystack = `${a.place || ''} ${a.location || ''} ${a.gewog || ''}`.toLowerCase();
        if (!haystack.includes(filters.place.toLowerCase())) return false;
      }
      if (timeFilterActive) {
        const h = parseHour(a.time);
        if (h == null) return false;
        if (h < tStart || h >= tEnd) return false;
      }
      return true;
    });
  }, [allData, filters]);

  // What goes on the map: geocoded points only, filtered by the severity layer checkboxes.
  // The four toggles work as a union — each checkbox adds its category to the map.
  // showAll acts as a master switch: when on, everything that survived `filtered` shows.
  const mapData = useMemo(() => {
    const points = filtered.filter((a) => a.lat != null && a.lon != null);
    return points.filter((a) => {
      const fatal = (a.deaths || 0) > 0;
      const hasInjured = !fatal && (a.injured || 0) > 0;
      const damageOnly = !fatal && !hasInjured;
      if (filters.showAll) return true;
      if (filters.showFatal && fatal) return true;
      if (filters.showInjured && hasInjured) return true;
      if (filters.showVehicleDamage && damageOnly) return true;
      return false;
    });
  }, [filtered, filters.showAll, filters.showFatal, filters.showInjured, filters.showVehicleDamage]);

  // Build dropdown option lists. For multi-value fields (cause / accident_type /
  // road_condition / weather / mechanical_failure) we tokenize on ", " so the
  // dropdown shows atomic values instead of joined strings like "Fog, Rain".
  const optionLists = useMemo(() => {
    const years = [...new Set(allData.map((a) => a.year).filter((y) => y >= 2021 && y <= 2025))].sort();

    const splitUnique = (key) => {
      const set = new Set();
      for (const a of allData) {
        const v = a[key];
        if (!v) continue;
        for (const tok of String(v).split(',')) {
          const t = tok.trim();
          if (t) set.add(t);
        }
      }
      return [...set].sort();
    };

    const accidentTypes = splitUnique('accident_type');
    const causes = splitUnique('cause');
    const roadConditions = splitUnique('road_condition');
    const weathers = splitUnique('weather');
    const mechanicalFailures = splitUnique('mechanical_failure');

    const accidentSpots = [...new Set(allData.map((a) => a.accident_spot).filter(Boolean))].sort();
    const vehicleTypes = [...new Set(allData.map((a) => a.vehicle_type).filter(Boolean))].sort();
    const statusesOfVictim = [...new Set(allData.map((a) => a.status_of_victim).filter(Boolean))].sort();
    const typesOfVictim = (() => {
      const set = new Set();
      for (const a of allData) {
        if (Array.isArray(a.type_of_victim)) {
          for (const t of a.type_of_victim) {
            const x = String(t).trim();
            if (x) set.add(x);
          }
        }
      }
      return [...set].sort();
    })();
    const divisions = [...new Set(allData.map((a) => a.division).filter(Boolean))].sort();
    const dzongkhags = [...new Set(allData.map((a) => a.dzongkhag).filter(Boolean))].sort();
    const gewogs = [...new Set(allData.map((a) => a.gewog).filter(Boolean))].sort();

    // Place autocomplete pool: place/location/gewog (case-insensitive dedupe)
    const placeMap = new Map();
    const add = (s) => {
      if (!s || typeof s !== 'string') return;
      const trimmed = s.trim();
      if (trimmed.length < 2) return;
      const key = trimmed.toLowerCase();
      if (!placeMap.has(key)) placeMap.set(key, trimmed);
    };
    for (const a of allData) {
      add(a.place);
      add(a.location);
      add(a.gewog);
    }
    const places = [...placeMap.values()].sort((a, b) => a.localeCompare(b));

    return {
      years, accidentTypes, causes, accidentSpots, vehicleTypes,
      statusesOfVictim, typesOfVictim,
      roadConditions, weathers, mechanicalFailures,
      divisions, dzongkhags, gewogs, places,
    };
  }, [allData]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  /**
   * When the year filter changes, also clear any 2021-only filter values that
   * would otherwise become invisible (and silently keep filtering) once the
   * UI hides them. We only clear if leaving 2021.
   */
  const setYearFilter = (newYear) => {
    setFilters((f) => {
      const leaving2021 = f.year === 2021 && newYear !== 2021;
      if (leaving2021) {
        return { ...f, year: newYear, roadCondition: 'all', weather: 'all', mechanicalFailure: 'all' };
      }
      return { ...f, year: newYear };
    });
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading accident data…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="app">
        <div className="loading">Failed to load data: {error}</div>
      </div>
    );
  }

  const has2021Selected = filters.year === 2021;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Bhutan Traffic Accidents</h1>
          <div className="subtitle">
            Data analyst dashboard · {allData.length.toLocaleString()} total records ·{' '}
            {filtered.length.toLocaleString()} after filters
          </div>
        </div>
      </header>

      <div className="main">
        <Filters
          filters={filters}
          setFilter={setFilter}
          setYearFilter={setYearFilter}
          reset={resetFilters}
          options={optionLists}
          show2021Fields={has2021Selected}
        />

        <div className="content">
          <KPICards data={filtered} />

          <div className="panel">
            <div className="panel-header">
              <div className="tabs" style={{ border: 'none', margin: 0 }}>
                <button
                  className={`tab ${activeTab === 'map' ? 'active' : ''}`}
                  onClick={() => setActiveTab('map')}
                >
                  Map view
                </button>
                <button
                  className={`tab ${activeTab === 'table' ? 'active' : ''}`}
                  onClick={() => setActiveTab('table')}
                >
                  Table view
                </button>
                <button
                  className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
                  onClick={() => setActiveTab('insights')}
                >
                  Insights
                </button>
              </div>
              <span className="panel-meta">
                {activeTab === 'map'
                  ? has2021Selected
                    ? '2021 records have no coordinates — switch year or use Table view'
                    : `${mapData.length.toLocaleString()} points on map · ${filtered.length.toLocaleString()} in selection`
                  : activeTab === 'table'
                    ? `${filtered.length.toLocaleString()} records`
                    : `Based on ${filtered.length.toLocaleString()} records in current selection`}
              </span>
            </div>
            <div className="panel-body" style={{ padding: activeTab === 'map' ? 0 : 16 }}>
              {activeTab === 'map' && <AccidentMap data={mapData} />}
              {activeTab === 'table' && <AccidentTable data={filtered} />}
              {activeTab === 'insights' && <AccidentInsights data={filtered} />}
            </div>
          </div>

          <AccidentCharts data={filtered} />
        </div>
      </div>
    </div>
  );
}
