import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ windowMs: 60_000, max: 10 });

const PROMPTS = {
  scrape_leads: `You are a lead research agent for TaleNest, an EdTech startup building an emotional learning observation platform for children.
Given the text content, extract potential investor/partner leads. For each lead return a JSON array:
- name: person's full name
- company: firm/organization name
- title: their role/title
- email: if found (or null)
- linkedin_url: if found (or null)
- website_url: company website if found (or null)
- fit_score: 0-100 how relevant they are to TaleNest (EdTech, children, AI, early-stage VC)
- fit_reason: 1-2 sentence explanation of why they're a good/bad fit

Respond ONLY with a valid JSON array. No markdown, no backticks.
If no leads found, return [].`,

  enrich_contact: `You are a research agent. Given this contact info, provide enriched intelligence:
- summary: 2-3 sentence bio
- investment_focus: what sectors/stages they invest in
- portfolio_relevant: any portfolio companies similar to EdTech/children/AI
- talking_points: 3 specific conversation starters based on their background
- estimated_check_size: if investor, typical check size
- risk_factors: potential concerns about fit

Respond ONLY with valid JSON object. No markdown.`,

  draft_outreach: `You are an outreach copywriter for TaleNest, an EdTech startup.
TaleNest builds an emotional learning observation platform that records children's emotional development data.
Key stats: 49 emotions, 44 stories, 1176 workbooks, 49 emotion songs, 8 characters.
US trademark registered. PoC 90% complete. Targeting institutional clients (teachers, principals).

Given this contact info, draft a personalized cold outreach email:
- subject: compelling, short subject line
- body: brief, personal, not salesy, mention specific connection points
- followup: a 2-line followup for 5 days later

Respond ONLY with valid JSON: { subject, body, followup }. No markdown.`
};

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { action, content, contact } = await request.json();
    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    let userContent;
    if (action === "scrape_leads") {
      userContent = `Extract leads from this content:\n\n${content}`;
    } else if (action === "enrich_contact") {
      userContent = `Enrich this contact:\n${JSON.stringify(contact)}`;
    } else if (action === "draft_outreach") {
      userContent = `Draft outreach for:\n${JSON.stringify(contact)}`;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    // Auto-save leads to DB
    if (action === "scrape_leads" && Array.isArray(result)) {
      const records = result.map(lead => ({
        user_id: user.id,
        name: lead.name,
        company: lead.company,
        title: lead.title,
        email: lead.email,
        linkedin_url: lead.linkedin_url,
        website_url: lead.website_url,
        fit_score: lead.fit_score || 0,
        fit_reason: lead.fit_reason,
        source_url: content.substring(0, 200),
        status: "new",
        raw_data: lead,
      }));

      const { data: saved } = await supabase.from("leads").insert(records).select();
      return NextResponse.json({ leads: result, saved: saved?.length || 0 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
