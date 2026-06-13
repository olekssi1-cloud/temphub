import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// ================= ZADARMA =================
const ZADARMA_KEY = process.env.ZADARMA_KEY;
const ZADARMA_SECRET = process.env.ZADARMA_SECRET;

const FROM = "100";
const SIP = "100";

const PHONES = ["380668954751"];

// ================= SETTINGS =================
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
    throw new Error("Missing ZADARMA_SECRET");
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
    throw new Error("Missing ZADARMA_KEY");
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
    // 1. Беремо всі ESP, які хоч раз передавали температуру
    const devicesResult = await pool.query(`
      SELECT
        device_id,
        MAX(created_at) AS last_seen_at
      FROM temperature_logs
      GROUP BY device_id
      ORDER BY CAST(device_id AS INTEGER)
    `);

    if (devicesResult.rows.length === 0) {
      return NextResponse.json({
        ok: true,
        alert: false,
        message: "No devices registered yet",
        checkedDevices: 0,
      });
    }

    const now = new Date();
    const results = [];
    let callWasSent = false;
    let calledForDevice: string | null = null;
    let callResults: any[] = [];

    for (const row of devicesResult.rows) {
      const deviceId = String(row.device_id);
      const lastSeenAt = new Date(row.last_seen_at);

      const diffMinutes =
        (now.getTime() - lastSeenAt.getTime()) / 1000 / 60;

      // 2. Створюємо стан для нового ESP автоматично
      await pool.query(
        `
        INSERT INTO alert_state (device_id, alert_sent, updated_at)
        VALUES ($1, false, NOW())
        ON CONFLICT (device_id) DO NOTHING
        `,
        [deviceId]
      );

      const stateResult = await pool.query(
        `
        SELECT alert_sent
        FROM alert_state
        WHERE device_id = $1
        `,
        [deviceId]
      );

      const alertSent = stateResult.rows[0]?.alert_sent === true;

      // 3. Якщо ESP онлайн — скидаємо антиспам
      if (diffMinutes <= OFFLINE_AFTER_MINUTES) {
        await pool.query(
          `
          UPDATE alert_state
          SET alert_sent = false,
              updated_at = NOW()
          WHERE device_id = $1
          `,
          [deviceId]
        );

        results.push({
          deviceId,
          online: true,
          alertSent: false,
          diffMinutes,
          lastSeenAt: lastSeenAt.toISOString(),
        });

        continue;
      }

      // 4. ESP офлайн, але по ньому вже дзвонили — більше не дзвонимо
      if (alertSent) {
        results.push({
          deviceId,
          online: false,
          alertAlreadySent: true,
          diffMinutes,
          lastSeenAt: lastSeenAt.toISOString(),
        });

        continue;
      }

      // 5. ESP офлайн > 5 хв і ще не дзвонили
      // Дзвонимо тільки один раз за запуск цієї перевірки
      if (!callWasSent) {
        for (const phone of PHONES) {
          const callResult = await zadarmaCall(phone);

          callResults.push({
            phone,
            result: callResult,
          });
        }

        callWasSent = true;
        calledForDevice = deviceId;
      }

      // 6. По цьому ESP ставимо, що дзвінок вже був
      await pool.query(
        `
        UPDATE alert_state
        SET alert_sent = true,
            updated_at = NOW()
        WHERE device_id = $1
        `,
        [deviceId]
      );

      results.push({
        deviceId,
        online: false,
        callSent: !alertSent && calledForDevice === deviceId,
        diffMinutes,
        lastSeenAt: lastSeenAt.toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      alert: callWasSent,
      callSent: callWasSent,
      calledForDevice,
      checkedDevices: devicesResult.rows.length,
      callResults,
      devices: results,
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