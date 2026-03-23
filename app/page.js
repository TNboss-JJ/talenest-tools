"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

const TOOLS = [
  {
    id: "expense", icon: "💳", name: "Expense Bot", path: "/expense",
    desc: "영수증·인보이스 AI 분석, 지출 분류, CSV 내보내기",
    status: "live", priority: "P0",
    tech: "Claude Vision API + Supabase",
    features: ["영수증 이미지 OCR", "PDF 인보이스 파싱", "CSV 카드명세 일괄 업로드", "자동 카테고리 분류", "세금공제 판별", "월별 리포트 생성"],
    phase: 1
  },
  {
    id: "content", icon: "📚", name: "Content Vault", path: "/content",
    desc: "동화 44개, 워크북 1176장, 감정송 49곡 에셋 관리",
    status: "live", priority: "P0",
    tech: "Supabase Storage + 메타데이터 DB",
    features: ["에셋 검색 (감정/스테이지/캐릭터별)", "버전 관리", "사용 현황 추적", "미리보기", "캐릭터별 필터", "다운로드 패키지 생성"],
    phase: 1
  },
  {
    id: "crm", icon: "🤝", name: "Investor CRM", path: "/crm",
    desc: "투자자·파트너 연락처, 미팅 이력, 파이프라인 관리",
    status: "live", priority: "P1",
    tech: "Supabase + Email 연동",
    features: ["연락처 관리", "미팅 노트 + 타임라인", "투자 파이프라인 단계", "팔로업 리마인더", "이메일 템플릿", "VC 리서치 노트"],
    phase: 2
  },
  {
    id: "tasks", icon: "✅", name: "Task Tracker", path: "/tasks",
    desc: "일정 관리, 할일 추적, 마일스톤 대시보드",
    status: "planned", priority: "P1",
    tech: "Supabase + Calendar API",
    features: ["칸반 보드", "마일스톤 트래커", "주간 리뷰 자동 생성", "데드라인 알림", "프로젝트별 분류", "시간 추적"],
    phase: 2
  },
  {
    id: "legal", icon: "⚖️", name: "Legal Tracker", path: "/legal",
    desc: "상표 등록 현황, 계약서 관리, 법무 일정",
    status: "planned", priority: "P2",
    tech: "Supabase + PDF 저장소",
    features: ["상표 출원/등록 타임라인", "계약서 보관 + 만료 알림", "법무 비용 추적", "NDA 템플릿", "국가별 IP 현황", "갱신 리마인더"],
    phase: 3
  },
  {
    id: "social", icon: "📱", name: "Social Scheduler", path: "/social",
    desc: "SNS 콘텐츠 캘린더, 예약 게시, 성과 추적",
    status: "planned", priority: "P2",
    tech: "Buffer/Later API 또는 자체 구축",
    features: ["콘텐츠 캘린더", "멀티 플랫폼 예약", "해시태그 관리", "성과 분석", "A/B 테스트", "AI 캡션 생성"],
    phase: 3
  },
  {
    id: "feedback", icon: "💬", name: "Feedback Hub", path: "/feedback",
    desc: "PoC 데모 피드백 수집, 감성 분석, 인사이트 대시보드",
    status: "live", priority: "P1",
    tech: "Claude API + 설문 폼",
    features: ["피드백 폼 생성", "감성 분석 (AI)", "NPS 스코어", "기능 요청 투표", "사용자 세그먼트별 분석", "인사이트 리포트"],
    phase: 2
  },
  {
    id: "monitor", icon: "📡", name: "Site Monitor", path: "/monitor",
    desc: "사이트 업타임, 성능 모니터링, 알림",
    status: "planned", priority: "P2",
    tech: "Vercel Analytics + Cron",
    features: ["업타임 체크 (5분 간격)", "응답 시간 그래프", "SSL 인증서 만료 알림", "다운 알림 (Slack/Email)", "도메인별 상태", "월간 가용성 리포트"],
    phase: 3
  },
  {
    id: "map-scraper", icon: "🗺️", name: "Map Scraper", path: "/map-scraper",
    desc: "Google Maps에서 어린이집/유치원 검색, AI 적합도 분석, CRM 자동 저장",
    status: "live", priority: "P1",
    tech: "Google Places API + Claude AI",
    features: ["지역+키워드 기관 검색", "전화번호/웹사이트 수집", "TaleNest 적합도 AI 분석", "CRM 리드 자동 저장"],
    phase: 2
  },
  {
    id: "import", icon: "📥", name: "CSV Import", path: "/import",
    desc: "Airtable/엑셀 CSV 일괄 업로드, AI 컬럼 자동 매핑",
    status: "live", priority: "P1",
    tech: "Claude AI + CSV Parser",
    features: ["연락처/지출/리드 일괄 임포트", "한국어 헤더 자동 인식", "컬럼 자동 매핑", "미리보기 후 저장"],
    phase: 1
  }
];

const PHASES = [
  { num: 1, name: "지금 바로", period: "Week 1-2", color: "#3B7A6D" },
  { num: 2, name: "핵심 운영", period: "Week 3-6", color: "#5B9BD5" },
  { num: 3, name: "확장", period: "Month 2-3", color: "#9B8EC5" }
];

