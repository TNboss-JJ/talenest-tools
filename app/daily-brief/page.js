"use client";
import { useState } from "react";

export default function DailyBriefPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runBrief = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/daily-brief");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다");
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const S = {
    btn: { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: "linear-gradient(135deg, #534AB7, #3C3489)", color: "#F7F2EA" },
    card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px 18px" },
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #534AB7, #3C3489)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#F7F2EA", fontWeight: 700 }}>D</div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Daily Brief</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(83,74,183,0.2)", color: "#9B8EC5", fontWeight: 600 }}>AI AGENT</span>
      </header>

      <main style={{ padding: "24px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.7 }}>
            매일 오전 9시(KST) Slack으로 자동 발송됩니다. 아래 버튼으로 지금 즉시 실행할 수 있습니다.
          </div>
          <button onClick={runBrief} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
            {loading
              ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> 생성 중...</>
              : "☀️ 브리핑 지금 실행"}
          </button>
        </div>

        {error && (
          <div style={{ padding: 14, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 12, color: "#E88", marginBottom: 16 }}>{error}</div>
        )}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.brief && (
              <div style={S.card}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>AI 브리핑</div>
                <pre style={{ fontSize: 13, color: "#D8D4CC", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", margin: 0 }}>{result.brief}</pre>
              </div>
            )}

            {result.stats && (
              <div style={S.card}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>수치 요약</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {[
                    ["지출 (어제)", `${result.stats.expenses.count}건 · $${result.stats.expenses.total_usd}`, "#E8A87C"],
                    ["연락처", `전체 ${result.stats.contacts.total}명`, "#9B8EC5"],
                    ["리드", `신규 ${result.stats.leads.new_status}개`, "#5B9BD5"],
                    ["피드백", `${result.stats.feedback.total}건 · ★${result.stats.feedback.avg_rating}`, "#6DCDB8"],
                    ["에셋", `${result.stats.assets.total}개`, "#D4769B"],
                    ["오늘 팔로업", `${result.stats.followup_today.count}건`, result.stats.followup_today.count > 0 ? "#E24B4A" : "#555"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                {result.stats.followup_today.names && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "#E24B4A" }}>⚠️ {result.stats.followup_today.names}</div>
                )}
              </div>
            )}

            <div style={{ fontSize: 10, color: "#444", textAlign: "right" }}>
              Slack CEO 채널에도 전송되었습니다
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
