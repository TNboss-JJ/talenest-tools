import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 3 });

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const { allowed } = limiter.check(ip);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const body = await request.json();
  const { respondent_name, respondent_role, respondent_org, rating, nps, feedback_text } = body;

  if (!feedback_text?.trim()) {
    return NextResponse.json({ error: "feedback_text is required" }, { status: 400 });
  }

  const record = {
    respondent_name: respondent_name || null,
    respondent_role: respondent_role || null,
    respondent_org: respondent_org || null,
    rating: rating ?? null,
    nps: nps ?? null,
    feedback_text,
    channel: "demo",
    demo_version: "PoC v0.9",
    user_id: process.env.OWNER_USER_ID || null,
  };

  const { data, error } = await supabase.from("feedback").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Claude 감성 분석 (비동기, fire-and-forget)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    (async () => {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            system: "Analyze this feedback sentiment. Return JSON: {sentiment: positive|neutral|negative, sentiment_score: 0-1, themes: [max 3], ai_summary: 1 sentence}. Korean feedback. JSON only.",
            messages: [{ role: "user", content: feedback_text }],
          }),
        });
        const aiData = await res.json();
        const text = aiData.content?.map(b => b.text || "").join("") || "{}";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        await supabase.from("feedback").update({
          sentiment: parsed.sentiment,
          sentiment_score: parsed.sentiment_score,
          themes: parsed.themes,
          ai_notes: parsed.ai_summary,
        }).eq("id", data.id);

        slack.newFeedback(respondent_name, respondent_role, parsed.sentiment, rating);
      } catch {
        // 분석 실패 시 기본 알림만 전송
        slack.newFeedback(respondent_name, respondent_role, null, rating);
      }
    })();
  } else {
    slack.newFeedback(respondent_name, respondent_role, null, rating);
  }

  return NextResponse.json({ success: true });
}
