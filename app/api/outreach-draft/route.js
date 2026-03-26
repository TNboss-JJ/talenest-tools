import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ windowMs: 60_000, max: 10 });

// GET: list outreach drafts
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("outreach_drafts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: generate outreach draft via Claude
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { contact_id, name, company, notes } = await request.json();
  if (!contact_id || !name) return NextResponse.json({ error: "contact_id, name required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let subject = `TaleNest 파일럿 제안 — ${company || name}`;
  let body = `안녕하세요, ${company || name} 관계자님.\n\nTaleNest에서 감정 학습 파일럿 프로그램을 제안드립니다.`;

  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `당신은 TaleNest® 에듀테크 스타트업 CEO입니다.
TaleNest는 아이의 감정 학습 과정을 데이터로 기록하는 Observation Platform입니다.
${company || name}에 보낼 첫 컨택 메일을 작성해주세요.
기관 특징: ${notes || "정보 없음"}
조건: 짧고 따뜻하게, 부담없이, 파일럿 제안 포함, 한국어

JSON으로만 응답: { "subject": "메일 제목", "body": "메일 본문" }`
          }],
        }),
      });
      const aiData = await res.json();
      const raw = aiData.content?.[0]?.text?.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      subject = parsed.subject || subject;
      body = parsed.body || body;
    } catch (e) {
      // Claude failed, use defaults
    }
  }

  const { data, error } = await supabase
    .from("outreach_drafts")
    .insert({ contact_id, name, company, subject, body, status: "draft", user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH: update draft status (sent / skipped)
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id, status required" }, { status: 400 });

  const { data, error } = await supabase
    .from("outreach_drafts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
