import { useMemo, useState } from 'react';

const PAGE_SIZE = 50;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AccidentTable({ data }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortBy, sortDir]);

  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(0);
  };

  const sortArrow = (col) =>
    sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  if (sorted.length === 0) {
    return <div className="empty-state">No accidents match the current filters</div>;
  }

  return (
    <div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                Date{sortArrow('date')}
              </th>
              <th>Type</th>
              <th>Location / Place</th>
              <th>Region</th>
              <th>Division</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('deaths')}>
                Deaths{sortArrow('deaths')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('injured')}>
                Injured{sortArrow('injured')}
              </th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.date)}</td>
                <td>{a.accident_type || '—'}</td>
                <td>{a.location || a.place || '—'}</td>
                <td>{a.dzongkhag || '—'}</td>
                <td>{a.division || '—'}</td>
                <td>
                  {a.deaths > 0 ? (
                    <span className="badge badge-danger">{a.deaths}</span>
                  ) : (
                    <span style={{ color: '#95a0ad' }}>0</span>
                  )}
                </td>
                <td>
                  {a.injured > 0 ? (
                    <span className="badge badge-warning">{a.injured}</span>
                  ) : (
                    <span style={{ color: '#95a0ad' }}>0</span>
                  )}
                </td>
                <td>{a.vehicle_type || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0 4px 0',
          fontSize: 12,
          color: '#6b7785',
        }}
      >
        <span>
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{' '}
          {sorted.length.toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="reset-btn"
            style={{ width: 'auto', padding: '6px 12px' }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </button>
          <span style={{ padding: '6px 0' }}>
            Page {page + 1} / {totalPages}
          </span>
          <button
            className="reset-btn"
            style={{ width: 'auto', padding: '6px 12px' }}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
