/**
 * app/api/monitor/route.js
 * Site Monitor — 업타임 체크 API
 */
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 30 });

// 체크 타임아웃 (ms)
const TIMEOUT_MS = 10_000;

// ─── GET: 모니터링 대상 + 최근 체크 결과 조회 ────────────────
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // 모니터링 대상
  const { data: targets, error: tErr } = await supabase
    .from("monitor_targets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  // 각 대상의 최근 24시간 체크 기록
  const { data: checks } = await supabase
    .from("uptime_checks")
    .select("url, status, status_code, response_time, checked_at")
    .eq("user_id", user.id)
    .gte("checked_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("checked_at", { ascending: false });

  return NextResponse.json({ targets: targets ?? [], checks: checks ?? [] });
}

// ─── POST: 즉시 체크 실행 or 대상 추가 ──────────────────────
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();

  // 대상 추가
  if (body._action === "add_target") {
    const { url, label, notify_slack = true, interval_minutes = 10 } = body;
    if (!url || !label) return NextResponse.json({ error: "url, label 필수" }, { status: 400 });

    const { data, error } = await supabase
      .from("monitor_targets")
      .insert({ url, label, notify_slack, interval_minutes, user_id: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  // 즉시 체크 실행
  if (body._action === "check_now" || body.url) {
    const urlsToCheck = body.url ? [{ url: body.url, label: body.label ?? body.url }] : [];

    // 대상 목록에서 체크
    if (!body.url) {
      const { data: targets } = await supabase
        .from("monitor_targets")
        .select("url, label, notify_slack")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (targets) urlsToCheck.push(...targets);
    }

    const results = await Promise.all(urlsToCheck.map((target) => checkUrl(target.url)));

    // DB에 결과 저장
    const rows = urlsToCheck.map((target, i) => ({
      user_id: user.id,
      url: target.url,
      label: target.label,
      status: results[i].status,
      status_code: results[i].statusCode,
      response_time: results[i].responseTime,
      error_message: results[i].error,
    }));

    await supabase.from("uptime_checks").insert(rows);

    // 다운된 사이트 Slack 알림
    for (let i = 0; i < urlsToCheck.length; i++) {
      const r = results[i];
      if (r.status === "down") {
        await slack.siteDown(urlsToCheck[i].url, r.statusCode, r.responseTime);
      }
    }

    return NextResponse.json({ results: rows });
  }

  return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
}

// ─── DELETE: 모니터링 대상 제거 ──────────────────────────────
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { error } = await supabase
    .from("monitor_targets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ─── 내부: URL 체크 함수 ─────────────────────────────────────
async function checkUrl(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - start;
    const isUp = res.status < 400;

    return {
      status: isUp ? "up" : "down",
      statusCode: res.status,
      responseTime,
      error: isUp ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      statusCode: null,
      responseTime: Date.now() - start,
      error: err.name === "AbortError" ? `타임아웃 (${TIMEOUT_MS}ms 초과)` : err.message,
    };
  }
}
