/**
 * app/api/slack-test/route.js
 * Slack 5채널 연동 상태 확인용 테스트 엔드포인트
 * 사용: 브라우저에서 https://tools.talenest.org/api/slack-test 접속
 */
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { slack } from "@/lib/slack";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await slack.testAll();

  const allOk = Object.values(results).every((r) => r.startsWith("✅"));
  const missing = Object.entries(results)
    .filter(([, v]) => v.includes("환경변수"))
    .map(([k]) => `SLACK_WEBHOOK_${k.toUpperCase()}`);

  return NextResponse.json({
    status: allOk ? "✅ 전체 연동 정상" : "⚠️ 일부 채널 문제 있음",
    channels: results,
    missing_env_vars: missing,
    timestamp: new Date().toISOString(),
  });
}
