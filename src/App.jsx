import { useEffect, useMemo, useState } from 'react';
import KPICards from './components/KPICards.jsx';
import Filters from './components/Filters.jsx';
import AccidentMap from './components/AccidentMap.jsx';
import AccidentCharts from './components/AccidentCharts.jsx';
import AccidentTable from './components/AccidentTable.jsx';

export default function App() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    year: 'all',           // 'all' or number
    accidentType: 'all',
    division: 'all',
    dzongkhag: 'all',
    place: '',
    // Map display layer toggles (independent of base year/region filters)
    showAll: true,
    showFatal: true,
    showInjured: true,
  });

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

  // Base filtered set — applies year + categorical filters + free-text place search.
  // Severity checkboxes (showAll / showFatal / showInjured) do NOT narrow this —
  // they only decide which subset of these records gets rendered on the map.
  // KPI cards, charts and the table all use the base filtered set.
  const filtered = useMemo(() => {
    return allData.filter((a) => {
      if (filters.year !== 'all' && a.year !== filters.year) return false;
      if (filters.accidentType !== 'all' && a.accident_type !== filters.accidentType) return false;
      if (filters.division !== 'all' && a.division !== filters.division) return false;
      if (filters.dzongkhag !== 'all' && a.dzongkhag !== filters.dzongkhag) return false;
      if (filters.place) {
        const haystack = `${a.place || ''} ${a.location || ''} ${a.gewog || ''}`.toLowerCase();
        if (!haystack.includes(filters.place.toLowerCase())) return false;
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
    const divisions = [...new Set(allData.map((a) => a.division).filter(Boolean))].sort();
    const dzongkhags = [...new Set(allData.map((a) => a.dzongkhag).filter(Boolean))].sort();
    return { years, accidentTypes, divisions, dzongkhags };
  }, [allData]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const resetFilters = () =>
    setFilters({
      year: 'all',
      accidentType: 'all',
      division: 'all',
      dzongkhag: 'all',
      place: '',
      showAll: true,
      showFatal: true,
      showInjured: true,
    });

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
              </div>
              <span className="panel-meta">
                {activeTab === 'map'
                  ? has2021Selected
                    ? '2021 records have no coordinates — switch year or use Table view'
                    : `${mapData.length.toLocaleString()} points on map · ${filtered.length.toLocaleString()} in selection`
                  : `${filtered.length.toLocaleString()} records`}
              </span>
            </div>
            <div className="panel-body" style={{ padding: activeTab === 'map' ? 0 : 16 }}>
              {activeTab === 'map' ? (
                <AccidentMap data={mapData} />
              ) : (
                <AccidentTable data={filtered} />
              )}
            </div>
          </div>

          <AccidentCharts data={filtered} />
        </div>
      </div>
    </div>
  );
}
