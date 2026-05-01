import { NextResponse } from "next/server";
import crypto from "crypto";

const ZADARMA_KEY = "29405d16f36cf48cc953";
const ZADARMA_SECRET = "0a13f2fb618c6f6b3fb9";

const SIP_NUMBER = "295668"; // твій SIP
const TO = "+380668954751"; // твій мобільний
const CALLER_ID = "+380914810472"; // НОВИЙ номер (інший!)

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

async function zadarmaCall() {
  const method = "/v1/request/callback/";

  const paramsString = buildQuery({
    from: SIP_NUMBER,
    to: TO,
    caller_id: CALLER_ID, // 🔥 ВАЖЛИВО
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

export async function GET() {
  const callResult = await zadarmaCall();

  return NextResponse.json({
    ok: true,
    callResult,
  });
}