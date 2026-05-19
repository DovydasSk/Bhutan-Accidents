import { useEffect, useMemo, useRef, useState } from 'react';

function fmtHour(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Dual-thumb range slider for picking an hour-of-day window [start, end].
 */
function TimeRangeSlider({ value, onChange }) {
  const [start, end] = value;
  const min = 0;
  const max = 24;

  const handleStart = (e) => {
    const v = Math.min(Number(e.target.value), end);
    onChange([v, end]);
  };
  const handleEnd = (e) => {
    const v = Math.max(Number(e.target.value), start);
    onChange([start, v]);
  };

  const leftPct = ((start - min) / (max - min)) * 100;
  const rightPct = ((end - min) / (max - min)) * 100;

  return (
    <div className="time-range">
      <div className="time-range-values">
        <span>{fmtHour(start)}</span>
        <span>{fmtHour(end)}</span>
      </div>
      <div className="time-range-slider">
        <div className="time-range-track" />
        <div className="time-range-fill" style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }} />
        <input type="range" min={min} max={max} step={1} value={start} onChange={handleStart} />
        <input type="range" min={min} max={max} step={1} value={end} onChange={handleEnd} />
      </div>
      <div className="time-range-labels">
        <span>00:00</span><span>12:00</span><span>24:00</span>
      </div>
    </div>
  );
}

/** Autocomplete text input for "Place of occurrence". */
function PlaceAutocomplete({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const starts = [];
    const contains = [];
    for (const s of suggestions) {
      const lower = s.toLowerCase();
      if (lower === q) continue;
      if (lower.startsWith(q)) starts.push(s);
      else if (lower.includes(q)) contains.push(s);
      if (starts.length + contains.length >= 30) break;
    }
    return [...starts, ...contains].slice(0, 10);
  }, [value, suggestions]);

  useEffect(() => { setHighlight(0); }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (s) => { onChange(s); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const renderItem = (s) => {
    const q = value.trim();
    if (!q) return s;
    const idx = s.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return s;
    return (
      <>{s.slice(0, idx)}<span className="match">{s.slice(idx, idx + q.length)}</span>{s.slice(idx + q.length)}</>
    );
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        type="text"
        placeholder="Search location…"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="autocomplete-list" role="listbox">
          {matches.map((s, i) => (
            <div
              key={s}
              role="option"
              aria-selected={i === highlight}
              className={`autocomplete-item ${i === highlight ? 'highlighted' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              {renderItem(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny helper for the standard "label + select" filter group. */
function SelectFilter({ label, value, onChange, all = 'all', allLabel, options }) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={all}>{allLabel || `All ${label.toLowerCase()}`}</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );
}

export default function Filters({ filters, setFilter, setYearFilter, reset, options, show2021Fields }) {
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
              onClick={() => setYearFilter(y)}
            >
              {y === 'all' ? 'All' : y}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label>Show on map</label>
        <div className="show-on-map">
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.showAll}
              onChange={(e) => setFilter('showAll', e.target.checked)} />
            <span className="dot" style={{ background: '#2563eb' }} />
            <span>All traffic accidents</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.showFatal}
              onChange={(e) => setFilter('showFatal', e.target.checked)} />
            <span className="dot" style={{ background: '#dc2626' }} />
            <span>Fatal accidents</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.showInjured}
              onChange={(e) => setFilter('showInjured', e.target.checked)} />
            <span className="dot" style={{ background: '#f59e0b' }} />
            <span>Injuries</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.showVehicleDamage}
              onChange={(e) => setFilter('showVehicleDamage', e.target.checked)} />
            <span className="dot" style={{ background: '#64748b' }} />
            <span>Vehicle damage only</span>
          </label>
        </div>
      </div>

      <div className="filter-group">
        <label>
          Time of occurrence{' '}
          <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>
            ({fmtHour(filters.timeStart)}–{fmtHour(filters.timeEnd)})
          </span>
        </label>
        <TimeRangeSlider
          value={[filters.timeStart, filters.timeEnd]}
          onChange={([s, e]) => { setFilter('timeStart', s); setFilter('timeEnd', e); }}
        />
      </div>

      <SelectFilter
        label="Accident type"
        value={filters.accidentType}
        onChange={(v) => setFilter('accidentType', v)}
        allLabel="All types"
        options={options.accidentTypes}
      />

      <SelectFilter
        label="Cause of accident"
        value={filters.cause}
        onChange={(v) => setFilter('cause', v)}
        allLabel="All causes"
        options={options.causes}
      />

      <SelectFilter
        label="Accident spot"
        value={filters.accidentSpot}
        onChange={(v) => setFilter('accidentSpot', v)}
        allLabel="All spots"
        options={options.accidentSpots}
      />

      <SelectFilter
        label="Vehicle type"
        value={filters.vehicleType}
        onChange={(v) => setFilter('vehicleType', v)}
        allLabel="All vehicles"
        options={options.vehicleTypes}
      />

      <SelectFilter
        label="Status of victim"
        value={filters.statusOfVictim}
        onChange={(v) => setFilter('statusOfVictim', v)}
        allLabel="All statuses"
        options={options.statusesOfVictim}
      />

      <SelectFilter
        label="Type of victim"
        value={filters.typeOfVictim}
        onChange={(v) => setFilter('typeOfVictim', v)}
        allLabel="All victim types"
        options={options.typesOfVictim}
      />

      {/* 2021-only filters — collapse silently for other years */}
      {show2021Fields && (
        <>
          <div className="filter-section-divider">
            <span>2021 only</span>
          </div>

          <SelectFilter
            label="Road condition"
            value={filters.roadCondition}
            onChange={(v) => setFilter('roadCondition', v)}
            allLabel="Any road condition"
            options={options.roadConditions}
          />

          <SelectFilter
            label="Weather"
            value={filters.weather}
            onChange={(v) => setFilter('weather', v)}
            allLabel="Any weather"
            options={options.weathers}
          />

          <SelectFilter
            label="Mechanical failure"
            value={filters.mechanicalFailure}
            onChange={(v) => setFilter('mechanicalFailure', v)}
            allLabel="Any mechanical failure"
            options={options.mechanicalFailures}
          />

          <div className="filter-section-divider" />
        </>
      )}

      <SelectFilter
        label="Division"
        value={filters.division}
        onChange={(v) => setFilter('division', v)}
        allLabel="All divisions"
        options={options.divisions}
      />

      <SelectFilter
        label="District"
        value={filters.dzongkhag}
        onChange={(v) => setFilter('dzongkhag', v)}
        allLabel="All districts"
        options={options.dzongkhags}
      />

      <SelectFilter
        label="Gewog"
        value={filters.gewog}
        onChange={(v) => setFilter('gewog', v)}
        allLabel="All gewogs"
        options={options.gewogs}
      />

      <div className="filter-group">
        <label>Place of occurrence</label>
        <PlaceAutocomplete
          value={filters.place}
          onChange={(v) => setFilter('place', v)}
          suggestions={options.places}
        />
      </div>

      <button className="reset-btn" onClick={reset}>
        Reset filters
      </button>
    </aside>
  );
}
