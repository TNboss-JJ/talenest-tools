"use client";
import { useState, useEffect, useCallback } from "react";

const TYPES = [
  { id: "story", label: "동화", icon: "📖", color: "#6DCDB8" },
  { id: "workbook", label: "워크북", icon: "📝", color: "#5B9BD5" },
  { id: "song", label: "감정송", icon: "🎵", color: "#9B8EC5" },
  { id: "podcast", label: "팟캐스트", icon: "🎙️", color: "#E8A87C" },
  { id: "illustration", label: "일러스트", icon: "🎨", color: "#D4769B" },
  { id: "animation", label: "애니메이션", icon: "🎬", color: "#C4784A" },
  { id: "ar_marker", label: "AR 마커", icon: "📱", color: "#7EC8A0" },
  { id: "video", label: "영상", icon: "📹", color: "#BFAF6D" },
  { id: "document", label: "문서", icon: "📄", color: "#888" },
  { id: "other", label: "기타", icon: "📦", color: "#666" },
];

const STAGES = [
  { id: "recognition", label: "Recognition", color: "#6DCDB8" },
  { id: "labeling", label: "Labeling", color: "#5B9BD5" },
  { id: "expression", label: "Expression", color: "#9B8EC5" },
  { id: "regulation", label: "Regulation", color: "#E8A87C" },
];

const CHARACTERS = [
  { id: "nesto", label: "Nesto", emoji: "🐰" },
  { id: "ollie", label: "Ollie", emoji: "🐢" },
  { id: "meela", label: "Meela", emoji: "🐱" },
  { id: "chippy", label: "Chippy", emoji: "🐿️" },
  { id: "pipi", label: "Pipi", emoji: "🐥" },
  { id: "rusty", label: "Rusty", emoji: "🦊" },
  { id: "lumo", label: "Lumo", emoji: "🐶" },
  { id: "bamboo", label: "Bamboo", emoji: "🐼" },
];

const EMOTIONS_SAMPLE = [
  "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation",
  "love", "gratitude", "pride", "hope", "calm", "excitement", "curiosity",
  "jealousy", "shame", "guilt", "loneliness", "frustration", "anxiety",
  "disappointment", "embarrassment", "boredom", "confusion"
];

