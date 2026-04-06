import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    avgTemp: 22.4,
    avgHumidity: 64,
    avgSoil: 48,
    onlineSensors: 2,
    totalSensors: 3,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(data);
}