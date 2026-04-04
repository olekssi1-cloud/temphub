<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginTop: 20,
  }}
>
  {[
    {
      label: "Поточна",
      value: `${currentTemp.toFixed(1)}°C`,
      bg: "linear-gradient(180deg,#154f8a,#11396d)",
    },
    {
      label: "Min",
      value: `${minTemp.toFixed(1)}°C`,
      bg: "linear-gradient(180deg,#174a9b,#133c7c)",
    },
    {
      label: "Max",
      value: `${maxTemp.toFixed(1)}°C`,
      bg: "linear-gradient(180deg,#8a2f1d,#6b2416)",
    },
  ].map((item) => (
    <div
      key={item.label}
      style={{
        background: item.bg,
        borderRadius: 22,
        padding: 20,
        minHeight: 130,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 18,
          opacity: 0.9,
        }}
      >
        {item.label}
      </div>

      <div
        style={{
          fontSize: "clamp(32px, 5vw, 48px)",
          lineHeight: 1.1,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {item.value}
      </div>
    </div>
  ))}
</div>