export default function ContentPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterChar, setFilterChar] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    title: "", type: "story", emotion: "", stage: "",
    character: "", description: "", drive_url: "",
    file_type: "", version: "v1", language: "ko", notes: ""
  });

  const fetchAssets = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType !== "all") params.set("type", filterType);
    if (filterStage !== "all") params.set("stage", filterStage);
    if (filterChar !== "all") params.set("character", filterChar);
    if (search) params.set("q", search);

    const res = await fetch(`/api/assets?${params}`);
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  }, [filterType, filterStage, filterChar, search]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const addAsset = async () => {
    if (!form.title) return;
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const [saved] = await res.json();
      setAssets(prev => [saved, ...prev]);
      setForm({ title: "", type: "story", emotion: "", stage: "", character: "", description: "", drive_url: "", file_type: "", version: "v1", language: "ko", notes: "" });
      setShowAdd(false);
    } catch (e) { setError(e.message); }
  };

  const deleteAsset = async (id) => {
    await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  // Stats
  const typeCounts = {};
  TYPES.forEach(t => { typeCounts[t.id] = assets.filter(a => a.type === t.id).length; });
  const stageCounts = {};
  STAGES.forEach(s => { stageCounts[s.id] = assets.filter(a => a.stage === s.id).length; });

  const S = {
    input: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
    select: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit" },
    btn: (p) => ({ padding: p ? "9px 18px" : "7px 12px", borderRadius: p ? 8 : 6, border: "none", cursor: "pointer", fontSize: p ? 12 : 11, fontWeight: p ? 600 : 500, fontFamily: "inherit", background: p ? "linear-gradient(135deg, #3B7A6D, #2A5C52)" : "rgba(255,255,255,0.05)", color: p ? "#F7F2EA" : "#999" }),
    tag: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: c + "18", color: c }),
    label: { fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
    card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "14px", cursor: "pointer", transition: "all 0.15s" },
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B7A6D!important}
        *::-webkit-scrollbar{width:5px} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}`}</style>

      {/* Header */}
      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3B7A6D, #2A5C52)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#F7F2EA" }}>V</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Content Vault</span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(59,122,109,0.2)", color: "#6DCDB8", fontWeight: 600 }}>
            {assets.length} assets
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowAdd(!showAdd)} style={S.btn(true)}>+ 추가</button>
          <a href="/import" style={{ ...S.btn(false), textDecoration: "none", display: "inline-block" }}>CSV 임포트</a>
        </div>
      </header>

      <main style={{ padding: "16px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Type Stats */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
          <button onClick={() => setFilterType("all")} style={{
            ...S.tag(filterType === "all" ? "#E8E6E1" : "#444"),
            cursor: "pointer", border: "none", fontFamily: "inherit"
          }}>전체 {assets.length}</button>
          {TYPES.filter(t => typeCounts[t.id] > 0 || t.id === filterType).map(t => (
            <button key={t.id} onClick={() => setFilterType(filterType === t.id ? "all" : t.id)} style={{
              ...S.tag(filterType === t.id ? t.color : "#444"),
              cursor: "pointer", border: "none", fontFamily: "inherit"
            }}>{t.icon} {t.label} {typeCounts[t.id] || 0}</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색 (제목, 감정, 설명...)" style={{ ...S.input, maxWidth: 240 }} />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={S.select}>
            <option value="all">모든 스테이지</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filterChar} onChange={e => setFilterChar(e.target.value)} style={S.select}>
            <option value="all">모든 캐릭터</option>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>에셋 추가</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>제목</label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Nesto의 기쁨 동화" style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>유형</label>
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={S.select}>
                  {TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>감정</label>
                <input value={form.emotion} onChange={e => setForm(p => ({...p, emotion: e.target.value}))} placeholder="joy, sadness..." style={S.input} list="emotions" />
                <datalist id="emotions">{EMOTIONS_SAMPLE.map(e => <option key={e} value={e} />)}</datalist>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>4-Stage</label>
                <select value={form.stage} onChange={e => setForm(p => ({...p, stage: e.target.value}))} style={S.select}>
                  <option value="">선택</option>
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>캐릭터</label>
                <select value={form.character} onChange={e => setForm(p => ({...p, character: e.target.value}))} style={S.select}>
                  <option value="">선택</option>
                  {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>언어</label>
                <select value={form.language} onChange={e => setForm(p => ({...p, language: e.target.value}))} style={S.select}>
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>Google Drive URL</label>
                <input value={form.drive_url} onChange={e => setForm(p => ({...p, drive_url: e.target.value}))} placeholder="https://drive.google.com/..." style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={S.label}>설명</label>
                <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="간단한 설명" style={S.input} />
              </div>
            </div>
            <button onClick={addAsset} disabled={!form.title} style={{ ...S.btn(true), opacity: form.title ? 1 : 0.4 }}>저장</button>
          </div>
        )}

        {/* 4-Stage Overview */}
        {filterType === "all" && !search && filterStage === "all" && filterChar === "all" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {STAGES.map(s => (
              <div key={s.id} onClick={() => setFilterStage(s.id)} style={{
                background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px",
                border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer",
                borderTop: `3px solid ${s.color}`
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stageCounts[s.id] || 0}</div>
                <div style={{ fontSize: 10, color: "#555" }}>assets</div>
              </div>
            ))}
          </div>
        )}

        {/* Asset Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#444", fontSize: 12 }}>불러오는 중...</div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#444" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>에셋이 없어요</div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>추가하거나 CSV로 임포트하세요</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setShowAdd(true)} style={S.btn(true)}>+ 추가</button>
              <a href="/import" style={{ ...S.btn(false), textDecoration: "none", display: "inline-block" }}>CSV 임포트</a>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {assets.map(a => {
              const typeInfo = TYPES.find(t => t.id === a.type);
              const stageInfo = STAGES.find(s => s.id === a.stage);
              const charInfo = CHARACTERS.find(c => c.id === a.character);
              return (
                <div key={a.id} style={S.card}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{typeInfo?.icon || "📦"}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {stageInfo && <span style={S.tag(stageInfo.color)}>{stageInfo.label}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>
                    {a.emotion && <span style={{ marginRight: 6 }}>{a.emotion}</span>}
                    {charInfo && <span>{charInfo.emoji} {charInfo.label}</span>}
                  </div>
                  {a.description && <div style={{ fontSize: 11, color: "#666", marginBottom: 6, lineHeight: 1.5 }}>{a.description}</div>}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {a.drive_url && (
                      <a href={a.drive_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, color: "#5B9BD5", textDecoration: "none" }}>Drive 열기 ↗</a>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 9, color: "#444" }}>{a.version}</span>
                    <button onClick={() => deleteAsset(a.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Character Quick Filter */}
        {assets.length > 0 && filterChar === "all" && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>캐릭터별</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CHARACTERS.map(c => {
                const count = assets.filter(a => a.character === c.id).length;
                return (
                  <button key={c.id} onClick={() => setFilterChar(c.id)} style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(255,255,255,0.02)", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6, color: "#E8E6E1"
                  }}>
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</div>
                      <div style={{ fontSize: 10, color: "#555" }}>{count} assets</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>{error}</div>
        )}
      </main>
    </div>
  );
}
