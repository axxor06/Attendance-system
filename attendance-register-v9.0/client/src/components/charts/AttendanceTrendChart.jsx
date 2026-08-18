import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function AttendanceTrendChart({ data }) {
  const formatted = data.map((d) => ({ ...d, label: format(new Date(d.date), 'MMM d') }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
          formatter={(value) => [`${value}%`, 'Attendance']}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid rgba(22,43,73,0.1)',
            fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
          }}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="#B27A35"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#B27A35' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
