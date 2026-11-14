import { NextResponse } from "next/server";

import { env } from "~/env";
import { runDailyJob } from "~/server/jobs/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyJob();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "The daily job failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
