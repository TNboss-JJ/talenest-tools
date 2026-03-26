import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { slack } from "@/lib/slack";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await slack.testAll();

  const allOk = Object.values(results).every((r) => r.startsWith("success") || r.includes("성공"));
  const missing = Object.entries(results)
    .filter(([, v]) => v.includes("없음"))
    .map(([k]) => `SLACK_WEBHOOK_${k.toUpperCase()}`);

  return NextResponse.json({
    status: allOk ? "all_ok" : "some_failed",
    channels: results,
    missing_env_vars: missing,
    timestamp: new Date().toISOString(),
  });
}
