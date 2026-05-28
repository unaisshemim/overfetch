import { Cell, Pie, PieChart } from 'recharts';

interface PayloadDonutProps {
  usedBytes: number;
  wastedBytes: number;
}

export function PayloadDonut({ usedBytes, wastedBytes }: PayloadDonutProps) {
  const data = [
    { name: 'Used', value: usedBytes, color: '#22c55e' },
    { name: 'Waste', value: wastedBytes, color: '#ef4444' },
  ];

  return (
    <div className="flex h-40 min-h-40 w-full min-w-40 items-center justify-center">
      <PieChart width={160} height={160}>
        <Pie
          data={data}
          dataKey="value"
          cx={80}
          cy={80}
          innerRadius={42}
          outerRadius={62}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
