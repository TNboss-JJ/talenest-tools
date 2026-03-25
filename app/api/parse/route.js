import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 5 });

const CATEGORIES = [
  "SaaS/구독", "클라우드/호스팅", "도메인/DNS", "디자인도구",
  "마케팅/광고", "법무/상표", "교통/출장", "사무용품",
  "식비/회의비", "교육/컨퍼런스", "기타"
];

const SYSTEM_PROMPT = `You are an expense extraction agent for a startup called TaleNest.
Extract ALL expense items from the provided content. For each item return a JSON array of objects:
- date: YYYY-MM-DD (guess year if missing, use current year)
- vendor: company/service name
- description: brief description
- amount: number (no currency symbol)
- currency: "USD" or "KRW" or "EUR"
- category: one of [${CATEGORIES.map(c => `"${c}"`).join(", ")}]
- tax_deductible: true/false
- source_type: "receipt_image" | "invoice_pdf" | "card_statement" | "email_confirmation"

Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation.
If no expenses found, return [].`;

// POST /api/parse — AI 영수증/인보이스 분석
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { content, source_file } = body;
    // content: Claude messages content array
    // e.g. [{ type: "image", source: { ... } }, { type: "text", text: "..." }]
    // or [{ type: "text", text: "..." }]

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const text = data.content.map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(clean);

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 500 });
    }

    // Supabase에 바로 저장
    const records = items.map((item) => ({
      user_id: user.id,
      date: item.date,
      vendor: item.vendor,
      description: item.description || "",
      amount: parseFloat(item.amount) || 0,
      currency: item.currency || "USD",
      category: CATEGORIES.includes(item.category) ? item.category : "기타",
      tax_deductible: item.tax_deductible || false,
      source_type: item.source_type || "receipt_image",
      source_file: source_file || null,
    }));

    const { data: saved, error: dbError } = await supabase
      .from("expenses")
      .insert(records)
      .select();

    if (dbError) {
      // DB 저장 실패해도 파싱 결과는 반환
      return NextResponse.json({ parsed: items, saved: false, error: dbError.message });
    }

    slack.expenseParsed(saved.length, source_file);
    return NextResponse.json({ parsed: items, saved: true, records: saved });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
