import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#2563eb', '#dc2626', '#f59e0b', '#059669', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export default function AccidentCharts({ data }) {
  const byYear = useMemo(() => {
    const acc = {};
    for (const a of data) {
      if (!a.year) continue;
      if (!acc[a.year]) acc[a.year] = { year: a.year, accidents: 0, deaths: 0, injured: 0 };
      acc[a.year].accidents += 1;
      acc[a.year].deaths += a.deaths || 0;
      acc[a.year].injured += a.injured || 0;
    }
    return Object.values(acc)
      .filter((d) => d.year >= 2021 && d.year <= 2025)
      .sort((a, b) => a.year - b.year);
  }, [data]);

  const byType = useMemo(() => {
    const acc = {};
    for (const a of data) {
      if (!a.accident_type) continue;
      acc[a.accident_type] = (acc[a.accident_type] || 0) + 1;
    }
    return Object.entries(acc)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  const byDzongkhag = useMemo(() => {
    const acc = {};
    for (const a of data) {
      if (!a.dzongkhag) continue;
      acc[a.dzongkhag] = (acc[a.dzongkhag] || 0) + 1;
    }
    return Object.entries(acc)
      .map(([dzongkhag, count]) => ({ dzongkhag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Accidents over time</div>
          <div className="panel-meta">By year</div>
        </div>
        <div className="panel-body" style={{ height: 260 }}>
          {byYear.length === 0 ? (
            <div className="empty-state">No data for current filters</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byYear} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7785' }} stroke="#e1e5eb" />
                <YAxis tick={{ fontSize: 12, fill: '#6b7785' }} stroke="#e1e5eb" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e1e5eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Line type="monotone" dataKey="accidents" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Accidents" />
                <Line type="monotone" dataKey="deaths" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="Deaths" />
                <Line type="monotone" dataKey="injured" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Injured" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="charts-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Top accident types</div>
            <div className="panel-meta">Top 8</div>
          </div>
          <div className="panel-body" style={{ height: 300 }}>
            {byType.length === 0 ? (
              <div className="empty-state">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 11, fill: '#1a2332' }}
                    width={150}
                    stroke="#e1e5eb"
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #e1e5eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Top regions</div>
            <div className="panel-meta">Top 10</div>
          </div>
          <div className="panel-body" style={{ height: 300 }}>
            {byDzongkhag.length === 0 ? (
              <div className="empty-state">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDzongkhag} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dzongkhag"
                    tick={{ fontSize: 11, fill: '#6b7785' }}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                    interval={0}
                    stroke="#e1e5eb"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #e1e5eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
