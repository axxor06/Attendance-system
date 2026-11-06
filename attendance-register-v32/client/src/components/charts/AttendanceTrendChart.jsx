import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCalendarDate } from '../../utils/calendarDate.js';

export default function AttendanceTrendChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const formatted = rows.map((entry) => ({ ...entry, label: formatCalendarDate(entry.date, 'MMM d') }));

  if (formatted.length === 0) {
    return <div className="chart-frame flex h-[220px] w-full min-w-0 items-center justify-center border border-dashed border-line text-sm text-slate">No attendance trend data yet.</div>;
  }

  return (
    <div className="chart-frame h-[220px] w-full min-w-0" role="img" aria-label="Attendance trend chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={80}>
        <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={24}
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
            formatter={(value) => [`${value}%`, 'Attendance']}
            wrapperStyle={{ maxWidth: 'calc(100vw - 24px)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: 'var(--color-accent)' }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
