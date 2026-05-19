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

const DEFAULT_FILTERS = {
  year: 'all',
  accidentType: 'all',
  cause: 'all',
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
  // Severity checkboxes (showAll / showFatal / showInjured) do NOT narrow this —
  // they only decide which subset gets rendered on the map.
  const filtered = useMemo(() => {
    const tStart = filters.timeStart;
    const tEnd = filters.timeEnd;
    // If the slider covers the full day, skip the time filter altogether (faster + lets records with no time pass through)
    const timeFilterActive = !(tStart === 0 && tEnd === 24);

    return allData.filter((a) => {
      if (filters.year !== 'all' && a.year !== filters.year) return false;
      if (filters.accidentType !== 'all' && a.accident_type !== filters.accidentType) return false;
      if (filters.cause !== 'all' && a.cause !== filters.cause) return false;
      if (filters.division !== 'all' && a.division !== filters.division) return false;
      if (filters.dzongkhag !== 'all' && a.dzongkhag !== filters.dzongkhag) return false;
      if (filters.gewog !== 'all' && a.gewog !== filters.gewog) return false;
      if (filters.place) {
        const haystack = `${a.place || ''} ${a.location || ''} ${a.gewog || ''}`.toLowerCase();
        if (!haystack.includes(filters.place.toLowerCase())) return false;
      }
      if (timeFilterActive) {
        const h = parseHour(a.time);
        if (h == null) return false;  // exclude records without parseable time when slider is active
        // Window is [tStart, tEnd) — accept hours strictly less than tEnd
        if (h < tStart || h >= tEnd) return false;
      }
      return true;
    });
  }, [allData, filters]);

  // What goes on the map: geocoded points only (2022–2025 MVA data) further
  // filtered by the severity layer checkboxes.
  const mapData = useMemo(() => {
    const points = filtered.filter((a) => a.lat != null && a.lon != null);
    return points.filter((a) => {
      const fatal = (a.deaths || 0) > 0;
      const hasInjured = (a.injured || 0) > 0;
      if (filters.showAll) return true;
      if (filters.showFatal && fatal) return true;
      if (filters.showInjured && hasInjured) return true;
      return false;
    });
  }, [filtered, filters.showAll, filters.showFatal, filters.showInjured]);

  const optionLists = useMemo(() => {
    const years = [...new Set(allData.map((a) => a.year).filter((y) => y >= 2021 && y <= 2025))].sort();
    const accidentTypes = [...new Set(allData.map((a) => a.accident_type).filter(Boolean))].sort();
    const causes = [...new Set(allData.map((a) => a.cause).filter(Boolean))].sort();
    const divisions = [...new Set(allData.map((a) => a.division).filter(Boolean))].sort();
    const dzongkhags = [...new Set(allData.map((a) => a.dzongkhag).filter(Boolean))].sort();
    const gewogs = [...new Set(allData.map((a) => a.gewog).filter(Boolean))].sort();

    // Build autocomplete pool: union of `place`/`location` strings + gewog names.
    // We dedupe case-insensitively but keep the original casing for display.
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

    return { years, accidentTypes, causes, divisions, dzongkhags, gewogs, places };
  }, [allData]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
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
          reset={resetFilters}
          options={optionLists}
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
