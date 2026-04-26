import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FanRule = {
  temp: number;
  percent: number;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function validateRules(rules: FanRule[]) {
  if (!Array.isArray(rules)) {
    return "Rules must be array";
  }

  if (rules.length < 1) {
    return "Потрібно мінімум 1 правило";
  }

  if (rules.length > 50) {
    return "Максимум 50 правил";
  }

  let lastTemp: number | null = null;
  const seenTemps = new Set<number>();

  for (const rule of rules) {
    const temp = Number(rule.temp);
    const percent = Number(rule.percent);

    if (Number.isNaN(temp)) {
      return "Температура має бути числом";
    }

    if (Number.isNaN(percent)) {
      return "% вентилятора має бути числом";
    }

    if (percent < 15 || percent > 100) {
      return "% вентилятора має бути від 15 до 100";
    }

    if (seenTemps.has(temp)) {
      return "Температури не мають повторюватися";
    }

    if (lastTemp !== null && temp <= lastTemp) {
      return "Температури мають йти по зростанню";
    }

    seenTemps.add(temp);
    lastTemp = temp;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const deviceIdRaw = searchParams.get("device_id") || "1";
    const deviceId = Number(deviceIdRaw);

    if (!Number.isInteger(deviceId) || deviceId < 1) {
      return json({ ok: false, error: "Invalid device_id" }, 400);
    }

    const rows = await sql`
      SELECT
        device_id,
        profile_type,
        startup_seconds,
        startup_percent,
        rules,
        updated_at
      FROM fan_profiles
      WHERE device_id = ${deviceId}
        AND profile_type = 'default'
      LIMIT 1
    `;

    if (!rows.length) {
      return json({
        ok: true,
        exists: false,
        device_id: deviceId,
        startup_seconds: 20,
        startup_percent: 50,
        rules: [
          { temp: 17, percent: 15 },
          { temp: 18, percent: 20 },
          { temp: 19, percent: 25 },
          { temp: 20, percent: 30 },
          { temp: 21, percent: 35 },
          { temp: 22, percent: 40 },
          { temp: 23, percent: 50 },
          { temp: 24, percent: 55 },
          { temp: 25, percent: 60 },
          { temp: 26, percent: 70 },
          { temp: 27, percent: 75 },
          { temp: 28, percent: 80 },
          { temp: 29, percent: 90 },
          { temp: 30, percent: 100 },
        ],
      });
    }

    const row = rows[0];

    return json({
      ok: true,
      exists: true,
      device_id: Number(row.device_id),
      profile_type: row.profile_type,
      startup_seconds: Number(row.startup_seconds),
      startup_percent: Number(row.startup_percent),
      rules: row.rules,
      updated_at: row.updated_at,
    });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const deviceId = Number(body.device_id);
    const startupSeconds = Number(body.startup_seconds);
    const startupPercent = Number(body.startup_percent);
    const rules = body.rules as FanRule[];

    if (!Number.isInteger(deviceId) || deviceId < 1) {
      return json({ ok: false, error: "Invalid device_id" }, 400);
    }

    if (
      !Number.isInteger(startupSeconds) ||
      startupSeconds < 1 ||
      startupSeconds > 300
    ) {
      return json(
        { ok: false, error: "Startup seconds має бути від 1 до 300" },
        400
      );
    }

    if (
      !Number.isInteger(startupPercent) ||
      startupPercent < 15 ||
      startupPercent > 100
    ) {
      return json(
        { ok: false, error: "Startup percent має бути від 15 до 100" },
        400
      );
    }

    const rulesError = validateRules(rules);
    if (rulesError) {
      return json({ ok: false, error: rulesError }, 400);
    }

    const cleanRules = rules.map((r) => ({
      temp: Number(r.temp),
      percent: Number(r.percent),
    }));

    await sql`
      INSERT INTO fan_profiles (
        device_id,
        profile_type,
        startup_seconds,
        startup_percent,
        rules,
        updated_at
      )
      VALUES (
        ${deviceId},
        'default',
        ${startupSeconds},
        ${startupPercent},
        ${JSON.stringify(cleanRules)}::jsonb,
        NOW()
      )
      ON CONFLICT (device_id, profile_type)
      DO UPDATE SET
        startup_seconds = EXCLUDED.startup_seconds,
        startup_percent = EXCLUDED.startup_percent,
        rules = EXCLUDED.rules,
        updated_at = NOW()
    `;

    return json({
      ok: true,
      device_id: deviceId,
      startup_seconds: startupSeconds,
      startup_percent: startupPercent,
      rules: cleanRules,
    });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
}