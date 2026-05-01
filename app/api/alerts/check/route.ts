import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

// ================= DB =================
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_hdcpZf1xmuQ0@ep-delicate-pond-alak8lb8-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

// ================= ZADARMA =================
const ZADARMA_KEY = "29405d16f36cf48cc953";
const ZADARMA_SECRET = "0a13f2fb618c6f6b3fb9";

const FROM = "+380914810472";   // Твій новий номер Zadarma ✅
const TO = "+380668954751";     // Твій телефон ✅

// ================= HELPERS =================
function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function generateSignature(method: string, paramsString: string) {
  const md5 = crypto.createHash("md5").update(paramsString).digest("hex");

  return crypto
    .createHmac("sha1", ZADARMA_SECRET)
    .update(method + paramsString + md5)
    .digest("base64");
}

// ================= ZADARMA CALL =================
async function zadarmaCall() {
  const method = "/v1/request/callback/";

  const paramsString = buildQuery({
    from: FROM,
    to: TO,
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
    const result = await pool.query(`
      SELECT created_at
      FROM temperature_logs
      WHERE device_id = '1'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No data",
      });
    }

    const lastTime = new Date(result.rows[0].created_at);
    const now = new Date();

    const diffMinutes = (now.getTime() - lastTime.getTime()) / 1000 / 60;

    if (diffMinutes > 5) {
      const callResult = await zadarmaCall();

      return NextResponse.json({
        ok: true,
        alert: true,
        diffMinutes,
        callResult,
      });
    }

    return NextResponse.json({
      ok: true,
      alert: false,
      diffMinutes,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: String(e),
    });
  }
}