"use client";
import { useState, useRef } from "react";

export default function CSVImporter({ table, onComplete, accentColor = "#3B7A6D" }) {
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const TABLE_LABELS = {
    contacts: "연락처 (CRM)",
    expenses: "지출 내역 (Expense Bot)",
    leads: "리드 (Lead Scraper)"
  };

  const handleFile = async (file) => {
    const text = await file.text();
    setCsvText(text);
    setStep("preview");
  };

  const getPreview = () => {
    if (!csvText) return { headers: [], rows: [] };
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1, 6).map(line =>
      line.split(",").map(v => v.replace(/"/g, "").trim())
    );
    return { headers, rows, totalRows: lines.length - 1 };
  };

  const doImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/csv-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, csvText })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setStep("done");
      if (onComplete) onComplete(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const reset = () => {
    setStep("upload");
    setCsvText("");
    setResult(null);
    setError(null);
  };

  const preview = getPreview();

  const S = {
    box: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 20 },
    btn: (p) => ({ padding: p ? "10px 20px" : "8px 14px", borderRadius: 8, border: "none", cursor: loading ? "wait" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: p ? `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` : "rgba(255,255,255,0.05)", color: p ? "#F7F2EA" : "#999", opacity: loading ? 0.5 : 1 }),
  };

  return (
    <div style={S.box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>CSV 임포트 → {TABLE_LABELS[table] || table}</div>
        {step !== "upload" && (
          <button onClick={reset} style={{ background: "none", border: "none", color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>다시</button>
        )}
      </div>

      {/* Upload */}
      {step === "upload" && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = accentColor; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            style={{ border: "2px dashed rgba(255,255,255,0.08)", borderRadius: 10, padding: "32px 16px", textAlign: "center", cursor: "pointer" }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📄</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Airtable CSV 파일 드래그 또는 클릭</div>
            <div style={{ fontSize: 10, color: "#555" }}>Airtable → ... 메뉴 → Download CSV</div>
            <input ref={fileRef} type="file" hidden accept=".csv,.tsv,.txt"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#444", textAlign: "center" }}>
            또는 CSV 텍스트를 직접 붙여넣기:
          </div>
          <textarea
            placeholder="name,company,email&#10;John Kim,EdTech Ventures,john@example.com"
            style={{ width: "100%", minHeight: 80, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 10, color: "#E8E6E1", fontSize: 11, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", marginTop: 6, outline: "none" }}
            onChange={e => setCsvText(e.target.value)}
          />
          {csvText && (
            <button onClick={() => setStep("preview")} style={{ ...S.btn(true), marginTop: 8 }}>미리보기</button>
          )}
        </div>
      )}

      {/* Preview */}
      {step === "preview" && (
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
            {preview.totalRows}개 행 감지됨 · Claude가 컬럼을 자동 매핑합니다
          </div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} style={{ padding: "6px 8px", textAlign: "left", color: "#666", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((val, j) => (
                      <td key={j} style={{ padding: "5px 8px", color: "#999", borderBottom: "1px solid rgba(255,255,255,0.03)", whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totalRows > 5 && (
            <div style={{ fontSize: 10, color: "#555", marginBottom: 10 }}>...외 {preview.totalRows - 5}개 행</div>
          )}
          <button onClick={doImport} disabled={loading} style={S.btn(true)}>
            {loading ? "임포트 중..." : `${preview.totalRows}개 행 임포트`}
          </button>
        </div>
      )}

      {/* Done */}
      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{result.inserted}개 임포트 완료!</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
            전체 {result.total_rows}행 중 {result.inserted}개 저장됨
          </div>
          {result.mapping && (
            <div style={{ textAlign: "left", fontSize: 10, color: "#666", background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>컬럼 매핑:</div>
              {Object.entries(result.mapping).map(([csv, db]) => (
                <div key={csv}>{csv} → {db || "(무시됨)"}</div>
              ))}
            </div>
          )}
          <button onClick={reset} style={S.btn(false)}>다른 파일 임포트</button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 10, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>{error}</div>
      )}
    </div>
  );
}
