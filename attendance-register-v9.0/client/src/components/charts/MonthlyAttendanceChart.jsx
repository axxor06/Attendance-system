import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function barColor(percentage) {
  if (percentage < 75) return '#B5564E';
  if (percentage < 85) return '#B27A35';
  return '#3F766D';
}

export default function MonthlyAttendanceChart({ data }) {
  const formatted = data.map((d) => ({ ...d, label: `${MONTH_SHORT[d.month - 1]} ${String(d.year).slice(2)}` }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#162B49" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={{ stroke: '#162B49', strokeOpacity: 0.1 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value, _name, item) => [`${value}% (${item.payload.present}/${item.payload.total})`, 'Attendance']}
          contentStyle={{ borderRadius: 12, border: '1px solid rgba(22,43,73,0.1)', fontSize: 13 }}
        />
        <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {formatted.map((entry, index) => (
            <Cell key={index} fill={barColor(entry.percentage)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
