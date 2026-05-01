import { NextResponse } from "next/server";
import crypto from "crypto";

// ================== ТВОЇ ДАНІ ==================
const ZADARMA_KEY = "67270010bcdda0322e85";
const ZADARMA_SECRET = "3f22e0545422f51aa7e9";

// беремо з env
const SIP = process.env.295668!;
const PHONE = process.env.+380668954751!;

// ================== HELPERS ==================
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

// ================== CALL ==================
async function zadarmaCall() {
  const method = "/v1/request/callback/";

  const paramsString = buildQuery({
    from: SIP,
    to: PHONE,
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

// ================== API ==================
export async function GET() {
  const callResult = await zadarmaCall();

  return NextResponse.json({
    ok: true,
    callResult,
  });
}