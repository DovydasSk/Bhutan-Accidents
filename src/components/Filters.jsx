import { useEffect, useMemo, useRef, useState } from 'react';

// Format hour as "HH:00" — 0 -> "00:00", 14 -> "14:00", 24 -> "24:00"
function fmtHour(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Dual-thumb range slider for picking an hour-of-day window [start, end].
 * Two stacked <input type="range"> with a track + filled segment behind them.
 * Pointer-events trick (none on inputs, auto on thumbs) lets both thumbs be grabbed.
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
        <div
          className="time-range-fill"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={start}
          onChange={handleStart}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={end}
          onChange={handleEnd}
        />
      </div>
      <div className="time-range-labels">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

/**
 * Autocomplete text input for "Place of occurrence".
 * Shows suggestions from a provided pool (places + gewogs) as the user types.
 * Keyboard nav: ArrowUp/Down/Enter/Esc.
 */
function PlaceAutocomplete({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  // Filter and rank suggestions: starts-with first, then contains
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

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  // Click outside -> close
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (s) => {
    onChange(s);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Highlight matching substring inside the suggestion label
  const renderItem = (s) => {
    const q = value.trim();
    if (!q) return s;
    const idx = s.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return s;
    return (
      <>
        {s.slice(0, idx)}
        <span className="match">{s.slice(idx, idx + q.length)}</span>
        {s.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        type="text"
        placeholder="Search location…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
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
              onMouseDown={(e) => {
                // mousedown so blur doesn't close before click registers
                e.preventDefault();
                pick(s);
              }}
            >
              {renderItem(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <div className="show-on-map">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.showAll}
              onChange={(e) => setFilter('showAll', e.target.checked)}
            />
            <span className="dot" style={{ background: '#2563eb' }} />
            <span>All traffic accidents</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.showFatal}
              onChange={(e) => setFilter('showFatal', e.target.checked)}
            />
            <span className="dot" style={{ background: '#dc2626' }} />
            <span>Fatal accidents</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.showInjured}
              onChange={(e) => setFilter('showInjured', e.target.checked)}
            />
            <span className="dot" style={{ background: '#f59e0b' }} />
            <span>Injuries</span>
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
          onChange={([s, e]) => {
            setFilter('timeStart', s);
            setFilter('timeEnd', e);
          }}
        />
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
        <label>Cause of accident</label>
        <select
          value={filters.cause}
          onChange={(e) => setFilter('cause', e.target.value)}
        >
          <option value="all">All causes</option>
          {options.causes.map((c) => (
            <option key={c} value={c}>
              {c}
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
        <label>District</label>
        <select
          value={filters.dzongkhag}
          onChange={(e) => setFilter('dzongkhag', e.target.value)}
        >
          <option value="all">All districts</option>
          {options.dzongkhags.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Gewog</label>
        <select
          value={filters.gewog}
          onChange={(e) => setFilter('gewog', e.target.value)}
        >
          <option value="all">All gewogs</option>
          {options.gewogs.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

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
