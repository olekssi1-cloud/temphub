import { NextResponse } from "next/server";
import crypto from "crypto";

// ❗ ВСТАВ СВОЇ КЛЮЧІ ТУТ (з Zadarma)
const ZADARMA_KEY = "67270010bcdda0322e85";
const ZADARMA_SECRET = "3f22e0545422f51aa7e9";

const SIP_NUMBER = "295668";
const TO = "+380668954751";
const CALLER_ID = "+380914810472";

function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function generateSignature(method: string, paramsString: string) {
  const md5 = crypto.createHash("md5").update(paramsString).digest("hex");

  const hmac = crypto
    .createHmac("sha1", ZADARMA_SECRET)
    .update(method + paramsString + md5)
    .digest("base64");

  return hmac;
}

async function zadarmaCall() {
  const method = "/v1/request/callback/";

  const paramsString = buildQuery({
    from: SIP_NUMBER,
    to: TO,
    caller_id: CALLER_ID,
  });

  const signature = generateSignature(method, paramsString);

  const res = await fetch(`https://api.zadarma.com${method}?${paramsString}`, {
    method: "GET",
    headers: {
      Authorization: `${ZADARMA_KEY}:${signature}`,
    },
  });

  return res.json();
}

export async function GET() {
  const result = await zadarmaCall();

  return NextResponse.json({
    ok: true,
    result,
  });
}