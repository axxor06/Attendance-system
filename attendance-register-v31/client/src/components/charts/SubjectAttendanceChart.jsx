import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function barColor(percentage) {
  if (percentage < 75) return 'var(--color-clay)';
  if (percentage < 85) return 'var(--color-amber)';
  return 'var(--color-sage)';
}

export default function SubjectAttendanceChart({ data }) {
  const rows = Array.isArray(data) ? data : [];

  if (rows.length === 0) {
    return <div className="chart-frame flex h-[220px] w-full min-w-0 items-center justify-center border border-dashed border-line text-sm text-slate">No subject attendance data yet.</div>;
  }

  const chartHeight = Math.max(220, Math.min(560, rows.length * 42));

  return (
    <div className="chart-frame w-full min-w-0" style={{ height: `${chartHeight}px` }} role="img" aria-label="Attendance by subject chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={80}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.06} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--color-slate)' }}
            tickFormatter={(value) => `${value}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="subjectCode"
            tick={{ fontSize: 10, fill: 'var(--color-ink)', fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip
            formatter={(value, _name, item) => [`${value}% (${item.payload.present}/${item.payload.total})`, item.payload.subjectName]}
            wrapperStyle={{ maxWidth: 'calc(100vw - 24px)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {rows.map((entry, index) => <Cell key={`${entry.subjectCode || 'subject'}-${index}`} fill={barColor(entry.percentage)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
