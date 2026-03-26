"use client";
import { useState, useEffect, useCallback } from "react";

const PRESETS = [
  { label: "서울 어린이집", query: "어린이집", location: "서울" },
  { label: "강남 유치원", query: "유치원", location: "서울 강남구" },
  { label: "경기도 어린이집", query: "어린이집", location: "경기도" },
  { label: "부산 유치원", query: "유치원", location: "부산" },
  { label: "인천 어린이집", query: "어린이집", location: "인천" },
  { label: "아동교육센터", query: "아동 교육센터", location: "서울" },
];

const PRIORITY_COLORS = { high: "#6DCDB8", medium: "#E8A87C", low: "#888" };

export default function MapScraperPage() {
  const [query, setQuery] = useState("어린이집");
  const [location, setLocation] = useState("서울 강남구");
  const [results, setResults] = useState([]);
  const [detailed, setDetailed] = useState({});
  const [analyzed, setAnalyzed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [step, setStep] = useState("search");
  const [savedCount, setSavedCount] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [groupTag, setGroupTag] = useState("");
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/map-scraper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "history" })
      });
      if (res.ok) { const data = await res.json(); setHistory(data.history || []); }
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const alreadyScraped = history.some(h => h.query === query && h.location === location);

  const searchPlaces = useCallback(async (pageToken) => {
    setLoading(true);
    setLoadingMsg("Google Maps에서 검색 중...");
    setError(null);
    try {
      const res = await fetch("/api/map-scraper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, location, pageToken })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (pageToken) {
        setResults(prev => [...prev, ...data.results]);
      } else {
        setResults(data.results);
      }
      setNextPage(data.next_page_token);
      setStep("results");
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingMsg("");
  }, [query, location]);

  const fetchDetails = useCallback(async () => {
    const ids = results.filter((_, i) => selected.has(i) || selected.size === 0).map(r => r.place_id);
    if (!ids.length) return;

    setLoading(true);
    setLoadingMsg(`${ids.length}개 기관 상세 정보 수집 중...`);
    try {
      const res = await fetch("/api/map-scraper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "details", place_ids: ids })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const map = {};
      data.details.forEach(d => { map[d.place_id] = d; });
      setDetailed(prev => ({ ...prev, ...map }));

      // Merge details into results
      const merged = results.map(r => map[r.place_id] ? { ...r, ...map[r.place_id] } : r);
      setResults(merged);
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingMsg("");
  }, [results, selected]);

  const analyzeAndSave = useCallback(async () => {
    const places = results.filter((_, i) => selected.has(i) || selected.size === 0);
    if (!places.length) return;

    setLoading(true);
    setLoadingMsg(`Claude가 ${places.length}개 기관 적합도 분석 중...`);
    try {
      const res = await fetch("/api/map-scraper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", places })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalyzed(data.analyzed);
      setSavedCount(data.saved);
      setStep("done");
      fetchHistory();
      if (data.auto_saved > 0 || data.drafts_created > 0) {
        setToast(`70점 이상 ${data.auto_saved}건 자동 CRM 저장 + 메일 초안 ${data.drafts_created}건 생성`);
        setTimeout(() => setToast(null), 6000);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingMsg("");
  }, [results, selected]);

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((_, i) => i)));
  };

  const importToCRM = useCallback(async () => {
    const places = results.filter((_, i) => selected.has(i));
    if (!places.length) return;
    setImporting(true);
    setError(null);
    try {
      const contacts = places.map(r => ({
        name: r.name,
        company: groupTag.trim() || `${location} ${query}`,
        type: "lead",
        phone: detailed[r.place_id]?.phone || r.phone || "",
        website: detailed[r.place_id]?.website || r.website || "",
        notes: `Map Scraper 가져오기 | ${r.address || ""} | rating: ${r.rating || "-"}`,
        stage: "발굴",
      }));
      for (const c of contacts) {
        await fetch("/api/contacts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
        });
      }
      alert(`✅ ${contacts.length}개 연락처가 CRM에 저장되었습니다!`);
    } catch (e) { setError(e.message); }
    setImporting(false);
  }, [results, selected, detailed, groupTag, location, query]);

  const reset = () => {
    setResults([]); setDetailed({}); setAnalyzed([]);
    setSelected(new Set()); setStep("search");
    setSavedCount(0); setNextPage(null); setError(null);
    setGroupTag("");
  };

  const S = {
    input: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "10px 14px", color: "#E8E6E1", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
    btn: (p) => ({ padding: p ? "10px 20px" : "8px 14px", borderRadius: p ? 8 : 6, border: "none", cursor: "pointer", fontSize: p ? 13 : 11, fontWeight: p ? 600 : 500, fontFamily: "inherit", background: p ? "linear-gradient(135deg, #3B7A6D, #2A5C52)" : "rgba(255,255,255,0.05)", color: p ? "#F7F2EA" : "#999" }),
    tag: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: c + "18", color: c }),
    card: (sel) => ({ background: sel ? "rgba(59,122,109,0.08)" : "rgba(255,255,255,0.025)", border: `1px solid ${sel ? "rgba(59,122,109,0.3)" : "rgba(255,255,255,0.05)"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s", marginBottom: 6 }),
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus{outline:none;border-color:#3B7A6D!important}
        *::-webkit-scrollbar{width:5px} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}`}</style>

      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
        <a href="/crm" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← CRM</a>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3B7A6D, #2A5C52)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#F7F2EA" }}>M</div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Map Scraper</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(59,122,109,0.2)", color: "#6DCDB8", fontWeight: 600 }}>AI + MAPS</span>
      </header>

      <main style={{ padding: "20px 24px", maxWidth: 800, margin: "0 auto" }}>
        {/* Search */}
        {step === "search" && (
          <div>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 16, lineHeight: 1.6 }}>
              Google Maps에서 어린이집, 유치원, 교육기관을 검색하고 Claude가 TaleNest 적합도를 분석합니다. 결과는 CRM 리드에 자동 저장됩니다.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>검색어</div>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="어린이집, 유치원..." style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>지역</div>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="서울 강남구" style={S.input}
                  onKeyDown={e => e.key === "Enter" && searchPlaces()} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <button onClick={() => searchPlaces()} disabled={loading} style={S.btn(true)}>검색</button>
                {alreadyScraped && (
                  <span style={{ fontSize: 10, color: "#E8A87C", fontWeight: 500, whiteSpace: "nowrap" }}>⚠️ 이미 긁은 지역</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setQuery(p.query); setLocation(p.location); }}
                  style={{ ...S.btn(false), fontSize: 11 }}>{p.label}</button>
              ))}
            </div>

            {/* Scrape History */}
            {history.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 8 }}>최근 스크랩 이력</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {history.slice(0, 20).map((h, i) => (
                    <div key={i} onClick={() => { setQuery(h.query); setLocation(h.location); }}
                      style={{ ...S.card(false), padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#CCC" }}>
                        {h.location} {h.query}
                      </span>
                      <span style={{ fontSize: 10, color: "#666" }}>
                        {new Date(h.created_at).toLocaleDateString("ko-KR")} · {h.total_found}건 ({h.auto_saved}건 저장)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {step === "results" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{results.length}개 기관 발견</span>
                <span style={{ fontSize: 12, color: "#666" }}>{query} · {location}</span>
                {selected.size > 0 && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(59,122,109,0.2)", color: "#6DCDB8", fontWeight: 600 }}>
                    {selected.size}개 선택됨
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={selectAll} style={S.btn(false)}>
                  {selected.size === results.length ? "전체 해제" : "전체 선택"}
                </button>
                <button onClick={fetchDetails} style={S.btn(false)}>
                  상세 정보 수집 ({selected.size || results.length}개)
                </button>
                <button onClick={analyzeAndSave} style={S.btn(true)}>
                  AI 분석 + 리드 저장
                </button>
                <button onClick={reset} style={S.btn(false)}>새 검색</button>
              </div>
            </div>

            {/* Group Tag + Bulk CRM Import */}
            {selected.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: "rgba(59,122,109,0.06)", border: "1px solid rgba(59,122,109,0.15)", borderRadius: 10 }}>
                <span style={{ fontSize: 11, color: "#6DCDB8", fontWeight: 600, flexShrink: 0 }}>CRM 가져오기</span>
                <input
                  value={groupTag}
                  onChange={e => setGroupTag(e.target.value)}
                  placeholder={`그룹명 (예: ${location} ${query})`}
                  style={{ ...S.input, maxWidth: 220, fontSize: 12, padding: "7px 10px" }}
                  onClick={e => e.stopPropagation()}
                />
                <button
                  onClick={importToCRM}
                  disabled={importing}
                  style={{ ...S.btn(true), fontSize: 12, padding: "8px 16px", flexShrink: 0, opacity: importing ? 0.5 : 1 }}
                >
                  {importing ? "가져오는 중..." : `선택한 ${selected.size}개 → CRM 가져오기`}
                </button>
              </div>
            )}

            {results.map((r, i) => {
              const d = detailed[r.place_id];
              const isSel = selected.has(i);
              return (
                <div key={r.place_id} onClick={() => toggleSelect(i)} style={S.card(isSel)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${isSel ? "#3B7A6D" : "rgba(255,255,255,0.1)"}`, background: isSel ? "#3B7A6D" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>
                      {isSel ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "#777" }}>{r.address}</div>
                      {(d?.phone || d?.website) && (
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                          {d.phone && <span style={{ marginRight: 10 }}>{d.phone}</span>}
                          {d.website && <a href={d.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#5B9BD5", textDecoration: "none" }}>웹사이트 ↗</a>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {r.rating && (
                        <div style={{ fontSize: 12, color: "#E8A87C", fontWeight: 600 }}>{r.rating} ★</div>
                      )}
                      <div style={{ fontSize: 10, color: "#555" }}>{r.total_ratings}개 리뷰</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {nextPage && (
              <button onClick={() => searchPlaces(nextPage)} disabled={loading}
                style={{ ...S.btn(false), width: "100%", marginTop: 8, textAlign: "center" }}>
                더 불러오기
              </button>
            )}
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div>
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{savedCount}개 리드 CRM에 저장됨!</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>/crm → 리드 탭에서 확인하세요</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={reset} style={S.btn(true)}>새 검색</button>
                <a href="/crm" style={{ ...S.btn(false), textDecoration: "none", display: "inline-block" }}>CRM 보기 →</a>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>분석 결과</div>
              {analyzed.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0)).map((a, i) => (
                <div key={i} style={{ ...S.card(false), display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: a.fit_score >= 70 ? "rgba(59,122,109,0.15)" : a.fit_score >= 40 ? "rgba(232,168,124,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: a.fit_score >= 70 ? "#6DCDB8" : a.fit_score >= 40 ? "#E8A87C" : "#666", flexShrink: 0 }}>
                    {a.fit_score}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{a.address}</div>
                    {a.fit_reason && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{a.fit_reason}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    {a.phone && <span style={{ fontSize: 10, color: "#888" }}>{a.phone}</span>}
                    <span style={S.tag(PRIORITY_COLORS[a.contact_priority] || "#888")}>{a.contact_priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>{error}</div>
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", background: "rgba(59,122,109,0.95)", color: "#F7F2EA", borderRadius: 10, fontSize: 12, fontWeight: 500, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          ✅ {toast}
        </div>
      )}

      {loading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 999, backdropFilter: "blur(8px)" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(59,122,109,0.2)", borderTop: "3px solid #3B7A6D", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{loadingMsg}</div>
        </div>
      )}
    </div>
  );
}
