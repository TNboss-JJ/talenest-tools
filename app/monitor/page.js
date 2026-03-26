"use client";
/**
 * app/monitor/page.js
 * Site Monitor — 업타임 모니터링 대시보드
 */
import { useState, useEffect, useCallback } from "react";

const PLATFORMS = [
  { label: "메인 사이트", url: "https://talenest.org", id: "main" },
  { label: "SaaS 앱", url: "https://talenest.io", id: "saas" },
  { label: "PoC", url: "https://poc.talenest.io", id: "poc" },
  { label: "Tools Hub", url: "https://tools.talenest.org", id: "tools" },
];

export default function MonitorPage() {
  const [targets, setTargets] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/monitor");
    if (res.ok) {
      const { targets: t, checks: c } = await res.json();
      setTargets(t);
      setChecks(c);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function checkAll() {
    setChecking(true);
    await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "check_now" }),
    });
    await load();
    setChecking(false);
  }

  async function addTarget(e) {
    e.preventDefault();
    if (!newUrl || !newLabel) return;
    setAddingUrl(true);
    await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "add_target", url: newUrl, label: newLabel }),
    });
    setNewUrl(""); setNewLabel("");
    await load();
    setAddingUrl(false);
  }

  async function removeTarget(id) {
    await fetch(`/api/monitor?id=${id}`, { method: "DELETE" });
    await load();
  }

  // 각 URL의 최신 상태
  function latestStatus(url) {
    return checks.find((c) => c.url === url);
  }

  function uptimePercent(url) {
    const urlChecks = checks.filter((c) => c.url === url);
    if (!urlChecks.length) return null;
    const up = urlChecks.filter((c) => c.status === "up").length;
    return Math.round((up / urlChecks.length) * 100);
  }

  const StatusBadge = ({ status }) => {
    const cfg = {
      up: "bg-emerald-100 text-emerald-700 border-emerald-200",
      down: "bg-red-100 text-red-700 border-red-200",
      unknown: "bg-gray-100 text-gray-500 border-gray-200",
    };
    const labels = { up: "● 정상", down: "● 다운", unknown: "○ 미확인" };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg[status ?? "unknown"]}`}>
        {labels[status ?? "unknown"]}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <a href="/" className="text-sm text-[#4E6F79] hover:underline">← Tools Hub</a>
            <h1 className="text-2xl font-bold text-[#2d4a52] mt-1">🔍 Site Monitor</h1>
            <p className="text-sm text-gray-500">TaleNest 도메인 업타임 모니터링</p>
          </div>
          <button
            onClick={checkAll}
            disabled={checking}
            className="px-4 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] disabled:opacity-50 transition-colors"
          >
            {checking ? "⏳ 체크 중..." : "🔄 전체 체크"}
          </button>
        </div>

        {/* 요약 카드 */}
        {!loading && targets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {targets.map((t) => {
              const latest = latestStatus(t.url);
              const uptime = uptimePercent(t.url);
              return (
                <div key={t.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-xs text-gray-400 mb-1 truncate">{t.label}</div>
                  <StatusBadge status={latest?.status} />
                  {latest?.response_time && (
                    <div className="text-xs text-gray-400 mt-2">{latest.response_time}ms</div>
                  )}
                  {uptime !== null && (
                    <div className="text-xs font-medium text-[#4E6F79] mt-1">{uptime}% uptime</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 모니터링 대상 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">모니터링 대상</h2>
            <span className="text-xs text-gray-400">{targets.length}개 등록</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : targets.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">🌐</div>
              <div className="text-sm">모니터링 대상을 추가하세요</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {targets.map((t) => {
                const latest = latestStatus(t.url);
                return (
                  <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                    <StatusBadge status={latest?.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{t.label}</div>
                      <div className="text-xs text-gray-400 truncate">{t.url}</div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      {latest?.response_time ? (
                        <span className={latest.response_time > 3000 ? "text-amber-500" : "text-emerald-500"}>
                          {latest.response_time}ms
                        </span>
                      ) : "—"}
                      {latest?.checked_at && (
                        <div>{new Date(latest.checked_at).toLocaleTimeString("ko-KR")}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeTarget(t.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 대상 추가 */}
          <form onSubmit={addTarget} className="px-5 py-4 border-t border-gray-50 flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="이름 (예: PoC)"
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]"
            />
            <button
              type="submit"
              disabled={addingUrl || !newUrl || !newLabel}
              className="px-4 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] disabled:opacity-40 transition-colors"
            >
              {addingUrl ? "추가 중..." : "+ 추가"}
            </button>
          </form>
        </div>

        {/* 최근 체크 로그 */}
        {checks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">최근 24시간 로그</h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {checks.slice(0, 20).map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
                  <StatusBadge status={c.status} />
                  <span className="text-gray-500 truncate flex-1">{c.url}</span>
                  <span className={c.response_time > 3000 ? "text-amber-500" : "text-gray-400"}>
                    {c.response_time ? `${c.response_time}ms` : "—"}
                  </span>
                  <span className="text-gray-300">
                    {new Date(c.checked_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
