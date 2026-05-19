import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

const TYPE_COLORS = ['#2563eb', '#dc2626', '#f59e0b', '#059669', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

/**
 * One small vertical bar chart for a single metric across years.
 * Used three times: accidents / deaths / injured.
 */
function YearlyBars({ title, data, color, valueKey }) {
  const empty = data.length === 0 || data.every((d) => d[valueKey] === 0);
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        <div className="panel-meta">By year</div>
      </div>
      <div className="panel-body" style={{ height: 240 }}>
        {empty ? (
          <div className="empty-state">No data for current filters</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#6b7785' }}
                stroke="#e1e5eb"
              />
              <YAxis tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
              <Tooltip
                cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e1e5eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey={valueKey} fill={color} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey={valueKey}
                  position="top"
                  style={{ fontSize: 11, fill: '#6b7785', fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

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
      // Tokenize multi-valued accident_type ("Off-road, Hit and Run") so each
      // sub-type gets its own bar instead of a combined label that nobody clicks.
      const tokens = String(a.accident_type).split(',').map((s) => s.trim()).filter(Boolean);
      for (const tok of tokens) {
        acc[tok] = (acc[tok] || 0) + 1;
      }
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
      {/* Three vertical bar charts side-by-side — accidents / deaths / injured by year */}
      <div className="yearly-bars-grid">
        <YearlyBars title="Accidents per year" data={byYear} color="#2563eb" valueKey="accidents" />
        <YearlyBars title="Deaths per year" data={byYear} color="#dc2626" valueKey="deaths" />
        <YearlyBars title="Injured per year" data={byYear} color="#f59e0b" valueKey="injured" />
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
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Top districts</div>
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