const STATUS_MAP = {
  live: { bg: "rgba(59,122,109,0.15)", text: "#6DCDB8", label: "LIVE" },
  building: { bg: "rgba(239,159,39,0.15)", text: "#EF9F27", label: "개발 중" },
  planned: { bg: "rgba(255,255,255,0.06)", text: "#666", label: "계획됨" }
};

export default function ToolsHub() {
  const [selected, setSelected] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState(0);
  const tool = TOOLS.find(t => t.id === selected);
  const filtered = phaseFilter === 0 ? TOOLS : TOOLS.filter(t => t.phase === phaseFilter);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *::-webkit-scrollbar { width: 5px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
      `}</style>

      <header style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #3B7A6D, #2A5C52)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#F7F2EA" }}>T</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "#F7F2EA" }}>tools.talenest.org</div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.04em" }}>INTERNAL OPS HUB</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6DCDB8" }} />
            <span style={{ fontSize: 11, color: "#666" }}>
              {TOOLS.filter(t => t.status === "live").length} / {TOOLS.length} tools live
            </span>
          </div>
          <button onClick={handleLogout} style={{
            padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 10, fontFamily: "inherit", background: "rgba(255,255,255,0.04)", color: "#555"
          }}>로그아웃</button>
        </div>
      </header>

      <main style={{ padding: "20px 24px", maxWidth: 960, margin: "0 auto" }}>
        {/* Phase Filter */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Development roadmap</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setPhaseFilter(0)} style={{
              padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 500, fontFamily: "inherit",
              background: phaseFilter === 0 ? "rgba(255,255,255,0.1)" : "transparent",
              color: phaseFilter === 0 ? "#E8E6E1" : "#555"
            }}>All</button>
            {PHASES.map(p => (
              <button key={p.num} onClick={() => setPhaseFilter(p.num)} style={{
                padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 500, fontFamily: "inherit",
                background: phaseFilter === p.num ? p.color + "25" : "transparent",
                color: phaseFilter === p.num ? p.color : "#555"
              }}>
                Phase {p.num}: {p.name}
                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>{p.period}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3, height: 3, borderRadius: 2, overflow: "hidden" }}>
            {PHASES.map(p => (
              <div key={p.num} style={{
                flex: TOOLS.filter(t => t.phase === p.num).length,
                background: p.color,
                opacity: TOOLS.some(t => t.phase === p.num && t.status === "live") ? 1 : 0.2,
                borderRadius: 2
              }} />
            ))}
          </div>
        </div>

        {/* Grid + Detail */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {filtered.map(t => {
              const st = STATUS_MAP[t.status];
              const isActive = selected === t.id;
              const phase = PHASES.find(p => p.num === t.phase);
              const isLive = t.status === "live";
              return (
                <div key={t.id}
                  onClick={() => isLive ? (window.location.href = t.path) : setSelected(isActive ? null : t.id)}
                  style={{
                    background: isActive ? "rgba(59,122,109,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isActive ? "rgba(59,122,109,0.3)" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.2s"
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: phase.color + "20", color: phase.color, fontWeight: 500 }}>P{t.phase}</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.text, fontWeight: 500 }}>{st.label}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{t.desc}</div>
                  {isLive && (
                    <div style={{ marginTop: 8, fontSize: 10, color: "#6DCDB8", fontWeight: 500 }}>열기 →</div>
                  )}
                </div>
              );
            })}
          </div>

          {tool && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22, position: "sticky", top: 20, alignSelf: "start" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 26 }}>{tool.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{tool.name}</div>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>tools.talenest.org{tool.path}</div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelected(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>

              <div style={{ fontSize: 12, color: "#888", marginBottom: 18, lineHeight: 1.6 }}>{tool.desc}</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Tech stack</div>
                <div style={{ fontSize: 11, color: "#888", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>{tool.tech}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Features</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tool.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#888" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: PHASES.find(p => p.num === tool.phase)?.color || "#555", flexShrink: 0 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {[
                  ["Phase", PHASES.find(p => p.num === tool.phase)?.name, PHASES.find(p => p.num === tool.phase)?.color],
                  ["Priority", tool.priority, "#E8E6E1"],
                  ["Status", STATUS_MAP[tool.status].label, STATUS_MAP[tool.status].text]
                ].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                    <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* URL Structure */}
        <div style={{ marginTop: 28, padding: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>URL structure</div>
          <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, lineHeight: 2, color: "#888" }}>
            <div style={{ color: "#6DCDB8" }}>tools.talenest.org</div>
            {TOOLS.map((t, i) => (
              <div key={t.id} style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#333" }}>{i === TOOLS.length - 1 ? "└─" : "├─"}</span>
                <span style={{ color: t.status === "live" ? "#999" : "#555" }}>{t.path}</span>
                <span style={{ fontSize: 9, color: "#444" }}>{t.name}</span>
                {t.status === "live" && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(59,122,109,0.15)", color: "#6DCDB8" }}>LIVE</span>}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
