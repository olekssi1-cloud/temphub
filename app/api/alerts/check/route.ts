import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

// ================= DB =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// ================= ZADARMA =================
const ZADARMA_KEY = process.env.ZADARMA_KEY;
const ZADARMA_SECRET = process.env.ZADARMA_SECRET;

const FROM = "100";
const SIP = "100";

const PHONES = [
  "380668954751",
  "380668834130",
  "380662765486",
];

// ================= SETTINGS =================
const DEVICE_ID = "1";
const OFFLINE_AFTER_MINUTES = 5;

// ================= HELPERS =================
function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function generateSignature(method: string, paramsString: string) {
  if (!ZADARMA_SECRET) {
    throw new Error("Missing ZADARMA_SECRET in Vercel Environment Variables");
  }

  const md5 = crypto.createHash("md5").update(paramsString).digest("hex");

  const hmacHex = crypto
    .createHmac("sha1", ZADARMA_SECRET)
    .update(method + paramsString + md5)
    .digest("hex");

  return Buffer.from(hmacHex).toString("base64");
}

async function zadarmaCall(to: string) {
  if (!ZADARMA_KEY) {
    throw new Error("Missing ZADARMA_KEY in Vercel Environment Variables");
  }

  const method = "/v1/request/callback/";

  const paramsString = buildQuery({
    from: FROM,
    to,
    sip: SIP,
    predicted: "1",
  });

  const signature = generateSignature(method, paramsString);

  const res = await fetch(`https://api.zadarma.com${method}?${paramsString}`, {
    method: "GET",
    headers: {
      Authorization: `${ZADARMA_KEY}:${signature}`,
    },
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ================= MAIN =================
export async function GET() {
  try {
    const tempResult = await pool.query(
      `
      SELECT created_at
      FROM temperature_logs
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [DEVICE_ID]
    );

    if (tempResult.rows.length === 0) {
      return NextResponse.json({
        ok: false,
        alert: false,
        error: "No data from sensor",
      });
    }

    const lastTime = new Date(tempResult.rows[0].created_at);
    const now = new Date();

    const diffMinutes = (now.getTime() - lastTime.getTime()) / 1000 / 60;

    await pool.query(
      `
      INSERT INTO alert_state (device_id, alert_sent)
      VALUES ($1, false)
      ON CONFLICT (device_id) DO NOTHING
      `,
      [DEVICE_ID]
    );

    const stateResult = await pool.query(
      `
      SELECT alert_sent
      FROM alert_state
      WHERE device_id = $1
      `,
      [DEVICE_ID]
    );

    const alertSent = stateResult.rows[0]?.alert_sent === true;

    // Якщо сенсор онлайн — скидаємо антиспам
    if (diffMinutes <= OFFLINE_AFTER_MINUTES) {
      await pool.query(
        `
        UPDATE alert_state
        SET alert_sent = false,
            updated_at = NOW()
        WHERE device_id = $1
        `,
        [DEVICE_ID]
      );

      return NextResponse.json({
        ok: true,
        alert: false,
        sensorOnline: true,
        message: "Sensor online. Alert state reset.",
        diffMinutes,
        lastSensorTime: lastTime.toISOString(),
      });
    }

    // Якщо вже дзвонили під час цієї аварії — більше не дзвонимо
    if (alertSent) {
      return NextResponse.json({
        ok: true,
        alert: true,
        callSkipped: true,
        reason: "Alert already sent for this outage session",
        diffMinutes,
        lastSensorTime: lastTime.toISOString(),
      });
    }

    // Якщо сенсор офлайн більше 5 хв і ще не дзвонили — дзвонимо
    const callResults = [];

    for (const phone of PHONES) {
      const result = await zadarmaCall(phone);

      callResults.push({
        phone,
        result,
      });
    }

    await pool.query(
      `
      UPDATE alert_state
      SET alert_sent = true,
          updated_at = NOW()
      WHERE device_id = $1
      `,
      [DEVICE_ID]
    );

    return NextResponse.json({
      ok: true,
      alert: true,
      callSent: true,
      message: "Sensor offline more than 5 minutes. Calls sent once.",
      diffMinutes,
      lastSensorTime: lastTime.toISOString(),
      callResults,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        alert: false,
        error: String(e),
      },
      { status: 500 }
    );
  }
}