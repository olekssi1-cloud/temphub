import { NextResponse } from "next/server";
import crypto from "crypto";

const KEY = "67270010bcdda0322e85";
const SECRET = "3f22e0545422f51aa7e9";

const FROM = "380914810472";   // твій віртуальний
const TO = "380668954751";     // твій реальний

function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => key + "=" + encodeURIComponent(params[key]))
    .join("&");
}

function sign(method: string, params: string) {
  const md5 = crypto.createHash("md5").update(params).digest("hex");

  const hmac = crypto
    .createHmac("sha1", SECRET)
    .update(method + params + md5)
    .digest("base64");

  return hmac;
}

async function call() {
  const method = "/v1/request/callback/";

  const params = buildQuery({
    from: FROM,
    to: TO,
  });

  const signature = sign(method, params);

  const res = await fetch(
    `https://api.zadarma.com${method}?${params}`,
    {
      headers: {
        Authorization: `${KEY}:${signature}`,
      },
    }
  );

  return res.json();
}

export async function GET() {
  const result = await call();

  return NextResponse.json(result);
}