import { NextResponse } from "next/server";
import crypto from "crypto";

const ZADARMA_KEY = "67270010bcdda0322e85";
const ZADARMA_SECRET = "3f22e0545422f51aa7e9";

const FROM = "380914810472";   // Твій телефон (перший дзвонить Zadarma)
const TO = "380668954751";     // Куди з'єднувати (можна той самий)
const SIP = "295668"; // Важливо! Для CallerID з віртуального номера

function buildQuery(params: Record<string, string | number>) {
  return Object.keys(params)
    .sort() 
    .map((key) => `\( {encodeURIComponent(key)}= \){encodeURIComponent(params[key])}`)
    .join("&");
}

function generateSignature(method: string, paramsStr: string) {
  const md5 = crypto.createHash("md5").update(paramsStr).digest("hex");

  const toSign = method + paramsStr + md5;
  const hmac = crypto.createHmac("sha1", ZADARMA_SECRET).update(toSign).digest("hex");

  return Buffer.from(hmac, "hex").toString("base64"); // Важливо: hex -> base64
}

async function zadarmaCall() {
  const method = "/v1/request/callback/";

  const params: Record<string, string> = {
    from: FROM,
    to: TO,
  };

  if (SIP) params.sip = SIP;           // Для віртуального CallerID
  // params.predicted = "1";           // Якщо хочеш "передбачуваний" режим

  const paramsString = buildQuery(params);

  const signature = generateSignature(method, paramsString);

  const url = `https://api.zadarma.com\( {method}? \){paramsString}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `\( {ZADARMA_KEY}: \){signature}`,
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text, status: res.status };
  }

  return { status: res.status, data };
}

export async function GET() {
  const result = await zadarmaCall();
  return NextResponse.json(result);
}