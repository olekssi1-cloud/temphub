"use client";

type Point = {
  temp: number;
  time: string;
};

type Props = {
  points: Point[];
};

export default function TemperatureChart({ points }: Props) {
  if (!points || points.length === 0) {
    return (
      <div
        style={{
          color: "#d1d5db",
          fontSize: "20px",
          padding: "12px 0 4px 0",
        }}
      >
        Немає даних для графіка
      </div>
    );
  }

  const width = 680;
  const height = 360;
  const paddingLeft = 72;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 58;

  const temps = points.map((p) => p.temp);
  const maxValue = Math.max(...temps);

  const extra = 0.2;
  const minY = 0;
  const maxY = Math.ceil((maxValue + extra) * 10) / 10;
  const rangeY = maxY - minY || 1;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = paddingLeft + index * stepX;
    const y =
      paddingTop + chartHeight - ((point.temp - minY) / rangeY) * chartHeight;

    return { x, y };
  });

  const linePoints = coords
    .map((c) => String(c.x) + "," + String(c.y))
    .join(" ");

  const areaPoints =
    String(paddingLeft) +
    "," +
    String(paddingTop + chartHeight) +
    " " +
    linePoints +
    " " +
    String(coords[coords.length - 1].x) +
    "," +
    String(paddingTop + chartHeight);

  const yTicks = 5;
  const yLabels = [];

  for (let i = 0; i <= yTicks; i++) {
    const value = minY + (rangeY / yTicks) * (yTicks - i);
    const y = paddingTop + (chartHeight / yTicks) * i;
    yLabels.push({ value, y });
  }

  let labelStep = 1;
  if (points.length > 12) labelStep = 2;
  if (points.length > 20) labelStep = 3;
  if (points.length > 30) labelStep = 4;
  if (points.length > 45) labelStep = 6;
  if (points.length > 70) labelStep = 8;

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={"0 0 " + width + " " + height}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {yLabels.map((item, index) => (
          <g key={index}>
            <line
              x1={paddingLeft}
              y1={item.y}
              x2={width - paddingRight}
              y2={item.y}
              stroke="#334155"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 14}
              y={item.y + 6}
              textAnchor="end"
              fontSize="12"
              fill="#cbd5e1"
            >
              {item.value.toFixed(1)}°
            </text>
          </g>
        ))}

        {coords.map((point, index) => (
          <line
            key={index}
            x1={point.x}
            y1={paddingTop}
            x2={point.x}
            y2={paddingTop + chartHeight}
            stroke="#23324f"
            strokeWidth="1"
          />
        ))}

        <polygon
          points={areaPoints}
          fill="rgba(34,197,94,0.18)"
        />

        <polyline
          points={linePoints}
          fill="none"
          stroke="#22c55e"
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="#22c55e"
          />
        ))}

        {points.map((point, index) => {
          if (index % labelStep !== 0 && index !== points.length - 1) {
            return null;
          }

          return (
            <text
              key={index}
              x={coords[index].x}
              y={height - 18}
              textAnchor="end"
              transform={
                "rotate(-28 " + coords[index].x + " " + (height - 18) + ")"
              }
              fontSize="12"
              fill="#cbd5e1"
            >
              {point.time}
            </text>
          );
        })}
      </svg>
    </div>
  );
}