export default function Filters({ filters, setFilter, reset, options }) {
  const yearPills = ['all', ...options.years];

  return (
    <aside className="sidebar">
      <h2>Filters</h2>

      <div className="filter-group">
        <label>Year</label>
        <div className="year-pills">
          {yearPills.map((y) => (
            <button
              key={y}
              className={`year-pill ${filters.year === y ? 'active' : ''}`}
              onClick={() => setFilter('year', y)}
            >
              {y === 'all' ? 'All' : y}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label>Show on map</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={filters.showAll}
              onChange={(e) => setFilter('showAll', e.target.checked)}
            />
            <span>All traffic accidents</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={filters.showFatal}
              onChange={(e) => setFilter('showFatal', e.target.checked)}
            />
            <span>Fatal accidents</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={filters.showInjured}
              onChange={(e) => setFilter('showInjured', e.target.checked)}
            />
            <span>Injuries</span>
          </label>
        </div>
      </div>

      <div className="filter-group">
        <label>Accident type</label>
        <select
          value={filters.accidentType}
          onChange={(e) => setFilter('accidentType', e.target.value)}
        >
          <option value="all">All types</option>
          {options.accidentTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Division</label>
        <select
          value={filters.division}
          onChange={(e) => setFilter('division', e.target.value)}
        >
          <option value="all">All divisions</option>
          {options.divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Region</label>
        <select
          value={filters.dzongkhag}
          onChange={(e) => setFilter('dzongkhag', e.target.value)}
        >
          <option value="all">All regions</option>
          {options.dzongkhags.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Place of occurrence</label>
        <input
          type="text"
          placeholder="Search location…"
          value={filters.place}
          onChange={(e) => setFilter('place', e.target.value)}
        />
      </div>

      <button className="reset-btn" onClick={reset}>
        Reset filters
      </button>
    </aside>
  );
}
