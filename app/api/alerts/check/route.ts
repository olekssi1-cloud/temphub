import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

// ================= DB =================
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_hdcpZf1xmuQ0@ep-delicate-pond-alak8lb8-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

// ================= ZADARMA =================
const ZADARMA_KEY = "67270010bcdda0322e85";
const ZADARMA_SECRET = "3f22e0545422f51aa7e9";

const FROM = "100";
const SIP = "100";

const PHONES = [
  "380668954751",
  "380668834130", // другий номер, якщо треба
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
  const md5 = crypto.createHash("md5").update(paramsString).digest("hex");

  const hmacHex = crypto
    .createHmac("sha1", ZADARMA_SECRET)
    .update(method + paramsString + md5)
    .digest("hex");

  return Buffer.from(hmacHex).toString("base64");
}

async function zadarmaCall(to: string) {
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
    const result = await pool.query(
      `
      SELECT created_at
      FROM temperature_logs
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [DEVICE_ID]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        ok: false,
        alert: false,
        error: "No data for sensor 1",
      });
    }

    const lastTime = new Date(result.rows[0].created_at);
    const now = new Date();

    const diffMinutes = (now.getTime() - lastTime.getTime()) / 1000 / 60;

    if (diffMinutes <= OFFLINE_AFTER_MINUTES) {
      return NextResponse.json({
        ok: true,
        alert: false,
        message: "Sensor 1 is online",
        diffMinutes,
        lastSensorTime: lastTime.toISOString(),
      });
    }

    const callResults = [];

    for (const phone of PHONES) {
      const callResult = await zadarmaCall(phone);
      callResults.push({
        phone,
        result: callResult,
      });
    }

    return NextResponse.json({
      ok: true,
      alert: true,
      message: "Sensor 1 offline more than 5 minutes",
      diffMinutes,
      lastSensorTime: lastTime.toISOString(),
      callResults,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      alert: false,
      error: String(e),
    });
  }
}