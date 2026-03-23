import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const PROMPTS = {
  analyze_single: `You are a feedback analyst for TaleNest, an EdTech startup building an emotional learning observation platform for children.
Analyze this feedback and return a JSON object:
- sentiment: "positive" | "neutral" | "negative"
- sentiment_score: 0.00 to 1.00 (1 = most positive)
- themes: array of 1-4 theme tags (e.g. "UI/UX", "pricing", "content quality", "4-stage model", "character design", "onboarding", "data privacy", "teacher workflow")
- key_quotes: array of 1-2 most impactful direct quotes from the feedback (under 15 words each)
- action_items: 1-2 sentence actionable next steps
- ai_summary: 1-2 sentence summary

Respond ONLY with valid JSON. No markdown.`,

  analyze_batch: `You are a feedback analyst for TaleNest, an EdTech startup.
Given multiple feedback entries, produce a comprehensive insights report as JSON:
- overall_sentiment: "positive" | "neutral" | "negative"
- avg_sentiment_score: 0.00 to 1.00
- nps_score: calculated NPS if nps ratings available (-100 to 100)
- top_themes: array of {theme, count, sentiment} sorted by frequency
- strengths: array of 2-3 things users love most
- concerns: array of 2-3 main concerns or complaints
- feature_requests: array of specific features or improvements mentioned
- key_quotes: array of 3-5 most impactful quotes (under 15 words each)
- recommendations: array of 3 prioritized action items
- summary: 3-4 sentence executive summary

Respond ONLY with valid JSON. No markdown.`
};

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { action, feedback_text, feedback_id, feedback_list } = await request.json();

    if (action === "analyze_single" && feedback_text) {
      const result = await callClaude(PROMPTS.analyze_single, `Analyze this feedback:\n\n"${feedback_text}"`, apiKey);

      // Auto-save analysis to DB if feedback_id provided
      if (feedback_id) {
        await supabase.from("feedback").update({
          sentiment: result.sentiment,
          sentiment_score: result.sentiment_score,
          themes: result.themes,
          key_quotes: result.key_quotes,
          action_items: result.action_items,
          ai_summary: result.ai_summary
        }).eq("id", feedback_id).eq("user_id", user.id);
      }

      return NextResponse.json({ result });
    }

    if (action === "analyze_batch") {
      let feedbacks;
      if (feedback_list) {
        feedbacks = feedback_list;
      } else {
        const { data } = await supabase.from("feedback").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        feedbacks = data;
      }

      if (!feedbacks || feedbacks.length === 0) {
        return NextResponse.json({ error: "No feedback to analyze" }, { status: 400 });
      }

      const feedbackSummary = feedbacks.map((f, i) =>
        `#${i + 1} [${f.channel || "unknown"}] ${f.respondent_role ? `(${f.respondent_role})` : ""} Rating:${f.rating || "N/A"} NPS:${f.nps || "N/A"}\n"${f.feedback_text}"`
      ).join("\n\n");

      const result = await callClaude(
        PROMPTS.analyze_batch,
        `Analyze these ${feedbacks.length} feedback entries:\n\n${feedbackSummary}`,
        apiKey
      );

      return NextResponse.json({ result, total_analyzed: feedbacks.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function callClaude(system, content, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content.map(b => b.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
