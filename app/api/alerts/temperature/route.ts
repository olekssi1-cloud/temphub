import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getFirebaseMessaging } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

type AlarmRow = {
  device_id: number;
  enabled: boolean;
  on_temp: number;
  off_temp: number;
  alarm_active: boolean;
  alert_sent: boolean;
  temp: number | null;
  created_at: string | null;
};

type AlarmAction = "start" | "stop";

async function sendAlarmCommand(
  action: AlarmAction,
  deviceId: number,
  temp: number | null
) {
  const tokenResult = await pool.query<{
    id: number;
    token: string;
  }>(`
    SELECT id, token
    FROM fcm_tokens
    WHERE enabled = true
    ORDER BY id
  `);

  if (tokenResult.rows.length === 0) {
    return {
      ok: false,
      successCount: 0,
      failureCount: 0,
      message: "No enabled FCM tokens",
    };
  }

  const firebaseMessaging = getFirebaseMessaging();

  let successCount = 0;
  let failureCount = 0;
  const invalidTokenIds: number[] = [];

  // Firebase дозволяє не більше 500 токенів в одному запиті.
  for (
    let index = 0;
    index < tokenResult.rows.length;
    index += 500
  ) {
    const chunk = tokenResult.rows.slice(
      index,
      index + 500
    );

    const response =
      await firebaseMessaging.sendEachForMulticast({
        tokens: chunk.map((item) => item.token),
        data: {
          action,
          device_id: String(deviceId),
          temp:
            temp === null
              ? ""
              : String(temp),
        },
        android: {
          priority: "high",
        },
      });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach(
      (item, responseIndex) => {
        if (item.success) {
          return;
        }

        const code =
          item.error?.code ?? "";

        if (
          code ===
            "messaging/registration-token-not-registered" ||
          code ===
            "messaging/invalid-registration-token"
        ) {
          invalidTokenIds.push(
            chunk[responseIndex].id
          );
        }
      }
    );
  }

  if (invalidTokenIds.length > 0) {
    await pool.query(
      `
      UPDATE fcm_tokens
      SET enabled = false,
          updated_at = NOW()
      WHERE id = ANY($1::bigint[])
      `,
      [invalidTokenIds]
    );
  }

  return {
    ok: successCount > 0,
    successCount,
    failureCount,
    disabledInvalidTokens:
      invalidTokenIds.length,
  };
}

async function checkTemperatureAlarms() {
  const alarmResult =
    await pool.query<AlarmRow>(`
      SELECT
        a.device_id,
        a.enabled,
        a.on_temp,
        a.off_temp,
        a.alarm_active,
        a.alert_sent,
        latest.temp,
        latest.created_at
      FROM alarm_settings a
      LEFT JOIN LATERAL (
        SELECT
          tl.temp,
          tl.created_at
        FROM temperature_logs tl
        WHERE CAST(tl.device_id AS TEXT) =
              CAST(a.device_id AS TEXT)
        ORDER BY tl.created_at DESC
        LIMIT 1
      ) latest ON true
      ORDER BY a.device_id
    `);

  const results = [];

  for (const row of alarmResult.rows) {
    const deviceId =
      Number(row.device_id);

    const currentTemp =
      row.temp === null
        ? null
        : Number(row.temp);

    if (
      currentTemp === null ||
      Number.isNaN(currentTemp)
    ) {
      results.push({
        deviceId,
        action: "none",
        reason: "No temperature data",
      });

      continue;
    }

    // Якщо сирену вимкнули в налаштуваннях,
    // але вона зараз активна — надсилаємо stop.
    if (!row.enabled) {
      if (
        row.alarm_active ||
        row.alert_sent
      ) {
        const sendResult =
          await sendAlarmCommand(
            "stop",
            deviceId,
            currentTemp
          );

        if (sendResult.ok) {
          await pool.query(
            `
            UPDATE alarm_settings
            SET alarm_active = false,
                alert_sent = false,
                updated_at = NOW()
            WHERE device_id = $1
            `,
            [deviceId]
          );
        }

        results.push({
          deviceId,
          temp: currentTemp,
          action: "stop",
          reason: "Alarm disabled",
          sendResult,
        });
      } else {
        results.push({
          deviceId,
          temp: currentTemp,
          action: "none",
          reason: "Alarm disabled",
        });
      }

      continue;
    }

    // Температура досягла порога увімкнення.
    if (
      currentTemp >=
        Number(row.on_temp) &&
      !row.alarm_active
    ) {
      const sendResult =
        await sendAlarmCommand(
          "start",
          deviceId,
          currentTemp
        );

      if (sendResult.ok) {
        await pool.query(
          `
          UPDATE alarm_settings
          SET alarm_active = true,
              alert_sent = true,
              updated_at = NOW()
          WHERE device_id = $1
          `,
          [deviceId]
        );
      }

      results.push({
        deviceId,
        temp: currentTemp,
        action: "start",
        threshold:
          Number(row.on_temp),
        sendResult,
      });

      continue;
    }

    // Температура опустилася до порога вимкнення.
    if (
      currentTemp <=
        Number(row.off_temp) &&
      row.alarm_active
    ) {
      const sendResult =
        await sendAlarmCommand(
          "stop",
          deviceId,
          currentTemp
        );

      if (sendResult.ok) {
        await pool.query(
          `
          UPDATE alarm_settings
          SET alarm_active = false,
              alert_sent = false,
              updated_at = NOW()
          WHERE device_id = $1
          `,
          [deviceId]
        );
      }

      results.push({
        deviceId,
        temp: currentTemp,
        action: "stop",
        threshold:
          Number(row.off_temp),
        sendResult,
      });

      continue;
    }

    results.push({
      deviceId,
      temp: currentTemp,
      action: "none",
      alarmActive:
        row.alarm_active,
      onTemp:
        Number(row.on_temp),
      offTemp:
        Number(row.off_temp),
    });
  }

  return results;
}

export async function GET() {
  try {
    const devices =
      await checkTemperatureAlarms();

    return NextResponse.json({
      ok: true,
      checkedDevices:
        devices.length,
      devices,
    });
  } catch (error) {
    console.error(
      "Temperature alarm check error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}