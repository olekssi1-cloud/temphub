let latestRecord = null;

export async function POST(req) {
  try {
    const body = await req.json();

    latestRecord = {
      device_id: body.device_id || "node1",
      temperature: Number(body.temperature ?? 0),
      sensor_ok: Boolean(body.sensor_ok),
      min12h:
        body.min12h !== undefined && body.min12h !== null
          ? Number(body.min12h)
          : null,
      max12h:
        body.max12h !== undefined && body.max12h !== null
          ? Number(body.max12h)
          : null,
      time: new Date().toISOString(),
    };

    return Response.json(
      { status: "ok" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    return Response.json(
      { status: "error", message: "Invalid JSON" },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}

export async function GET() {
  return Response.json(latestRecord ? [latestRecord] : [], {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}