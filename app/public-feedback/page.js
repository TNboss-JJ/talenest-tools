"use client";
import { useState } from "react";

const ROLES = ["교사", "원장", "부모", "교육전문가", "투자자", "기타"];

export default function PublicFeedbackPage() {
  const [form, setForm] = useState({
    respondent_name: "",
    respondent_role: "교사",
    respondent_org: "",
    rating: 8,
    nps: 8,
    feedback_text: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.feedback_text.trim()) {
      setError("피드백 내용을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다");
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const S = {
    label: { fontSize: 13, fontWeight: 600, color: "#2A5C52", marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #D4EDE9", fontSize: 14, fontFamily: "inherit", color: "#2A5C52", background: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" },
    select: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #D4EDE9", fontSize: 14, fontFamily: "inherit", color: "#2A5C52", background: "#fff", outline: "none", boxSizing: "border-box" },
    field: { marginBottom: 18 },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F2EA", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 48px", fontFamily: "'Outfit', 'Pretendard', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
        input:focus, textarea:focus, select:focus { border-color: #3B7A6D !important; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 4px; background: #D4EDE9; outline: none; border: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #3B7A6D; cursor: pointer; }
      `}</style>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #3B7A6D, #2A5C52)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#F7F2EA" }}>T</div>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#2A5C52" }}>TaleNest</span>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", maxWidth: 480, width: "100%", boxShadow: "0 4px 32px rgba(42,92,82,0.08)" }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#2A5C52", marginBottom: 8 }}>감사합니다!</div>
            <div style={{ fontSize: 14, color: "#5A8A82", lineHeight: 1.7 }}>소중한 의견이 전달되었습니다.<br />TaleNest를 더 좋게 만드는 데 큰 도움이 됩니다.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#2A5C52", marginBottom: 6 }}>소중한 의견을 들려주세요</div>
              <div style={{ fontSize: 13, color: "#7AA8A2", lineHeight: 1.6 }}>데모를 보고 느낀 점을 솔직하게 공유해주시면 큰 힘이 됩니다.</div>
            </div>

            <div style={S.field}>
              <label style={S.label}>이름 <span style={{ fontWeight: 400, color: "#9BC5BF" }}>(선택)</span></label>
              <input value={form.respondent_name} onChange={e => set("respondent_name", e.target.value)} placeholder="홍길동" style={S.input} />
            </div>

            <div style={S.field}>
              <label style={S.label}>역할</label>
              <select value={form.respondent_role} onChange={e => set("respondent_role", e.target.value)} style={S.select}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>기관명 <span style={{ fontWeight: 400, color: "#9BC5BF" }}>(선택)</span></label>
              <input value={form.respondent_org} onChange={e => set("respondent_org", e.target.value)} placeholder="어린이집/유치원/회사명" style={S.input} />
            </div>

            <div style={S.field}>
              <label style={S.label}>전반적인 만족도</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
                <input type="range" min={1} max={10} value={form.rating} onChange={e => set("rating", Number(e.target.value))} style={{ flex: 1 }} />
                <div style={{ fontSize: 28, fontWeight: 700, color: "#3B7A6D", minWidth: 32, textAlign: "center" }}>{form.rating}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9BC5BF", marginTop: 4 }}>
                <span>1 (낮음)</span><span>10 (높음)</span>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>추천 의향 (NPS)</label>
              <div style={{ fontSize: 12, color: "#7AA8A2", marginBottom: 8 }}>TaleNest를 동료에게 추천하시겠습니까?</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <input type="range" min={0} max={10} value={form.nps} onChange={e => set("nps", Number(e.target.value))} style={{ flex: 1 }} />
                <div style={{ fontSize: 28, fontWeight: 700, color: "#3B7A6D", minWidth: 32, textAlign: "center" }}>{form.nps}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9BC5BF", marginTop: 4 }}>
                <span>0 (비추천)</span><span>10 (강력추천)</span>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>피드백 내용 <span style={{ color: "#E24B4A" }}>*</span></label>
              <textarea
                value={form.feedback_text}
                onChange={e => set("feedback_text", e.target.value)}
                placeholder="데모를 보고 느낀 점, 좋았던 점, 개선할 점을 자유롭게 적어주세요"
                rows={5}
                style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", background: "#FEF0F0", border: "1px solid #FCCFCF", borderRadius: 8, fontSize: 12, color: "#C84040", marginBottom: 16 }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: loading ? "#7AB8B0" : "#3B7A6D", color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}
            >
              {loading ? "전송 중..." : "피드백 보내기"}
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: "#A8C5BF" }}>TaleNest · 아이들을 위한 AI 교육 콘텐츠</div>
    </div>
  );
}
