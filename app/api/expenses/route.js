import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/expenses — 전체 조회 (필터, 정렬 지원)
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const from = searchParams.get("from");  // YYYY-MM-DD
  const to = searchParams.get("to");      // YYYY-MM-DD
  const sort = searchParams.get("sort") || "date";
  const order = searchParams.get("order") || "desc";

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order(sort, { ascending: order === "asc" });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/expenses — 새 지출 추가 (단건 또는 배열)
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const items = Array.isArray(body) ? body : [body];

  const records = items.map((item) => ({
    user_id: user.id,
    date: item.date,
    vendor: item.vendor,
    description: item.description || "",
    amount: parseFloat(item.amount) || 0,
    currency: item.currency || "USD",
    category: item.category || "기타",
    tax_deductible: item.tax_deductible || false,
    source_type: item.source_type || "manual",
    source_file: item.source_file || null,
    notes: item.notes || null,
  }));

  const { data, error } = await supabase
    .from("expenses")
    .insert(records)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/expenses?id=xxx — 삭제
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}

// PATCH /api/expenses — 수정
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
