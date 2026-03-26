/**
 * app/api/social/route.js
 * Social Scheduler — SNS 콘텐츠 초안 생성 + 스케줄 관리 API
 */
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 20 });
const aiLimiter = rateLimit({ windowMs: 60_000, max: 5 });

// ─── GET: 소셜 포스트 조회 ────────────────────────────────────
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  let query = supabase
    .from("social_posts")
    .select("*")
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (platform) query = query.eq("platform", platform);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// ─── POST: 포스트 추가 or AI 초안 생성 ───────────────────────
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // ── AI 초안 생성 ─────────────────────────────────────────────
  if (body._action === "ai_generate") {
    const { aiAllowed } = aiLimiter.check(user.id);
    if (!aiAllowed) return NextResponse.json({ error: "AI 요청 한도 초과 (분당 5회)" }, { status: 429 });

    const { platform, topic, emotion, tone, language = "ko", campaign } = body;

    const platformGuide = {
      instagram: "인스타그램 (이모지 많이, 해시태그 10-15개, 감성적, 2200자 이내)",
      threads: "스레드 (짧고 임팩트 있게, 500자 이내, 대화체)",
      linkedin: "링크드인 (전문적, 인사이트 중심, 1300자 이내, 에듀테크 업계)",
      twitter: "트위터/X (간결, 280자 이내, 해시태그 2-3개)",
    }[platform] ?? platform;

    const prompt = `당신은 TaleNest® 에듀테크 스타트업의 SNS 마케터입니다.
TaleNest는 아이의 감정 학습 과정을 데이터로 기록하는 Observation Platform입니다.
캐릭터 8종, 49가지 감정, 44개의 감정 동화를 보유하고 있습니다.

다음 조건으로 ${platformGuide}용 포스트를 작성해주세요:

- 주제: ${topic}
- 감정 키워드: ${emotion ?? "자유"}
- 톤앤매너: ${tone ?? "따뜻하고 전문적"}
- 언어: ${language === "ko" ? "한국어" : "영어"}
${campaign ? `- 캠페인: ${campaign}` : ""}

JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "content": "포스트 본문 (플랫폼 가이드라인 준수)",
  "hashtags": ["해시태그1", "해시태그2"],
  "alt_versions": ["대안1", "대안2"]
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const aiData = await response.json();
      const raw = aiData.content[0].text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);

      return NextResponse.json({ draft: parsed, ai_generated: true });
    } catch (err) {
      return NextResponse.json({ error: "AI 생성 실패: " + err.message }, { status: 500 });
    }
  }

  // ── 포스트 저장 ─────────────────────────────────────────────
  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { platform, content, hashtags, image_url, scheduled_at, ai_generated, emotion_tag, campaign } = body;

  if (!platform || !content) {
    return NextResponse.json({ error: "platform, content 필수" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      platform, content, hashtags, image_url, scheduled_at,
      ai_generated: ai_generated ?? false,
      emotion_tag, campaign,
      status: scheduled_at ? "scheduled" : "draft",
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// ─── PATCH: 포스트 수정 or 발행 처리 ─────────────────────────
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const { id, _action, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  // 발행 완료 처리
  if (_action === "mark_posted") {
    updates.status = "posted";
    updates.posted_at = new Date().toISOString();

    // 포스트 조회해서 Slack 알림
    const { data: post } = await supabase
      .from("social_posts")
      .select("platform, content")
      .eq("id", id)
      .single();

    if (post) {
      await slack.socialPosted(post.platform, post.content);
    }
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── DELETE: 포스트 삭제 ──────────────────────────────────────
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
