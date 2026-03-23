import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase.from("leads").select("*").eq("user_id", user.id).order("fit_score", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Convert lead to contact
  if (body._action === "convert" && body.lead_id) {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", body.lead_id).eq("user_id", user.id).single();
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const { data: contact, error: cErr } = await supabase.from("contacts").insert({
      user_id: user.id, name: lead.name, email: lead.email,
      company: lead.company, title: lead.title,
      linkedin_url: lead.linkedin_url, website_url: lead.website_url,
      type: "investor", stage: "identified", source: lead.source_url,
      score: lead.fit_score, notes: lead.fit_reason
    }).select().single();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    await supabase.from("leads").update({ status: "converted" }).eq("id", body.lead_id);
    return NextResponse.json({ contact, converted: true }, { status: 201 });
  }

  const items = Array.isArray(body) ? body : [body];
  const records = items.map(item => ({ ...item, user_id: user.id }));

  const { data, error } = await supabase.from("leads").insert(records).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  const { data, error } = await supabase.from("leads").update(updates).eq("id", id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const { error } = await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
