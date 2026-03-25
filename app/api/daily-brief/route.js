import { createClient as createAuthClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
  // Auth: CRON_SECRET 또는 Supabase 로그인 유저
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  let authorized = cronSecret === process.env.CRON_SECRET;

  if (!authorized) {
    try {
      const supabaseAuth = await createAuthClient();
      const { data: { user } } = await supabaseAuth.auth.getUser();
      authorized = !!user;
    } catch {
      // cookie context 없는 환경 (Vercel Cron)에서는 무시
    }
  }

  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 날짜 범위 계산
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  try {
    const [
      { data: expensesYesterday },
      { data: contactsAll },
      { data: contactsYesterday },
      { data: leadsAll },
      { data: feedbackAll },
      { data: feedbackYesterday },
      { data: assetsAll },
      { data: followupToday },
    ] = await Promise.all([
      supabase.from("expenses").select("amount").gte("created_at", yesterdayStr).lt("created_at", todayStr),
      supabase.from("contacts").select("id, stage"),
      supabase.from("contacts").select("id").gte("created_at", yesterdayStr).lt("created_at", todayStr),
      supabase.from("leads").select("id, status"),
      supabase.from("feedback").select("rating"),
      supabase.from("feedback").select("id").gte("created_at", yesterdayStr).lt("created_at", todayStr),
      supabase.from("assets").select("id"),
      supabase.from("contacts").select("id, name, company").gte("next_followup_at", todayStr).lt("next_followup_at", `${todayStr}T23:59:59`),
    ]);

    const expenseCount = expensesYesterday?.length || 0;
    const expenseTotal = (expensesYesterday || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const contactsTotal = contactsAll?.length || 0;
    const contactsNew = contactsYesterday?.length || 0;
    const leadsTotal = leadsAll?.length || 0;
    const leadsNew = (leadsAll || []).filter(l => l.status === "new").length;
    const feedbackTotal = feedbackAll?.length || 0;
    const feedbackNew = feedbackYesterday?.length || 0;
    const avgRating = feedbackAll?.length
      ? (feedbackAll.reduce((s, f) => s + (f.rating || 0), 0) / feedbackAll.length).toFixed(1)
      : "—";
    const assetsTotal = assetsAll?.length || 0;
    const followupCount = followupToday?.length || 0;
    const followupNames = (followupToday || []).map(c => `${c.name}${c.company ? ` (${c.company})` : ""}`).join(", ");

    const stats = {
      date: todayStr,
      yesterday: yesterdayStr,
      expenses: { count: expenseCount, total_usd: expenseTotal.toFixed(2) },
      contacts: { total: contactsTotal, new_yesterday: contactsNew },
      leads: { total: leadsTotal, new_status: leadsNew },
      feedback: { total: feedbackTotal, new_yesterday: feedbackNew, avg_rating: avgRating },
      assets: { total: assetsTotal },
      followup_today: { count: followupCount, names: followupNames },
    };

    // Claude로 브리핑 생성
    let briefText = "";
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: "You are a daily briefing agent for TaleNest CEO. Given today's data, write a concise Korean briefing with: 1) 핵심 수치 요약 (3줄), 2) 주의사항, 3) 오늘 추천 액션 2-3개. Keep it under 300 words. Be direct and actionable.",
          messages: [{ role: "user", content: JSON.stringify(stats) }],
        }),
      });
      const aiData = await aiRes.json();
      briefText = aiData.content?.map(b => b.text || "").join("") || "";
    }

    // Slack 전송
    const webhookUrl = process.env.SLACK_WEBHOOK_CEO;
    if (webhookUrl) {
      const dateLabel = new Date(todayStr).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
      const slackText = [
        `☀️ *TaleNest Daily Brief — ${dateLabel}*`,
        "",
        briefText || "_(Claude API 키 미설정)_",
        "",
        `📊 *수치 (어제 기준)*`,
        `• 지출: ${expenseCount}건 $${expenseTotal.toFixed(2)}`,
        `• 연락처: 전체 ${contactsTotal}명 (신규 ${contactsNew})`,
        `• 리드: 전체 ${leadsTotal}개 (신규 ${leadsNew})`,
        `• 피드백: ${feedbackTotal}건 (평점 ${avgRating})`,
        `• 에셋: ${assetsTotal}개`,
        `• 오늘 팔로업: ${followupCount}건${followupNames ? ` — ${followupNames}` : ""}`,
      ].join("\n");

      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slackText }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, brief: briefText, stats });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
