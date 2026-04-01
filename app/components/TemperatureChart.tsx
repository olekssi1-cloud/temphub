"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type HistoryPoint = {
  temp: number;
  time: string;
};

type Props = {
  data: HistoryPoint[];
  range: "1h" | "10h" | "24h" | "5d" | "10d";
};

function formatLabel(dateString: string, range: Props["range"]) {
  const date = new Date(dateString);

  if (range === "1h" || range === "10h" || range === "24h") {
    return date.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TemperatureChart({ data, range }: Props) {
  const chartData = data.map((item) => ({
    ...item,
    label: formatLabel(item.time, range),
  }));

  if (!chartData.length) {
    return (
      <p style={{ color: "white", fontSize: 22 }}>
        Немає даних для графіка
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "white", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "white", fontSize: 12 }}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}