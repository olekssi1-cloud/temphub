import { NextResponse } from "next/server";
import crypto from "crypto";

const KEY = "67270010bcdda0322e85";
const SECRET = "3f22e0545422f51aa7e9";

function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => key + "=" + encodeURIComponent(params[key]))
    .join("&");
}

function sign(method: string, params: string) {
  const md5 = crypto.createHash("md5").update(params).digest("hex");

  return crypto
    .createHmac("sha1", SECRET)
    .update(method + params + md5)
    .digest("base64");
}

async function call() {
  const method = "/v1/request/callback/";

  const params = buildQuery({
    from: "380914810472",
    to: "380668954751",
    sip: "295668",   // 🔥 ОСЬ ГОЛОВНЕ
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