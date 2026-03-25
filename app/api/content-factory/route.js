import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 3 });

async function callClaude(system, user, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const { emotion, character, stage } = await request.json();
  if (!emotion?.trim()) return NextResponse.json({ error: "emotion is required" }, { status: 400 });

  const userContext = `Emotion: ${emotion}, Character: ${character || "Nesto"}, Stage: ${stage || "recognition"}`;

  try {
    // 3 Claude calls (sequential)
    const [story, workbook, song] = await Promise.all([
      callClaude(
        `You are a children's story writer for TaleNest, an emotional learning platform for children ages 3-7. Write a story script about the emotion provided. The story features TaleNest characters. Return JSON:
{
  "title_ko": "한국어 제목",
  "title_en": "English title",
  "pages": [
    { "page": 1, "text_ko": "한국어 텍스트", "text_en": "English text", "illustration_prompt": "삽화 설명", "pause_and_think": "아이에게 질문 또는 null" }
  ]
}
8-10 pages. Simple language for 3-7 year olds. Each page 2-3 sentences. Include the character's name and emotional journey. Pause & Think questions should encourage emotional reflection.
Respond ONLY with valid JSON.`,
        userContext,
        apiKey
      ),
      callClaude(
        `You are an educational worksheet designer for TaleNest. Create a workbook structure for children ages 3-7 learning about the given emotion. Return JSON:
{
  "title_ko": "한국어 제목",
  "title_en": "English title",
  "pages": [
    { "page": 1, "type": "activity type", "title_ko": "한국어 제목", "title_en": "English title", "instruction_ko": "한국어 설명", "instruction_en": "English instruction", "illustration_prompt": "삽화/레이아웃 설명" }
  ]
}
24 pages. Activity types: coloring, drawing, matching, circling, tracing, writing, cut_paste, maze, sorting, emotion_wheel, role_play_prompt, breathing_exercise.
Mix different activity types. Progress from simple (recognition) to complex (regulation).
Respond ONLY with valid JSON.`,
        userContext,
        apiKey
      ),
      callClaude(
        `You are a children's song lyricist for TaleNest. Write a simple, catchy song about the given emotion for children ages 3-7. Return JSON:
{
  "title_ko": "한국어 제목",
  "title_en": "English title",
  "lyrics_ko": "한국어 가사 (verse 1, chorus, verse 2, chorus, outro)",
  "lyrics_en": "English lyrics",
  "style_prompt": "Suno AI용 스타일 설명 (예: cheerful children's acoustic, warm ukulele)",
  "tempo": "BPM 추천",
  "duration": "추천 길이"
}
Simple repetitive lyrics. Easy to sing along. Include the emotion word in the chorus.
Respond ONLY with valid JSON.`,
        `Emotion: ${emotion}, Character: ${character || "Nesto"}`,
        apiKey
      ),
    ]);

    // Save 3 assets
    const records = [
      { type: "story", title: story.title_ko, emotion, character, stage, notes: JSON.stringify(story), user_id: user.id },
      { type: "workbook", title: workbook.title_ko, emotion, character, stage, notes: JSON.stringify(workbook), user_id: user.id },
      { type: "song", title: song.title_ko, emotion, character, notes: JSON.stringify(song), user_id: user.id },
    ];

    const { error: dbErr } = await supabase.from("assets").insert(records);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    slack.custom("content", "콘텐츠 팩토리 완료", `${emotion} — 스토리 + 워크북 + 감정송 생성 완료`, "🏭");

    return NextResponse.json({ story, workbook, song, saved: 3 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
