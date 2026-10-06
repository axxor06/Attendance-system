import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function barColor(percentage) {
  if (percentage < 75) return 'var(--color-clay)';
  if (percentage < 85) return 'var(--color-amber)';
  return 'var(--color-sage)';
}

export default function MonthlyAttendanceChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const formatted = rows.map((entry) => ({ ...entry, label: `${MONTH_SHORT[entry.month - 1] || 'Month'} ${String(entry.year || '').slice(-2)}` }));

  if (formatted.length === 0) {
    return <div className="chart-frame flex h-[220px] w-full min-w-0 items-center justify-center border border-dashed border-line text-sm text-slate">No monthly attendance data yet.</div>;
  }

  return (
    <div className="chart-frame h-[220px] w-full min-w-0" role="img" aria-label="Monthly attendance chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={80}>
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={18}
            tick={{ fontSize: 10, fill: 'var(--color-slate)' }}
            axisLine={{ stroke: 'var(--color-line)', strokeOpacity: 0.1 }}
            tickLine={false}
          />
          <YAxis
            width={42}
            tick={{ fontSize: 10, fill: 'var(--color-slate)' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value, _name, item) => [`${value}% (${item.payload.present}/${item.payload.total})`, 'Attendance']}
            wrapperStyle={{ maxWidth: 'calc(100vw - 24px)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
          />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {formatted.map((entry, index) => <Cell key={`${entry.month}-${entry.year}-${index}`} fill={barColor(entry.percentage)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
