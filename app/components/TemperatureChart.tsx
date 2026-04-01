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
      timeZone: "Europe/Kyiv",
    });
  }

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

export default function TemperatureChart({ data, range }: Props) {
  const chartData = data.map((item) => ({
    ...item,
    label: formatLabel(item.time, range),
    temp: Number(item.temp),
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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
        >
          <CartesianGrid
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="label"
            tick={{ fill: "white", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
            minTickGap={24}
          />

          <YAxis
            tick={{ fill: "white", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
            width={45}
            domain={["auto", "auto"]}
          />

          <Tooltip
            contentStyle={{
              background: "#0b1d4a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "white",
            }}
            formatter={(value) => [
              `${Number(value).toFixed(1)}°C`,
              "Температура",
            ]}
            labelFormatter={(label) => `Час: ${label}`}
          />

          <Line
            type="monotone"
            dataKey="temp"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}