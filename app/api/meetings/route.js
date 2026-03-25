import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 30 });

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contact_id = searchParams.get("contact_id");

  let query = supabase.from("meetings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (contact_id) query = query.eq("contact_id", contact_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const { contact_id, date, type, summary, action_items } = body;

  const { data, error } = await supabase
    .from("meetings")
    .insert({ contact_id, date, type, summary, action_items, user_id: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  slack.custom("sales", "새 미팅 기록", `${body.summary || "미팅"} — ${body.type}`, "📅");
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("meetings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("meetings").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
