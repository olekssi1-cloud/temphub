import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sensors = [1, 2, 3, 4, 5, 6, 7, 8];

    let online = 0;
    let totalTemp = 0;
    let count = 0;

    for (const id of sensors) {
      const res = await fetch(
        `https://mishchenko.in.ua/api/temperature/latest?sensorId=${id}`,
        { cache: "no-store" }
      );

      if (!res.ok) continue;

      const data = await res.json();

      if (data?.temp) {
        online++;
        totalTemp += Number(data.temp);
        count++;
      }
    }

    return NextResponse.json({
      total: sensors.length,
      online,
      avgTemp: count ? +(totalTemp / count).toFixed(1) : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "summary failed" },
      { status: 500 }
    );
  }
}