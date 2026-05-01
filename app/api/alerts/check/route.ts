import { NextResponse } from "next/server";
import crypto from "crypto";

const ZADARMA_KEY = "67270010bcdda0322e85";
const ZADARMA_SECRET = "3f22e0545422f51aa7e9";

function generateSignature(method: string, paramsString: string) {
  const md5 = crypto.createHash("md5").update(paramsString).digest("hex");

  const hmacHex = crypto
    .createHmac("sha1", ZADARMA_SECRET)
    .update(method + paramsString + md5)
    .digest("hex");

  return Buffer.from(hmacHex).toString("base64");
}

export async function GET() {
  const method = "/v1/info/balance/";
  const paramsString = "";
  const signature = generateSignature(method, paramsString);

  const res = await fetch(`https://api.zadarma.com${method}`, {
    method: "GET",
    headers: {
      Authorization: `${ZADARMA_KEY}:${signature}`,
    },
  });

  const text = await res.text();

  return NextResponse.json({
    status: res.status,
    raw: text,
  });
}