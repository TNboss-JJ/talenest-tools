"use client";
import { useState, useEffect, useCallback } from "react";

const CHANNELS = [
  { id: "demo", label: "PoC 데모" },
  { id: "survey", label: "설문" },
  { id: "email", label: "이메일" },
  { id: "meeting", label: "미팅" },
  { id: "social", label: "SNS" },
  { id: "other", label: "기타" },
];

const SENT_COLORS = { positive: "#6DCDB8", neutral: "#E8A87C", negative: "#E24B4A" };
const SENT_LABELS = { positive: "긍정", neutral: "중립", negative: "부정" };

export default function FeedbackPage() {
  const [tab, setTab] = useState("list");
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    respondent_name: "", respondent_role: "", respondent_org: "",
    channel: "demo", rating: 8, nps: 8, feedback_text: "", demo_version: "PoC v0.9"
  });

  const fetchFeedbacks = useCallback(async () => {
    const res = await fetch("/api/feedback");
    if (res.ok) setFeedbacks(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const submitFeedback = async () => {
    if (!form.feedback_text.trim()) return;
    setProcessing(true);
    setProcessingMsg("피드백 저장 + AI 분석 중...");
    setError(null);
    try {
      // Save feedback
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const [saved] = await res.json();

      // Auto-analyze with AI
      const aiRes = await fetch("/api/feedback-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze_single", feedback_text: form.feedback_text, feedback_id: saved.id })
      });
      const aiData = await aiRes.json();

      if (aiData.result) {
        saved.sentiment = aiData.result.sentiment;
        saved.sentiment_score = aiData.result.sentiment_score;
        saved.themes = aiData.result.themes;
        saved.ai_summary = aiData.result.ai_summary;
        saved.action_items = aiData.result.action_items;
        saved.key_quotes = aiData.result.key_quotes;
      }

      setFeedbacks(prev => [saved, ...prev]);
      setForm(prev => ({ ...prev, respondent_name: "", respondent_role: "", respondent_org: "", feedback_text: "" }));
      setTab("list");
    } catch (e) { setError(e.message); }
    setProcessing(false);
    setProcessingMsg("");
  };

  const runBatchAnalysis = async () => {
    setProcessing(true);
    setProcessingMsg("전체 피드백 인사이트 분석 중...");
    setError(null);
    try {
      const res = await fetch("/api/feedback-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze_batch" })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.result);
      setTab("insights");
    } catch (e) { setError(e.message); }
    setProcessing(false);
    setProcessingMsg("");
  };

  const deleteFeedback = async (id) => {
    await fetch(`/api/feedback?id=${id}`, { method: "DELETE" });
    setFeedbacks(prev => prev.filter(f => f.id !== id));
    setSelected(null);
  };

  const sentimentCounts = {
    positive: feedbacks.filter(f => f.sentiment === "positive").length,
    neutral: feedbacks.filter(f => f.sentiment === "neutral").length,
    negative: feedbacks.filter(f => f.sentiment === "negative").length,
  };
  const avgRating = feedbacks.length ? (feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.filter(f => f.rating).length).toFixed(1) : "-";

  const S = {
    input: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
    select: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit" },
    btn: (p) => ({ padding: p ? "9px 18px" : "7px 12px", borderRadius: p ? 8 : 6, border: "none", cursor: "pointer", fontSize: p ? 12 : 11, fontWeight: p ? 600 : 500, fontFamily: "inherit", background: p ? "linear-gradient(135deg, #D85A30, #993C1D)" : "rgba(255,255,255,0.05)", color: p ? "#F7F2EA" : "#999" }),
    card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", marginBottom: 6, cursor: "pointer" },
    label: { fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
    tag: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: c + "18", color: c }),
  };

  const sel = feedbacks.find(f => f.id === selected);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#D85A30!important}
        *::-webkit-scrollbar{width:5px} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}`}</style>

      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #D85A30, #993C1D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#F7F2EA" }}>F</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Feedback Hub</span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(216,90,48,0.2)", color: "#E8A87C", fontWeight: 600 }}>AI AGENT</span>
        </div>
        <nav style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
          {[["list","피드백"],["add","새 피드백"],["insights","AI 인사이트"]].map(([v,l]) => (
            <button key={v} onClick={() => v === "insights" && !insights ? runBatchAnalysis() : setTab(v)} style={{
              padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 500, fontFamily: "inherit",
              background: tab === v ? "rgba(216,90,48,0.25)" : "transparent",
              color: tab === v ? "#E8A87C" : "#666"
            }}>{l}</button>
          ))}
        </nav>
      </header>

      <main style={{ padding: "16px 24px", maxWidth: 960, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            ["전체", feedbacks.length, "#E8E6E1"],
            ["평균 점수", avgRating, "#E8A87C"],
            ["긍정", sentimentCounts.positive, "#6DCDB8"],
            ["중립", sentimentCounts.neutral, "#E8A87C"],
            ["부정", sentimentCounts.negative, "#E24B4A"],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Add Feedback */}
        {tab === "add" && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>새 피드백 입력</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>이름</label>
                <input value={form.respondent_name} onChange={e => setForm(p => ({...p, respondent_name: e.target.value}))} placeholder="홍길동" style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>직책/역할</label>
                <input value={form.respondent_role} onChange={e => setForm(p => ({...p, respondent_role: e.target.value}))} placeholder="원장, 교사, VC..." style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>기관</label>
                <input value={form.respondent_org} onChange={e => setForm(p => ({...p, respondent_org: e.target.value}))} placeholder="OO 어린이집" style={S.input} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>채널</label>
                <select value={form.channel} onChange={e => setForm(p => ({...p, channel: e.target.value}))} style={S.select}>
                  {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>평점 (1-10)</label>
                <input type="number" min="1" max="10" value={form.rating} onChange={e => setForm(p => ({...p, rating: parseInt(e.target.value) || 0}))} style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>NPS (0-10)</label>
                <input type="number" min="0" max="10" value={form.nps} onChange={e => setForm(p => ({...p, nps: parseInt(e.target.value) || 0}))} style={S.input} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
              <label style={S.label}>피드백 내용</label>
              <textarea value={form.feedback_text} onChange={e => setForm(p => ({...p, feedback_text: e.target.value}))}
                placeholder="데모를 보고 느낀 점, 좋았던 점, 개선이 필요한 점, 궁금한 점 등..."
                style={{ ...S.input, minHeight: 120, resize: "vertical" }} />
            </div>
            <button onClick={submitFeedback} disabled={!form.feedback_text.trim()} style={{ ...S.btn(true), opacity: form.feedback_text.trim() ? 1 : 0.4 }}>저장 + AI 분석</button>
          </div>
        )}

        {/* List */}
        {tab === "list" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>피드백 목록</span>
              <button onClick={() => setTab("add")} style={S.btn(true)}>+ 새 피드백</button>
            </div>
            {feedbacks.length === 0 && !loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: 13 }}>아직 피드백이 없어요. PoC 데모 후 피드백을 입력해보세요.</div>
                <button onClick={() => setTab("add")} style={{ ...S.btn(true), marginTop: 12 }}>피드백 입력</button>
              </div>
            ) : feedbacks.map(f => (
              <div key={f.id} onClick={() => setSelected(f.id === selected ? null : f.id)} style={{ ...S.card, borderLeft: `3px solid ${SENT_COLORS[f.sentiment] || "#555"}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {f.respondent_name && <span style={{ fontSize: 13, fontWeight: 600 }}>{f.respondent_name}</span>}
                    {f.respondent_role && <span style={{ fontSize: 11, color: "#777" }}>{f.respondent_role}</span>}
                    {f.respondent_org && <span style={{ fontSize: 11, color: "#666" }}>@ {f.respondent_org}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {f.rating && <span style={{ fontSize: 10, color: "#E8A87C" }}>{f.rating}/10</span>}
                    {f.sentiment && <span style={S.tag(SENT_COLORS[f.sentiment])}>{SENT_LABELS[f.sentiment]}</span>}
                    <span style={{ fontSize: 10, color: "#444" }}>{CHANNELS.find(c => c.id === f.channel)?.label}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#999", lineHeight: 1.6 }}>
                  {f.ai_summary || (f.feedback_text?.substring(0, 120) + (f.feedback_text?.length > 120 ? "..." : ""))}
                </div>
                {f.themes?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {f.themes.map((t, i) => <span key={i} style={S.tag("#888")}>{t}</span>)}
                  </div>
                )}

                {selected === f.id && (
                  <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#999", lineHeight: 1.7, marginBottom: 8 }}>{f.feedback_text}</div>
                    {f.action_items && (
                      <div style={{ fontSize: 11, color: "#E8A87C", marginBottom: 6 }}>액션: {f.action_items}</div>
                    )}
                    {f.key_quotes?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>
                        {f.key_quotes.map((q, i) => <div key={i} style={{ fontStyle: "italic" }}>"{q}"</div>)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#555" }}>{new Date(f.created_at).toLocaleDateString("ko")}</span>
                      <div style={{ flex: 1 }} />
                      <button onClick={(e) => { e.stopPropagation(); deleteFeedback(f.id); }} style={{ ...S.btn(false), color: "#E24B4A", fontSize: 10 }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        {tab === "insights" && insights && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>AI 인사이트 리포트</span>
              <button onClick={runBatchAnalysis} style={S.btn(false)}>새로고침</button>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#E8E6E1", lineHeight: 1.7 }}>{insights.summary}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "rgba(109,205,184,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(109,205,184,0.1)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6DCDB8", marginBottom: 8 }}>강점</div>
                {insights.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#999", marginBottom: 4, display: "flex", gap: 6 }}>
                    <span style={{ color: "#6DCDB8" }}>+</span> {s}
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(226,75,74,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(226,75,74,0.1)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#E24B4A", marginBottom: 8 }}>개선점</div>
                {insights.concerns?.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#999", marginBottom: 4, display: "flex", gap: 6 }}>
                    <span style={{ color: "#E24B4A" }}>!</span> {c}
                  </div>
                ))}
              </div>
            </div>

            {insights.feature_requests?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9B8EC5", marginBottom: 8 }}>기능 요청</div>
                {insights.feature_requests.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>• {f}</div>
                ))}
              </div>
            )}

            {insights.recommendations?.length > 0 && (
              <div style={{ background: "rgba(216,90,48,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(216,90,48,0.1)", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#E8A87C", marginBottom: 8 }}>추천 액션 (우선순위순)</div>
                {insights.recommendations.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#999", marginBottom: 4, display: "flex", gap: 6 }}>
                    <span style={{ color: "#E8A87C", fontWeight: 600 }}>{i + 1}.</span> {r}
                  </div>
                ))}
              </div>
            )}

            {insights.top_themes?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8 }}>주요 테마</div>
                {insights.top_themes.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: 12, color: "#999" }}>{t.theme}</div>
                    <span style={{ fontSize: 10, color: "#666" }}>{t.count}회</span>
                    <span style={S.tag(SENT_COLORS[t.sentiment] || "#888")}>{SENT_LABELS[t.sentiment] || t.sentiment}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "insights" && !insights && !processing && (
          <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>피드백 데이터를 분석해서 인사이트를 생성합니다</div>
            <button onClick={runBatchAnalysis} style={S.btn(true)}>AI 인사이트 생성</button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>{error}</div>
        )}
      </main>

      {processing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 999, backdropFilter: "blur(8px)" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(216,90,48,0.2)", borderTop: "3px solid #D85A30", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{processingMsg}</div>
        </div>
      )}
    </div>
  );
}
