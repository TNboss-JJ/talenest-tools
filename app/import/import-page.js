"use client";
import { useState } from "react";
import CSVImporter from "@/components/CSVImporter";

const TABLES = [
  { id: "contacts", label: "연락처 → CRM", icon: "🤝", color: "#9B8EC5", desc: "투자자, 파트너, 멘토 연락처" },
  { id: "expenses", label: "지출 내역 → Expense Bot", icon: "💳", color: "#3B7A6D", desc: "결제 내역, 인보이스" },
  { id: "leads", label: "리드 → Lead Scraper", icon: "🔍", color: "#E8A87C", desc: "잠재 투자자/파트너 리스트" },
];

export default function ImportPage() {
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        input:focus,textarea:focus{outline:none;border-color:#3B7A6D!important}`}</style>

      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← Hub</a>
        <span style={{ fontSize: 16, fontWeight: 700 }}>CSV Import</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(59,122,109,0.2)", color: "#3B7A6D", fontWeight: 600 }}>BULK</span>
      </header>

      <main style={{ padding: "20px 24px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 12, color: "#777", marginBottom: 20, lineHeight: 1.6 }}>
          Airtable이나 엑셀에서 내보낸 CSV 파일을 업로드하면 Claude가 자동으로 컬럼을 매핑해서 DB에 넣어줍니다.
        </div>

        {/* Table selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {TABLES.map(t => (
            <button key={t.id} onClick={() => setSelected(t.id)} style={{
              flex: 1, padding: "14px 12px", borderRadius: 10, border: `1px solid ${selected === t.id ? t.color + "40" : "rgba(255,255,255,0.04)"}`,
              background: selected === t.id ? t.color + "12" : "rgba(255,255,255,0.02)",
              cursor: "pointer", textAlign: "left", fontFamily: "inherit"
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: selected === t.id ? t.color : "#E8E6E1" }}>{t.label}</div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Importer */}
        {selected && (
          <CSVImporter
            table={selected}
            accentColor={TABLES.find(t => t.id === selected)?.color}
            onComplete={(data) => setResults(prev => [{ table: selected, ...data, time: new Date().toLocaleTimeString() }, ...prev])}
          />
        )}

        {/* History */}
        {results.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>임포트 기록</div>
            {results.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#6DCDB8" }}>✓</span>
                <span style={{ color: "#999" }}>{r.time}</span>
                <span style={{ color: "#888" }}>{r.table}</span>
                <span style={{ color: "#E8E6E1", fontWeight: 600 }}>{r.inserted}개 추가</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
