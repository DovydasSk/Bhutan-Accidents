import { useMemo } from 'react';

export default function KPICards({ data }) {
  const stats = useMemo(() => {
    let deaths = 0;
    let injured = 0;
    const typeCount = {};
    for (const a of data) {
      deaths += a.deaths || 0;
      injured += a.injured || 0;
      if (a.accident_type) {
        typeCount[a.accident_type] = (typeCount[a.accident_type] || 0) + 1;
      }
    }
    const top = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
    return {
      total: data.length,
      deaths,
      injured,
      topType: top ? top[0] : '—',
      topTypeCount: top ? top[1] : 0,
    };
  }, [data]);

  return (
    <div className="kpis">
      <div className="kpi-card">
        <div className="kpi-label">Accidents</div>
        <div className="kpi-value">{stats.total.toLocaleString()}</div>
        <div className="kpi-sub">total in selection</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Deaths</div>
        <div className="kpi-value danger">{stats.deaths.toLocaleString()}</div>
        <div className="kpi-sub">{stats.total ? `${((stats.deaths / stats.total) * 100).toFixed(1)}% of accidents` : '—'}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Injured</div>
        <div className="kpi-value warning">{stats.injured.toLocaleString()}</div>
        <div className="kpi-sub">{stats.total ? `${((stats.injured / stats.total) * 100).toFixed(1)}% of accidents` : '—'}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Most common type</div>
        <div className="kpi-value" style={{ fontSize: 15, lineHeight: 1.3 }}>
          {stats.topType}
        </div>
        <div className="kpi-sub">{stats.topTypeCount.toLocaleString()} cases</div>
      </div>
    </div>
  );
}
