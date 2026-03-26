"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const STAGES = [
  { id: "identified", label: "발굴", color: "#888" },
  { id: "contacted", label: "컨택", color: "#5B9BD5" },
  { id: "meeting_scheduled", label: "미팅예정", color: "#9B8EC5" },
  { id: "in_discussion", label: "논의중", color: "#E8A87C" },
  { id: "due_diligence", label: "DD", color: "#D4769B" },
  { id: "term_sheet", label: "텀시트", color: "#6DCDB8" },
  { id: "closed", label: "클로즈", color: "#3B7A6D" },
  { id: "passed", label: "패스", color: "#555" },
];

const TYPES = ["investor", "partner", "mentor", "accelerator", "media", "other"];
const TYPE_LABELS = { investor: "투자자", partner: "파트너", mentor: "멘토", accelerator: "액셀러레이터", media: "미디어", other: "기타" };
const MEETING_ICONS = { video: "📹", in_person: "🤝", phone: "📞", email: "📧" };

export default function CRMPage() {
  const [tab, setTab] = useState("pipeline");
  const [contacts, setContacts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [error, setError] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ date: "", type: "video", summary: "", action_items: "" });
  const scrapeRef = useRef(null);
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [dragId, setDragId] = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", company: "", title: "",
    type: "investor", stage: "identified", linkedin_url: "", notes: ""
  });

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/contacts");
    if (res.ok) setContacts(await res.json());
  }, []);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.ok) setLeads(await res.json());
  }, []);

  const fetchMeetings = useCallback(async (contactId) => {
    const res = await fetch(`/api/meetings?contact_id=${contactId}`);
    if (res.ok) setMeetings(await res.json());
  }, []);

  const fetchDrafts = useCallback(async () => {
    const res = await fetch("/api/outreach-draft?status=draft");
    if (res.ok) setDrafts(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchContacts(), fetchLeads(), fetchDrafts()]).then(() => setLoading(false));
  }, [fetchContacts, fetchLeads, fetchDrafts]);

  useEffect(() => {
    if (selected) fetchMeetings(selected);
    else setMeetings([]);
  }, [selected, fetchMeetings]);

  const isOverdue = (c) => c.next_followup_at && new Date(c.next_followup_at) <= new Date();

  const addContact = async () => {
    if (!form.name) return;
    const res = await fetch("/api/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const c = await res.json();
      setContacts(prev => [c, ...prev]);
      setForm({ name: "", email: "", company: "", title: "", type: "investor", stage: "identified", linkedin_url: "", notes: "" });
      setShowAdd(false);
    }
  };

  const updateStage = async (id, stage) => {
    const res = await fetch("/api/contacts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stage })
    });
    if (res.ok) {
      const updated = await res.json();
      setContacts(prev => prev.map(c => c.id === id ? updated : c));
    }
  };

  const updateFollowup = async (date) => {
    const res = await fetch("/api/contacts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected, next_followup_at: date || null })
    });
    if (res.ok) {
      const updated = await res.json();
      setContacts(prev => prev.map(c => c.id === selected ? updated : c));
    }
  };

  const saveMeeting = async () => {
    if (!meetingForm.summary || !selected) return;
    setSavingMeeting(true);
    const res = await fetch("/api/meetings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meetingForm, contact_id: selected })
    });
    if (res.ok) {
      await fetchMeetings(selected);
      setMeetingForm({ date: "", type: "video", summary: "", action_items: "" });
    }
    setSavingMeeting(false);
  };

  const deleteContact = async (id) => {
    await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
    setContacts(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  };

  const scrapeLeads = async () => {
    const text = scrapeRef.current?.value;
    if (!text?.trim()) return;
    setProcessing(true);
    setProcessingMsg("AI가 리드를 분석하고 있습니다...");
    setError(null);
    try {
      const res = await fetch("/api/crm-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scrape_leads", content: text })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchLeads();
      scrapeRef.current.value = "";
      setTab("leads");
    } catch (e) { setError(e.message); }
    setProcessing(false);
    setProcessingMsg("");
  };

  const enrichContact = async (contact) => {
    setProcessing(true);
    setProcessingMsg(`${contact.name} 정보 분석 중...`);
    try {
      const res = await fetch("/api/crm-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enrich_contact", contact })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResult({ type: "enrich", contact: contact.name, data: data.result });
    } catch (e) { setError(e.message); }
    setProcessing(false);
    setProcessingMsg("");
  };

  const draftOutreach = async (contact) => {
    setProcessing(true);
    setProcessingMsg(`${contact.name} 아웃리치 작성 중...`);
    try {
      const res = await fetch("/api/crm-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft_outreach", contact })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResult({ type: "outreach", contact: contact.name, data: data.result });
    } catch (e) { setError(e.message); }
    setProcessing(false);
    setProcessingMsg("");
  };

  const convertLead = async (leadId) => {
    const res = await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "convert", lead_id: leadId })
    });
    if (res.ok) {
      await fetchContacts();
      await fetchLeads();
    }
  };

  const updateDraftStatus = async (id, status) => {
    await fetch("/api/outreach-draft", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const handleDrop = (stageId) => {
    if (dragId) {
      updateStage(dragId, stageId);
      setDragId(null);
    }
  };

  const dismissLead = async (id) => {
    await fetch("/api/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" })
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: "dismissed" } : l));
  };

  const S = {
    input: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
    select: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit" },
    btn: (p) => ({ padding: p ? "9px 18px" : "7px 12px", borderRadius: p ? 8 : 6, border: "none", cursor: "pointer", fontSize: p ? 12 : 11, fontWeight: p ? 600 : 500, fontFamily: "inherit", background: p ? "linear-gradient(135deg, #3B7A6D, #2A5C52)" : "rgba(255,255,255,0.05)", color: p ? "#F7F2EA" : "#999" }),
    card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s", marginBottom: 6 },
    label: { fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
    tag: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: c + "18", color: c }),
  };

  const sel = contacts.find(c => c.id === selected);

  // Pipeline conversion stats (excluding passed)
  const funnelStages = STAGES.filter(s => s.id !== "passed");
  const pipelineStats = funnelStages.map((s, i) => {
    const count = contacts.filter(c => c.stage === s.id).length;
    const prevCount = i > 0 ? contacts.filter(c => c.stage === funnelStages[i - 1].id).length : null;
    const pct = prevCount && prevCount > 0 ? Math.round(count / prevCount * 100) : null;
    return { ...s, count, pct };
  });

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus,textarea:focus,select:focus{outline:none;border-color:#3B7A6D!important}
        *::-webkit-scrollbar{width:5px} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}`}</style>

      {/* Header */}
      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #534AB7, #3C3489)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#F7F2EA" }}>C</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Investor CRM</span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(83,74,183,0.2)", color: "#9B8EC5", fontWeight: 600 }}>AI AGENT</span>
          {drafts.length > 0 && (
            <button onClick={() => setShowDrafts(!showDrafts)} style={{ padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", background: "rgba(232,168,124,0.15)", color: "#E8A87C" }}>
              📬 메일 초안 대기중 {drafts.length}건
            </button>
          )}
        </div>
        <nav style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
          {[["pipeline","파이프라인"],["contacts","연락처"],["leads","리드 스크래퍼"],["scrape","AI 스크래핑"]].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)} style={{
              padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 500, fontFamily: "inherit",
              background: tab === v ? "rgba(83,74,183,0.25)" : "transparent",
              color: tab === v ? "#AFA9EC" : "#666"
            }}>{l}</button>
          ))}
        </nav>
      </header>

      <main style={{ padding: "16px 24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            ["연락처", contacts.length, "#E8E6E1"],
            ["활성", contacts.filter(c => !["closed","passed"].includes(c.stage)).length, "#9B8EC5"],
            ["리드", leads.filter(l => l.status === "new").length, "#E8A87C"],
            ["팔로업 필요", contacts.filter(c => isOverdue(c)).length, "#E24B4A"],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Pipeline View */}
        {tab === "pipeline" && (
          <div>
            {/* Conversion stats */}
            <div style={{ fontSize: 11, color: "#555", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              {pipelineStats.map((s, i) => (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span style={{ color: "#333" }}>→</span>}
                  <span style={{ color: s.color, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ color: "#666" }}>{s.count}</span>
                  {s.pct !== null && <span style={{ color: "#444", fontSize: 10 }}>({s.pct}%)</span>}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
              {STAGES.filter(s => s.id !== "passed").map(stage => {
                const stageContacts = contacts.filter(c => c.stage === stage.id);
                return (
                  <div key={stage.id}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(stage.id)}
                    style={{ minWidth: 160, flex: 1, background: "rgba(255,255,255,0.015)", borderRadius: 10, padding: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={S.tag(stage.color)}>{stage.label}</span>
                      <span style={{ fontSize: 11, color: "#555" }}>{stageContacts.length}</span>
                    </div>
                    {stageContacts.map(c => (
                      <div key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelected(c.id)}
                        style={{ ...S.card, borderLeft: `3px solid ${stage.color}`, opacity: dragId === c.id ? 0.5 : 1, cursor: "grab" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: "#777" }}>{c.company}{c.title ? ` · ${c.title}` : ""}</div>
                        {c.score > 0 && <div style={{ fontSize: 10, color: stage.color, marginTop: 4 }}>fit: {c.score}%</div>}
                        {c.next_followup_at && <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>📅 {new Date(c.next_followup_at).toLocaleDateString("ko-KR")}</div>}
                        {isOverdue(c) && <div style={{ fontSize: 9, color: "#E24B4A", marginTop: 2, fontWeight: 600 }}>⚠️ 팔로업</div>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contacts List */}
        {tab === "contacts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>전체 연락처</span>
              <button onClick={() => setShowAdd(!showAdd)} style={S.btn(true)}>+ 추가</button>
            </div>

            {showAdd && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["name","이름","홍길동"],["email","이메일",""],["company","회사",""],["title","직함",""],["linkedin_url","LinkedIn URL",""]].map(([k,l,p]) => (
                    <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={S.label}>{l}</label>
                      <input value={form[k]} onChange={e => setForm(p2 => ({...p2, [k]: e.target.value}))} placeholder={p} style={S.input} />
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={S.label}>유형</label>
                    <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={S.select}>
                      {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
                  <label style={S.label}>노트</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} style={{ ...S.input, minHeight: 60, resize: "vertical" }} />
                </div>
                <button onClick={addContact} style={{ ...S.btn(true), marginTop: 10 }}>저장</button>
              </div>
            )}

            {contacts.map(c => {
              const stage = STAGES.find(s => s.id === c.stage);
              return (
                <div key={c.id} onClick={() => setSelected(c.id)} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(83,74,183,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#9B8EC5" }}>{c.name[0]}</div>
                    {isOverdue(c) && (
                      <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#E24B4A", border: "1.5px solid #0F1117" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{c.company}{c.title ? ` · ${c.title}` : ""}</div>
                  </div>
                  <span style={S.tag(stage?.color || "#888")}>{stage?.label}</span>
                  <span style={{ fontSize: 10, color: "#555" }}>{TYPE_LABELS[c.type]}</span>
                </div>
              );
            })}
            {contacts.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                <div style={{ fontSize: 13 }}>아직 연락처가 없어요. 추가하거나 리드를 스크래핑해보세요.</div>
              </div>
            )}
          </div>
        )}

        {/* Leads */}
        {tab === "leads" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>AI가 찾은 리드</div>
            {leads.filter(l => l.status !== "dismissed").map(l => (
              <div key={l.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: l.fit_score >= 70 ? "rgba(59,122,109,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: l.fit_score >= 70 ? "#6DCDB8" : "#666", flexShrink: 0 }}>{l.fit_score}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{l.company}{l.title ? ` · ${l.title}` : ""}</div>
                  {l.fit_reason && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{l.fit_reason}</div>}
                </div>
                <span style={S.tag(l.status === "converted" ? "#3B7A6D" : l.status === "new" ? "#E8A87C" : "#555")}>
                  {l.status === "new" ? "NEW" : l.status === "converted" ? "변환됨" : l.status}
                </span>
                {l.status === "new" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); convertLead(l.id); }} style={{ ...S.btn(true), fontSize: 10, padding: "5px 10px" }}>CRM 추가</button>
                    <button onClick={(e) => { e.stopPropagation(); dismissLead(l.id); }} style={{ ...S.btn(false), fontSize: 10, padding: "5px 10px" }}>패스</button>
                  </div>
                )}
              </div>
            ))}
            {leads.filter(l => l.status !== "dismissed").length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13 }}>AI 스크래핑 탭에서 텍스트를 붙여넣으면 리드가 생성됩니다.</div>
              </div>
            )}
          </div>
        )}

        {/* Scraper */}
        {tab === "scrape" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>AI Lead Scraper</div>
            <div style={{ fontSize: 11, color: "#777", marginBottom: 12, lineHeight: 1.6 }}>
              VC 리스트, 투자자 프로필, 액셀러레이터 페이지, 뉴스 기사 등의 텍스트를 붙여넣으면 Claude가 자동으로 리드를 추출하고 TaleNest와의 적합도를 분석합니다.
            </div>
            <textarea ref={scrapeRef} placeholder={"예시:\nJohn Kim, Partner at EdTech Ventures\nFocuses on early-stage education startups...\nSarah Lee, Director at Children's Innovation Fund\n\n또는 VC 리스트 페이지 내용을 통째로 붙여넣기"} style={{ ...S.input, minHeight: 180, resize: "vertical" }} />
            <button onClick={scrapeLeads} style={{ ...S.btn(true), marginTop: 10 }}>AI 리드 분석 시작</button>
          </div>
        )}

        {/* Contact Detail Panel */}
        {sel && (
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 380, background: "#13151D", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 24, overflowY: "auto", zIndex: 100 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sel.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
              {sel.company && <div>{sel.company}{sel.title ? ` · ${sel.title}` : ""}</div>}
              {sel.email && <div style={{ marginTop: 4 }}>{sel.email}</div>}
              {sel.linkedin_url && <div style={{ marginTop: 4, color: "#5B9BD5" }}>{sel.linkedin_url}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={S.label}>스테이지</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {STAGES.map(s => (
                  <button key={s.id} onClick={() => updateStage(sel.id, s.id)}
                    style={{ ...S.tag(sel.stage === s.id ? s.color : "#333"), cursor: "pointer", border: "none", fontFamily: "inherit" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Next Followup */}
            <div style={{ marginBottom: 16 }}>
              <div style={S.label}>다음 팔로업</div>
              <input
                type="date"
                defaultValue={sel.next_followup_at ? sel.next_followup_at.split("T")[0] : ""}
                onBlur={e => updateFollowup(e.target.value)}
                style={{ ...S.input, marginTop: 4 }}
              />
              {isOverdue(sel) && <div style={{ fontSize: 10, color: "#E24B4A", marginTop: 4 }}>⚠️ 팔로업 기한이 지났습니다</div>}
            </div>

            {sel.notes && <div style={{ fontSize: 12, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>{sel.notes}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              <button onClick={() => enrichContact(sel)} style={S.btn(true)}>AI 리서치</button>
              <button onClick={() => draftOutreach(sel)} style={S.btn(false)}>아웃리치 초안</button>
              <button onClick={() => deleteContact(sel.id)} style={{ ...S.btn(false), color: "#E24B4A" }}>삭제</button>
            </div>

            {/* Meeting Notes */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#B8B4E0" }}>미팅 기록</div>

              {/* Add meeting form */}
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12, marginBottom: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                  <div>
                    <div style={S.label}>날짜</div>
                    <input
                      type="datetime-local"
                      value={meetingForm.date}
                      onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))}
                      style={{ ...S.input, fontSize: 11 }}
                    />
                  </div>
                  <div>
                    <div style={S.label}>유형</div>
                    <select
                      value={meetingForm.type}
                      onChange={e => setMeetingForm(f => ({ ...f, type: e.target.value }))}
                      style={{ ...S.select, width: "100%", fontSize: 11 }}
                    >
                      <option value="video">📹 영상</option>
                      <option value="in_person">🤝 대면</option>
                      <option value="phone">📞 전화</option>
                      <option value="email">📧 이메일</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={S.label}>요약</div>
                  <textarea
                    value={meetingForm.summary}
                    onChange={e => setMeetingForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="미팅 내용 요약..."
                    style={{ ...S.input, minHeight: 56, resize: "vertical", fontSize: 11 }}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.label}>액션 아이템</div>
                  <textarea
                    value={meetingForm.action_items}
                    onChange={e => setMeetingForm(f => ({ ...f, action_items: e.target.value }))}
                    placeholder="다음 할 일..."
                    style={{ ...S.input, minHeight: 40, resize: "vertical", fontSize: 11 }}
                  />
                </div>
                <button
                  onClick={saveMeeting}
                  disabled={savingMeeting || !meetingForm.summary}
                  style={{ ...S.btn(true), fontSize: 11, padding: "7px 14px", opacity: savingMeeting || !meetingForm.summary ? 0.5 : 1 }}
                >
                  {savingMeeting ? "저장 중..." : "미팅 저장"}
                </button>
              </div>

              {/* Meeting list */}
              {meetings.length === 0 ? (
                <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: "12px 0" }}>미팅 기록이 없습니다</div>
              ) : (
                meetings.map(m => (
                  <div key={m.id} style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.015)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{MEETING_ICONS[m.type] || "📅"}</span>
                      <span style={{ fontSize: 10, color: "#9B8EC5", fontWeight: 500 }}>
                        {m.date ? new Date(m.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    {m.summary && <div style={{ fontSize: 11, color: "#CCC", lineHeight: 1.5, marginBottom: m.action_items ? 6 : 0 }}>{m.summary}</div>}
                    {m.action_items && <div style={{ fontSize: 10, color: "#6DCDB8", lineHeight: 1.5 }}>▸ {m.action_items}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* AI Result Modal */}
        {aiResult && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(8px)" }}
            onClick={() => setAiResult(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#1A1C26", borderRadius: 16, padding: 28, maxWidth: 520, width: "90%", maxHeight: "80vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{aiResult.contact} — {aiResult.type === "enrich" ? "AI 리서치" : "아웃리치 초안"}</div>
                <button onClick={() => setAiResult(null)} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
              <pre style={{ fontSize: 12, color: "#999", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
                {JSON.stringify(aiResult.data, null, 2)}
              </pre>
              {aiResult.type === "outreach" && aiResult.data?.body && (
                <button onClick={() => { navigator.clipboard.writeText(aiResult.data.body); }} style={{ ...S.btn(true), marginTop: 12 }}>이메일 본문 복사</button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>{error}</div>
        )}

        {/* Outreach Drafts Panel */}
        {showDrafts && (
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 420, background: "#13151D", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 24, overflowY: "auto", zIndex: 150 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>📬 메일 초안</div>
              <button onClick={() => setShowDrafts(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            {drafts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#444", fontSize: 12 }}>대기중인 초안이 없습니다</div>
            ) : (
              drafts.map(d => (
                <div key={d.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8A87C", marginBottom: 4 }}>{d.company || d.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: "#CCC" }}>{d.subject}</div>
                  <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden" }}>{d.body}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`}
                      style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500, background: "rgba(59,122,109,0.15)", color: "#6DCDB8", textDecoration: "none", fontFamily: "inherit" }}
                    >✉️ Gmail로 열기</a>
                    <button onClick={() => updateDraftStatus(d.id, "sent")} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 500, fontFamily: "inherit", background: "rgba(59,122,109,0.1)", color: "#6DCDB8" }}>✅ 발송 완료</button>
                    <button onClick={() => updateDraftStatus(d.id, "skipped")} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 500, fontFamily: "inherit", background: "rgba(255,255,255,0.04)", color: "#666" }}>🗑️ 스킵</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {processing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 300, backdropFilter: "blur(8px)" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(83,74,183,0.2)", borderTop: "3px solid #9B8EC5", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{processingMsg}</div>
        </div>
      )}
    </div>
  );
}
