import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// Перегляд збережених телефонів
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        token,
        device_name,
        enabled,
        updated_at
      FROM fcm_tokens
      ORDER BY updated_at DESC
    `;

    return makeJson({
      ok: true,
      count: rows.length,
      tokens: rows,
    });
  } catch (error) {
    console.error("FCM tokens GET error:", error);

    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}

// Телефон надсилає або оновлює свій Firebase-токен
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const token = String(body.token ?? "").trim();

    const deviceName = String(
      body.device_name ??
      body.deviceName ??
      "Android"
    ).trim();

    if (!token) {
      return makeJson(
        {
          ok: false,
          error: "Firebase token is required",
        },
        400
      );
    }

    const rows = await sql`
      INSERT INTO fcm_tokens (
        token,
        device_name,
        enabled,
        updated_at
      )
      VALUES (
        ${token},
        ${deviceName || "Android"},
        true,
        NOW()
      )
      ON CONFLICT (token)
      DO UPDATE SET
        device_name = EXCLUDED.device_name,
        enabled = true,
        updated_at = NOW()
      RETURNING
        id,
        token,
        device_name,
        enabled,
        updated_at
    `;

    const row = rows[0];

    return makeJson({
      ok: true,
      id: Number(row.id),
      device_name: row.device_name,
      enabled: Boolean(row.enabled),
      updated_at: row.updated_at,
    });
  } catch (error) {
    console.error("FCM token POST error:", error);

    return makeJson(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}