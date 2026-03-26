/**
 * app/api/legal/route.js
 * Legal Tracker — 상표/계약/기한 관리 API
 */
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 30 });

// ─── GET: 법무 항목 조회 ──────────────────────────────────────
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status") ?? "active";

  let query = supabase
    .from("legal_items")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (type) query = query.eq("type", type);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 마감일까지 남은 일수 계산
  const today = new Date();
  const enriched = (data ?? []).map((item) => ({
    ...item,
    days_left: item.due_date
      ? Math.ceil((new Date(item.due_date) - today) / (1000 * 60 * 60 * 24))
      : null,
  }));

  return NextResponse.json(enriched);
}

// ─── POST: 법무 항목 추가 ─────────────────────────────────────
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const { type, title, jurisdiction, filing_date, due_date, registration_number, notes, drive_url, notify_days } = body;

  if (!type || !title) return NextResponse.json({ error: "type, title 필수" }, { status: 400 });

  const { data, error } = await supabase
    .from("legal_items")
    .insert({
      type, title, jurisdiction, filing_date, due_date,
      registration_number, notes, drive_url,
      notify_days: notify_days ?? 30,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 마감일이 가까우면 즉시 Slack 알림
  if (due_date) {
    const daysLeft = Math.ceil((new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= (notify_days ?? 30)) {
      await slack.legalDeadline(title, type, due_date, daysLeft);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

// ─── PATCH: 법무 항목 수정 ────────────────────────────────────
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { data, error } = await supabase
    .from("legal_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── DELETE: 법무 항목 삭제 ──────────────────────────────────
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { error } = await supabase
    .from("legal_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
