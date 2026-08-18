import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function barColor(percentage) {
  if (percentage < 75) return '#B5564E';
  if (percentage < 85) return '#B27A35';
  return '#3F766D';
}

export default function SubjectAttendanceChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="#162B49" strokeOpacity={0.06} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={(v) => `${v}%`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="subjectCode"
          tick={{ fontSize: 12, fill: '#162B49', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          formatter={(value, _name, item) => [`${value}% (${item.payload.present}/${item.payload.total})`, item.payload.subjectName]}
          contentStyle={{ borderRadius: 12, border: '1px solid rgba(22,43,73,0.1)', fontSize: 13 }}
        />
        <Bar dataKey="percentage" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((entry, index) => (
            <Cell key={index} fill={barColor(entry.percentage)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
