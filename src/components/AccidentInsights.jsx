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
  PieChart,
  Pie,
  Legend,
} from 'recharts';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse "HH:MM" -> hour number (0..23). Returns null on bad input. */
function hourOf(time) {
  if (!time || typeof time !== 'string') return null;
  const m = time.match(/^(\d{1,2}):/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (h === 24) h = 0;  // some records use "24:00" — treat as midnight
  if (h < 0 || h > 23) return null;
  return h;
}

/** Bhutan civil twilight is roughly between 18:30 and 06:00 year-round (low-latitude → small seasonal swing).
 *  We use 18:00–05:59 as the "dark hours" bucket for this analysis. */
function isDarkHour(h) {
  return h != null && (h >= 18 || h < 6);
}

export default function AccidentInsights({ data }) {
  const insights = useMemo(() => {
    const total = data.length;
    if (total === 0) return null;

    let totalDeaths = 0;
    let totalInjured = 0;
    let darkCount = 0;
    let dayCount = 0;
    let darkDeaths = 0;
    let darkInjured = 0;

    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, deaths: 0 }));
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({
      day: WEEKDAYS_SHORT[i], fullDay: WEEKDAYS[i], count: 0, deaths: 0,
    }));
    const byCause = {};         // cause -> { count, deaths }
    const byVehicle = {};       // vehicle_type -> count
    const bySpot = {};          // accident_spot -> count
    const byDzongkhag = {};     // for fatality rate
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i, count: 0 }));
    let weekendCount = 0;
    let weekdayCount = 0;
    let withTime = 0;
    let withDate = 0;
    const drunkRelated = { count: 0, deaths: 0 };

    for (const a of data) {
      const deaths = a.deaths || 0;
      const injured = a.injured || 0;
      totalDeaths += deaths;
      totalInjured += injured;

      const h = hourOf(a.time);
      if (h != null) {
        withTime++;
        byHour[h].count++;
        byHour[h].deaths += deaths;
        if (isDarkHour(h)) {
          darkCount++;
          darkDeaths += deaths;
          darkInjured += injured;
        } else {
          dayCount++;
        }
      }

      if (a.date) {
        const d = new Date(a.date);
        if (!isNaN(d.getTime())) {
          withDate++;
          const wd = d.getDay();
          byWeekday[wd].count++;
          byWeekday[wd].deaths += deaths;
          if (wd === 0 || wd === 6) weekendCount++;
          else weekdayCount++;
          const m = d.getMonth();
          byMonth[m].count++;
        }
      }

      if (a.cause) {
        if (!byCause[a.cause]) byCause[a.cause] = { count: 0, deaths: 0 };
        byCause[a.cause].count++;
        byCause[a.cause].deaths += deaths;
        if (/drunk/i.test(a.cause)) {
          drunkRelated.count++;
          drunkRelated.deaths += deaths;
        }
      }
      if (a.vehicle_type) byVehicle[a.vehicle_type] = (byVehicle[a.vehicle_type] || 0) + 1;
      if (a.accident_spot) bySpot[a.accident_spot] = (bySpot[a.accident_spot] || 0) + 1;
      if (a.dzongkhag) {
        if (!byDzongkhag[a.dzongkhag]) byDzongkhag[a.dzongkhag] = { count: 0, deaths: 0 };
        byDzongkhag[a.dzongkhag].count++;
        byDzongkhag[a.dzongkhag].deaths += deaths;
      }
    }

    // Derived metrics
    const darkPct = withTime ? (darkCount / withTime) * 100 : 0;
    const dayPct = withTime ? (dayCount / withTime) * 100 : 0;
    const darkFatalityRate = darkCount ? (darkDeaths / darkCount) * 100 : 0;
    const dayFatalityRate = dayCount ? ((totalDeaths - darkDeaths) / dayCount) * 100 : 0;

    const peakHour = byHour.reduce((p, c) => (c.count > p.count ? c : p), byHour[0]);

    // Find peak 2-hour window
    let peakWindowStart = 0;
    let peakWindowCount = 0;
    for (let i = 0; i < 24; i++) {
      const sum = byHour[i].count + byHour[(i + 1) % 24].count;
      if (sum > peakWindowCount) {
        peakWindowCount = sum;
        peakWindowStart = i;
      }
    }

    const peakWeekday = byWeekday.reduce((p, c) => (c.count > p.count ? c : p), byWeekday[0]);
    const peakMonth = byMonth.reduce((p, c) => (c.count > p.count ? c : p), byMonth[0]);

    // Top cause by fatalities
    const causeArr = Object.entries(byCause).map(([cause, v]) => ({
      cause,
      count: v.count,
      deaths: v.deaths,
      fatalityRate: v.count ? (v.deaths / v.count) * 100 : 0,
    }));
    const topCauseByDeaths = [...causeArr].sort((a, b) => b.deaths - a.deaths)[0];
    const deadliestCause = causeArr
      .filter((c) => c.count >= 30)  // require at least 30 cases for stable rate
      .sort((a, b) => b.fatalityRate - a.fatalityRate)[0];

    // Most dangerous district by fatality rate (require >= 50 cases)
    const districtArr = Object.entries(byDzongkhag).map(([d, v]) => ({
      district: d,
      count: v.count,
      deaths: v.deaths,
      fatalityRate: v.count ? (v.deaths / v.count) * 100 : 0,
    }));
    const deadliestDistrict = districtArr
      .filter((d) => d.count >= 50)
      .sort((a, b) => b.fatalityRate - a.fatalityRate)[0];

    // Top vehicle
    const topVehicleEntry = Object.entries(byVehicle).sort((a, b) => b[1] - a[1])[0];
    const topVehicle = topVehicleEntry ? { type: topVehicleEntry[0], count: topVehicleEntry[1] } : null;

    // Weekend vs weekday rate (per-day average) — weekend has 2 days, weekday 5
    const totalWithDate = weekendCount + weekdayCount;
    const weekendPctPerDay = totalWithDate ? (weekendCount / 2) / (totalWithDate / 7) : 0;
    const weekendOverIndex = totalWithDate ? ((weekendCount / 2) / (totalWithDate / 7) - 1) * 100 : 0;

    // Average per day
    const avgPerDay = withDate ? withDate / Math.max(1, withDate / (totalWithDate ? totalWithDate / withDate : 1)) : 0;

    return {
      total,
      totalDeaths,
      totalInjured,
      withTime,
      withDate,
      darkPct,
      dayPct,
      darkCount,
      darkFatalityRate,
      dayFatalityRate,
      byHour,
      byWeekday,
      byMonth,
      peakHour,
      peakWindowStart,
      peakWindowCount,
      peakWeekday,
      peakMonth,
      topCauseByDeaths,
      deadliestCause,
      deadliestDistrict,
      topVehicle,
      drunkRelated,
      drunkRelatedPct: total ? (drunkRelated.count / total) * 100 : 0,
      weekendOverIndex,
      causeArr,
    };
  }, [data]);

  if (!insights) {
    return <div className="empty-state">No data matches the current filters.</div>;
  }

  const i = insights;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthChartData = i.byMonth.map((m) => ({ ...m, monthName: monthNames[m.month] }));

  // Top 5 deadliest causes (by fatality rate, min 30 cases) for the bar chart
  const top5DeadlyCauses = i.causeArr
    .filter((c) => c.count >= 30)
    .sort((a, b) => b.fatalityRate - a.fatalityRate)
    .slice(0, 5)
    .map((c) => ({
      // truncate long cause labels for readability
      cause: c.cause.length > 28 ? c.cause.slice(0, 27) + '…' : c.cause,
      fullCause: c.cause,
      fatalityRate: Number(c.fatalityRate.toFixed(1)),
      count: c.count,
      deaths: c.deaths,
    }));

  return (
    <div>
      {/* Headline insight cards */}
      <div className="insights-grid">
        <div className="insight-card accent-purple">
          <div className="insight-icon">🌙</div>
          <div className="insight-headline">
            {i.darkPct.toFixed(1)}%
          </div>
          <div className="insight-title">happen in the dark</div>
          <div className="insight-desc">
            {i.darkCount.toLocaleString()} of {i.withTime.toLocaleString()} accidents with recorded time occur between 18:00 and 06:00.
            {i.darkFatalityRate > i.dayFatalityRate && (
              <> Dark-hour accidents are <b>{(i.darkFatalityRate / Math.max(i.dayFatalityRate, 0.01)).toFixed(1)}×</b> more deadly than daytime ones ({i.darkFatalityRate.toFixed(1)}% vs {i.dayFatalityRate.toFixed(1)}% fatality rate).</>
            )}
          </div>
        </div>

        <div className="insight-card accent-red">
          <div className="insight-icon">⏰</div>
          <div className="insight-headline">
            {String(i.peakWindowStart).padStart(2, '0')}:00–{String((i.peakWindowStart + 2) % 24).padStart(2, '0')}:00
          </div>
          <div className="insight-title">is the peak danger window</div>
          <div className="insight-desc">
            {i.peakWindowCount.toLocaleString()} accidents occur in this 2-hour window — that's {((i.peakWindowCount / i.withTime) * 100).toFixed(1)}% of all timed accidents packed into 8.3% of the day.
          </div>
        </div>

        <div className="insight-card accent-orange">
          <div className="insight-icon">🍺</div>
          <div className="insight-headline danger">
            {i.drunkRelatedPct.toFixed(1)}%
          </div>
          <div className="insight-title">involve drunk driving</div>
          <div className="insight-desc">
            {i.drunkRelated.count.toLocaleString()} accidents were caused by drunk driving, resulting in <b>{i.drunkRelated.deaths.toLocaleString()} deaths</b>. That's {i.totalDeaths ? ((i.drunkRelated.deaths / i.totalDeaths) * 100).toFixed(0) : 0}% of all road deaths.
          </div>
        </div>

        <div className="insight-card accent-blue">
          <div className="insight-icon">📅</div>
          <div className="insight-headline primary">
            {i.peakWeekday.fullDay}
          </div>
          <div className="insight-title">is the most dangerous day</div>
          <div className="insight-desc">
            {i.peakWeekday.count.toLocaleString()} accidents fall on {i.peakWeekday.fullDay}s.
            {i.weekendOverIndex > 5 && <> Weekends see <b>{i.weekendOverIndex.toFixed(0)}%</b> more accidents per day than weekdays.</>}
            {i.weekendOverIndex < -5 && <> Weekdays are <b>{Math.abs(i.weekendOverIndex).toFixed(0)}%</b> more accident-prone than weekends per day.</>}
          </div>
        </div>

        {i.deadliestCause && (
          <div className="insight-card accent-red">
            <div className="insight-icon">💀</div>
            <div className="insight-headline danger">
              {i.deadliestCause.fatalityRate.toFixed(1)}%
            </div>
            <div className="insight-title">fatality rate for "{i.deadliestCause.cause}"</div>
            <div className="insight-desc">
              The deadliest cause (≥30 cases) — {i.deadliestCause.deaths} deaths across {i.deadliestCause.count} accidents.
              For comparison, the overall fatality rate is {((i.totalDeaths / i.total) * 100).toFixed(1)}%.
            </div>
          </div>
        )}

        {i.deadliestDistrict && (
          <div className="insight-card accent-teal">
            <div className="insight-icon">📍</div>
            <div className="insight-headline">
              {i.deadliestDistrict.district}
            </div>
            <div className="insight-title">has the highest fatality rate</div>
            <div className="insight-desc">
              {i.deadliestDistrict.fatalityRate.toFixed(1)}% of accidents in this district are fatal ({i.deadliestDistrict.deaths} deaths in {i.deadliestDistrict.count} accidents). National average: {((i.totalDeaths / i.total) * 100).toFixed(1)}%.
            </div>
          </div>
        )}

        <div className="insight-card accent-green">
          <div className="insight-icon">📆</div>
          <div className="insight-headline success">
            {monthNames[i.peakMonth.month]}
          </div>
          <div className="insight-title">is the worst month</div>
          <div className="insight-desc">
            {i.peakMonth.count.toLocaleString()} accidents reported in {monthNames[i.peakMonth.month]} across all years in the current selection.
          </div>
        </div>

        {i.topVehicle && (
          <div className="insight-card accent-blue">
            <div className="insight-icon">🚗</div>
            <div className="insight-headline primary">
              {((i.topVehicle.count / i.total) * 100).toFixed(0)}%
            </div>
            <div className="insight-title">involve {i.topVehicle.type}</div>
            <div className="insight-desc">
              {i.topVehicle.count.toLocaleString()} accidents involved {i.topVehicle.type} — the most frequently recorded vehicle category.
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Accidents by hour of day</div>
            <div className="panel-meta">When do crashes happen?</div>
          </div>
          <div className="panel-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={i.byHour} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: '#6b7785' }}
                  stroke="#e1e5eb"
                  tickFormatter={(h) => String(h).padStart(2, '0')}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e1e5eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelFormatter={(h) => `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {i.byHour.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={isDarkHour(entry.hour) ? '#7c3aed' : '#2563eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Accidents by day of week</div>
            <div className="panel-meta">Weekly pattern</div>
          </div>
          <div className="panel-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={i.byWeekday} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                <YAxis tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e1e5eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelFormatter={(d, payload) => payload?.[0]?.payload?.fullDay || d}
                />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Accidents by month</div>
            <div className="panel-meta">Seasonal pattern</div>
          </div>
          <div className="panel-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                <YAxis tick={{ fontSize: 11, fill: '#6b7785' }} stroke="#e1e5eb" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e1e5eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Deadliest causes (fatality rate)</div>
            <div className="panel-meta">Top 5 · min. 30 cases</div>
          </div>
          <div className="panel-body" style={{ height: 280 }}>
            {top5DeadlyCauses.length === 0 ? (
              <div className="empty-state">Not enough data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top5DeadlyCauses} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e1e5eb" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#6b7785' }}
                    stroke="#e1e5eb"
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="cause"
                    tick={{ fontSize: 11, fill: '#1a2332' }}
                    width={170}
                    stroke="#e1e5eb"
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #e1e5eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullCause || ''}
                    formatter={(v, name, props) => [
                      `${v}% (${props.payload.deaths}/${props.payload.count})`,
                      'Fatality rate',
                    ]}
                  />
                  <Bar dataKey="fatalityRate" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-light)', padding: '0 4px' }}>
        <b>Methodology:</b> "Dark hours" defined as 18:00–05:59. Time-based stats use {i.withTime.toLocaleString()} records with recorded time of day. Date-based stats use {i.withDate.toLocaleString()} records with valid dates. Fatality rate = deaths / accidents in that category.
      </div>
    </div>
  );
}
