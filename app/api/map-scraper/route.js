import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ windowMs: 60_000, max: 10 });

const FIT_PROMPT = `You are a lead qualification agent for TaleNest, an EdTech startup building an emotional learning observation platform for children ages 3-7.
Target customers: daycares (어린이집), kindergartens (유치원), preschools, children's education centers, after-school programs.

Given a list of institutions from Google Maps, score each one:
- fit_score: 0-100 (how likely they are a TaleNest customer)
- fit_reason: 1 sentence why (Korean)
- contact_priority: "high" | "medium" | "low"

Scoring guide:
- 80-100: Direct match (어린이집, 유치원, 아동교육)
- 50-79: Related (학원, 교육센터, 문화센터 with children programs)
- 0-49: Weak match (일반 학원, unrelated)

Respond ONLY with a JSON array matching the input order. No markdown.`;

// POST /api/map-scraper
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not configured" }, { status: 500 });

  try {
    const { action, query, location, radius, pageToken, places } = await request.json();

    // Action 1: Search places
    if (action === "search") {
      if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

      const searchQuery = location ? `${query} ${location}` : query;
      const params = new URLSearchParams({
        query: searchQuery,
        key: placesKey,
        language: "ko",
      });
      if (pageToken) params.set("pagetoken", pageToken);

      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
      const data = await res.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        return NextResponse.json({ error: `Google API: ${data.status} - ${data.error_message || ""}` }, { status: 500 });
      }

      const results = (data.results || []).map(p => ({
        place_id: p.place_id,
        name: p.name,
        address: p.formatted_address,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
        rating: p.rating || null,
        total_ratings: p.user_ratings_total || 0,
        types: p.types || [],
        open_now: p.opening_hours?.open_now,
      }));

      return NextResponse.json({
        results,
        total: results.length,
        next_page_token: data.next_page_token || null
      });
    }

    // Action 2: Get place details (phone, website)
    if (action === "details") {
      const { place_ids } = await request.json();
      if (!place_ids?.length) return NextResponse.json({ error: "place_ids required" }, { status: 400 });

      const detailed = [];
      for (const pid of place_ids.slice(0, 20)) {
        const params = new URLSearchParams({
          place_id: pid,
          key: placesKey,
          language: "ko",
          fields: "name,formatted_address,formatted_phone_number,website,url,rating,user_ratings_total,opening_hours,types"
        });

        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
        const data = await res.json();

        if (data.result) {
          detailed.push({
            place_id: pid,
            name: data.result.name,
            address: data.result.formatted_address,
            phone: data.result.formatted_phone_number || null,
            website: data.result.website || null,
            google_maps_url: data.result.url || null,
            rating: data.result.rating || null,
            total_ratings: data.result.user_ratings_total || 0,
            types: data.result.types || [],
            hours: data.result.opening_hours?.weekday_text || [],
          });
        }
      }

      return NextResponse.json({ details: detailed });
    }

    // Action 3: AI fit analysis + save to leads
    if (action === "analyze") {
      if (!places?.length) return NextResponse.json({ error: "places required" }, { status: 400 });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      let analyzed = places.map(p => ({ ...p, fit_score: 50, fit_reason: "분석 대기중", contact_priority: "medium" }));

      if (apiKey) {
        try {
          const placeSummary = places.map((p, i) =>
            `#${i + 1} "${p.name}" — ${p.address} | Types: ${(p.types || []).join(", ")} | Rating: ${p.rating || "N/A"}`
          ).join("\n");

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              system: FIT_PROMPT,
              messages: [{ role: "user", content: `Analyze these ${places.length} institutions:\n\n${placeSummary}` }]
            })
          });

          const aiData = await res.json();
          const text = aiData.content?.map(b => b.text || "").join("") || "[]";
          const scores = JSON.parse(text.replace(/```json|```/g, "").trim());

          if (Array.isArray(scores)) {
            analyzed = places.map((p, i) => ({
              ...p,
              fit_score: scores[i]?.fit_score || 50,
              fit_reason: scores[i]?.fit_reason || "",
              contact_priority: scores[i]?.contact_priority || "medium"
            }));
          }
        } catch (e) {
          // Claude failed, continue with defaults
        }
      }

      // Save to leads
      const records = analyzed.map(p => ({
        user_id: user.id,
        name: p.name,
        company: p.name,
        title: p.types?.includes("school") ? "교육기관" : "어린이집/유치원",
        email: null,
        linkedin_url: null,
        website_url: p.website || p.google_maps_url || null,
        source_url: p.google_maps_url || `maps:${p.address}`,
        fit_score: p.fit_score,
        fit_reason: `${p.fit_reason} | ${p.address} | ${p.phone || "전화없음"} | 평점 ${p.rating || "N/A"}`,
        status: "new",
        raw_data: p,
      }));

      const { data: saved, error: dbErr } = await supabase.from("leads").insert(records).select();
      if (dbErr) return NextResponse.json({ error: dbErr.message, analyzed }, { status: 500 });

      return NextResponse.json({ analyzed, saved: saved?.length || 0 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
