"use client";
import { useState, useRef, useCallback } from "react";
import { useExpenses } from "@/lib/use-expenses";
import { createClient } from "@/lib/supabase-browser";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CATEGORIES = [
  "SaaS/구독", "클라우드/호스팅", "도메인/DNS", "디자인도구",
  "마케팅/광고", "법무/상표", "교통/출장", "사무용품",
  "식비/회의비", "교육/컨퍼런스", "기타"
];

const CAT_COLORS = {
  "SaaS/구독": "#6DCDB8", "클라우드/호스팅": "#5B9BD5", "도메인/DNS": "#9B8EC5",
  "디자인도구": "#E8A87C", "마케팅/광고": "#D4769B", "법무/상표": "#C4784A",
  "교통/출장": "#7EC8A0", "사무용품": "#BFAF6D", "식비/회의비": "#D9A066",
  "교육/컨퍼런스": "#8CAFD0", "기타": "#888"
};

export default function ExpensePage() {
  const {
    expenses, loading, error: fetchError,
    addExpense, deleteExpense, parseFile, parseText, fetchExpenses
  } = useExpenses();

  const [view, setView] = useState("table");
  const [filterCat, setFilterCat] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [error, setError] = useState(null);
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split("T")[0],
    vendor: "", description: "", amount: "",
    currency: "USD", category: "SaaS/구독",
    tax_deductible: true, source_type: "card_statement"
  });

  const fileRef = useRef(null);
  const textRef = useRef(null);

  // ─── Derived data ────────────────────────────────────────────────────────────
  const now = new Date();
  const thisMonthStr = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

  const thisMonthUSD = expenses
    .filter(e => e.date?.startsWith(thisMonthStr) && e.currency !== "KRW")
    .reduce((s, e) => s + Number(e.amount), 0);
  const lastMonthUSD = expenses
    .filter(e => e.date?.startsWith(lastMonthStr) && e.currency !== "KRW")
    .reduce((s, e) => s + Number(e.amount), 0);
  const monthChangePct = lastMonthUSD > 0
    ? ((thisMonthUSD - lastMonthUSD) / lastMonthUSD * 100).toFixed(1)
    : null;

  // Monthly chart data (all currencies merged as amounts)
  const monthlyDataMap = {};
  expenses.forEach(e => {
    const month = (e.date || "").slice(0, 7);
    if (!month) return;
    monthlyDataMap[month] = (monthlyDataMap[month] || 0) + Number(e.amount);
  });
  const monthlyData = Object.entries(monthlyDataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

  // Category pie data
  const catDataMap = {};
  expenses.forEach(e => {
    const cat = e.category || "기타";
    catDataMap[cat] = (catDataMap[cat] || 0) + Number(e.amount);
  });
  const categoryData = Object.entries(catDataMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  // Subscription detection
  const vendorMap = {};
  expenses.forEach(e => {
    if (!vendorMap[e.vendor]) vendorMap[e.vendor] = [];
    vendorMap[e.vendor].push(e);
  });
  const subscriptions = Object.entries(vendorMap)
    .filter(([, items]) => items.length >= 2)
    .map(([vendor, items]) => {
      const sorted = [...items].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const avgAmount = items.reduce((s, e) => s + Number(e.amount), 0) / items.length;
      const lastDate = sorted[sorted.length - 1].date;
      const currency = items[0].currency;
      let cycle = "불명";
      if (sorted.length >= 2) {
        const first = new Date(sorted[0].date);
        const last = new Date(sorted[sorted.length - 1].date);
        const avgDays = (last - first) / (1000 * 60 * 60 * 24) / (sorted.length - 1);
        if (avgDays <= 45) cycle = "매월";
        else if (avgDays <= 200) cycle = "분기";
        else cycle = "매년";
      }
      return { vendor, count: items.length, avgAmount, lastDate, cycle, currency };
    })
    .sort((a, b) => b.avgAmount - a.avgAmount);

  const monthlySubTotal = subscriptions
    .filter(s => s.cycle === "매월")
    .reduce((sum, s) => sum + s.avgAmount, 0);

  // ─── Existing logic ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleFiles = useCallback(async (files) => {
    setProcessing(true);
    setError(null);
    for (let i = 0; i < files.length; i++) {
      setProcessingMsg(`분석 중... (${i + 1}/${files.length}) ${files[i].name}`);
      try {
        await parseFile(files[i]);
      } catch (e) {
        setError(prev => (prev ? prev + "\n" : "") + `${files[i].name}: ${e.message}`);
      }
    }
    setProcessing(false);
    setProcessingMsg("");
    setView("table");
  }, [parseFile]);

  const handleTextPaste = useCallback(async () => {
    const text = textRef.current?.value;
    if (!text?.trim()) return;
    setProcessing(true);
    setProcessingMsg("텍스트 분석 중...");
    setError(null);
    try {
      await parseText(text);
      textRef.current.value = "";
      setView("table");
    } catch (e) {
      setError(e.message);
    }
    setProcessing(false);
    setProcessingMsg("");
  }, [parseText]);

  const handleManualAdd = useCallback(async () => {
    if (!manualForm.vendor || !manualForm.amount) return;
    try {
      await addExpense({
        ...manualForm,
        amount: parseFloat(manualForm.amount),
        source_type: "manual"
      });
      setManualForm(prev => ({ ...prev, vendor: "", description: "", amount: "" }));
    } catch (e) {
      setError(e.message);
    }
  }, [manualForm, addExpense]);

  const filtered = expenses
    .filter(e => filterCat === "all" || e.category === filterCat)
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "amount") return (a.amount - b.amount) * mul;
      return ((a[sortField] || "") > (b[sortField] || "") ? 1 : -1) * mul;
    });

  const totalKRW = expenses.filter(e => e.currency === "KRW").reduce((s, e) => s + Number(e.amount), 0);
  const totalUSD = expenses.filter(e => e.currency !== "KRW").reduce((s, e) => s + Number(e.amount), 0);

  const exportCSV = () => {
    const header = "날짜,업체,설명,금액,통화,카테고리,세금공제,출처유형\n";
    const rows = expenses.map(e =>
      `${e.date},"${e.vendor}","${e.description}",${e.amount},${e.currency},"${e.category}",${e.tax_deductible},${e.source_type}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const S = {
    input: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit", outline: "none" },
    select: { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 12px", color: "#E8E6E1", fontSize: 12, fontFamily: "inherit" },
    btn: (primary) => ({
      padding: primary ? "9px 18px" : "7px 14px", borderRadius: primary ? 8 : 7,
      border: "none", cursor: "pointer", fontSize: primary ? 12 : 11,
      fontWeight: primary ? 600 : 500, fontFamily: "inherit",
      background: primary ? "linear-gradient(135deg, #3B7A6D, #2A5C52)" : "rgba(255,255,255,0.05)",
      color: primary ? "#F7F2EA" : "#999"
    }),
    label: { fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Pretendard', sans-serif", minHeight: "100vh", background: "#0F1117", color: "#E8E6E1" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3B7A6D, #2A5C52)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#F7F2EA" }}>₩</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>ExpenseBot</span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "rgba(59,122,109,0.2)", color: "#3B7A6D", fontWeight: 600 }}>LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <nav style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
            {[["table","내역"],["upload","업로드"],["manual","수동"],["chart","차트"],["subscriptions","구독"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 500, fontFamily: "inherit",
                background: view === v ? "rgba(59,122,109,0.25)" : "transparent",
                color: view === v ? "#6DCDB8" : "#666"
              }}>{l}</button>
            ))}
          </nav>
          <button onClick={handleLogout} style={{ ...S.btn(false), fontSize: 10, color: "#555" }}>로그아웃</button>
        </div>
      </header>

      <main style={{ padding: "16px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
          {[
            ["총 건수", `${expenses.length}건`, "#E8E6E1"],
            ["USD", `$${totalUSD.toLocaleString("en", { minimumFractionDigits: 2 })}`, "#6DCDB8"],
            ["KRW", `₩${totalKRW.toLocaleString("ko")}`, "#5B9BD5"],
            ["공제 가능", `${expenses.filter(e => e.tax_deductible).length}건`, "#E8A87C"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
          {/* This month */}
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>이번 달</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#E8E6E1", fontVariantNumeric: "tabular-nums" }}>
              ${thisMonthUSD.toLocaleString("en", { minimumFractionDigits: 2 })}
            </div>
          </div>
          {/* vs last month */}
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>지난달 대비</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: monthChangePct === null ? "#555" : Number(monthChangePct) > 0 ? "#E24B4A" : "#6DCDB8" }}>
              {monthChangePct === null ? "—" : `${Number(monthChangePct) > 0 ? "+" : ""}${monthChangePct}%`}
            </div>
          </div>
        </div>

        {/* Upload View */}
        {view === "upload" && (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#3B7A6D"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(59,122,109,0.2)"; }}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              style={{ border: "2px dashed rgba(59,122,109,0.2)", borderRadius: 12, padding: "36px 16px", textAlign: "center", cursor: "pointer", background: "rgba(59,122,109,0.02)", marginBottom: 16 }}
            >
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>📎</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>파일 드래그 또는 클릭</div>
              <div style={{ fontSize: 11, color: "#555" }}>영수증 이미지 · PDF · CSV</div>
              <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.csv,.txt"
                onChange={e => e.target.files.length && handleFiles(e.target.files)} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>텍스트 붙여넣기</div>
            <textarea ref={textRef} placeholder="이메일 결제 확인, 카드 알림 문자 등..."
              style={{ width: "100%", minHeight: 100, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, color: "#E8E6E1", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            <button onClick={handleTextPaste} style={{ ...S.btn(true), marginTop: 8 }}>AI 분석</button>
          </div>
        )}

        {/* Manual */}
        {view === "manual" && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={S.label}>날짜</label>
                <input type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))} style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={S.label}>업체명</label>
                <input value={manualForm.vendor} onChange={e => setManualForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Vercel, Figma..." style={S.input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={S.label}>설명</label>
                <input value={manualForm.description} onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))} placeholder="Pro Plan 월정액" style={S.input} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={S.label}>금액</label>
                  <input type="number" step="0.01" value={manualForm.amount} onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))} placeholder="29.99" style={S.input} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={S.label}>통화</label>
                  <select value={manualForm.currency} onChange={e => setManualForm(p => ({ ...p, currency: e.target.value }))} style={S.select}>
                    <option value="USD">USD</option><option value="KRW">KRW</option><option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={S.label}>카테고리</label>
                <select value={manualForm.category} onChange={e => setManualForm(p => ({ ...p, category: e.target.value }))} style={S.select}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11 }}>
                  <input type="checkbox" checked={manualForm.tax_deductible} onChange={e => setManualForm(p => ({ ...p, tax_deductible: e.target.checked }))} />
                  세금공제
                </label>
                <div style={{ flex: 1 }} />
                <button onClick={handleManualAdd} style={S.btn(true)}>추가</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {view === "table" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={S.select}>
                <option value="all">전체</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: "#444" }}>{filtered.length}건</span>
              <button onClick={exportCSV} style={S.btn(false)}>CSV 내보내기</button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444", fontSize: 12 }}>불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>아직 내역이 없어요</div>
                <button onClick={() => setView("upload")} style={{ ...S.btn(true), marginTop: 10 }}>업로드하기</button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px" }}>
                  <thead>
                    <tr>
                      {[["date","날짜"],["vendor","업체"],["description","설명"],["amount","금액"],["category","카테고리"],["",""]].map(([f,l],i) => (
                        <th key={i} onClick={() => f && (sortField===f ? setSortDir(d=>d==="asc"?"desc":"asc") : (setSortField(f), setSortDir("desc")))}
                          style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", cursor: f?"pointer":"default", userSelect: "none" }}>
                          {l} {sortField===f ? (sortDir==="asc"?"↑":"↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id}>
                        <td style={{ padding: "9px 10px", fontSize: 11, background: "rgba(255,255,255,0.015)", color: "#777", borderRadius: "6px 0 0 6px" }}>{e.date}</td>
                        <td style={{ padding: "9px 10px", fontSize: 12, background: "rgba(255,255,255,0.015)", fontWeight: 600 }}>{e.vendor}</td>
                        <td style={{ padding: "9px 10px", fontSize: 11, background: "rgba(255,255,255,0.015)", color: "#888", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</td>
                        <td style={{ padding: "9px 10px", fontSize: 12, background: "rgba(255,255,255,0.015)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {e.currency === "KRW" ? "₩" : "$"}{Number(e.amount).toLocaleString(e.currency === "KRW" ? "ko" : "en", { minimumFractionDigits: e.currency === "KRW" ? 0 : 2 })}
                        </td>
                        <td style={{ padding: "9px 10px", background: "rgba(255,255,255,0.015)" }}>
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: (CAT_COLORS[e.category]||"#888") + "15", color: CAT_COLORS[e.category]||"#888" }}>{e.category}</span>
                        </td>
                        <td style={{ padding: "9px 10px", background: "rgba(255,255,255,0.015)", borderRadius: "0 6px 6px 0" }}>
                          <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Chart View */}
        {view === "chart" && (
          <div>
            {expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#444" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 13 }}>내역을 먼저 추가해주세요</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Monthly Bar Chart */}
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>월별 지출</div>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 16 }}>혼합 통화 기준 합산</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip
                        contentStyle={{ background: "#1A1D26", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#E8E6E1" }}
                        itemStyle={{ color: "#6DCDB8" }}
                        formatter={(v) => [v.toLocaleString(), "금액"]}
                      />
                      <Bar dataKey="total" fill="#3B7A6D" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category Pie Chart */}
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>카테고리별 지출</div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                    <ResponsiveContainer width={220} height={220}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                          {categoryData.map((entry, i) => (
                            <Cell key={i} fill={CAT_COLORS[entry.name] || "#888"} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#1A1D26", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                          itemStyle={{ color: "#E8E6E1" }}
                          formatter={(v) => [v.toLocaleString(), "금액"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {categoryData.map((entry, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[entry.name] || "#888", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "#999", minWidth: 100 }}>{entry.name}</span>
                          <span style={{ fontSize: 11, color: "#E8E6E1", fontVariantNumeric: "tabular-nums" }}>{entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subscriptions View */}
        {view === "subscriptions" && (
          <div>
            {/* Summary */}
            <div style={{ background: "rgba(59,122,109,0.08)", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(59,122,109,0.15)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "#6DCDB8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>이번 달 예상 구독 비용</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  ${monthlySubTotal.toLocaleString("en", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>감지된 구독</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#6DCDB8" }}>{subscriptions.length}개</div>
              </div>
            </div>

            {subscriptions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#444" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13 }}>같은 업체에서 2회 이상 결제 내역이 있으면 여기에 표시됩니다</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {subscriptions.map((s, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(59,122,109,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {s.cycle === "매월" ? "🔄" : s.cycle === "매년" ? "📅" : "🔃"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.vendor}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                        마지막 결제: {s.lastDate} · 총 {s.count}회
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {s.currency === "KRW" ? "₩" : "$"}{s.avgAmount.toLocaleString(s.currency === "KRW" ? "ko" : "en", { minimumFractionDigits: s.currency === "KRW" ? 0 : 2 })}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: s.cycle === "매월" ? "rgba(109,205,184,0.15)" : "rgba(91,155,213,0.15)", color: s.cycle === "매월" ? "#6DCDB8" : "#5B9BD5", fontWeight: 500 }}>
                          {s.cycle}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(error || fetchError) && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(220,80,80,0.06)", border: "1px solid rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 11, color: "#E88" }}>
            {error || fetchError}
          </div>
        )}
      </main>

      {processing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.85)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 999, backdropFilter: "blur(8px)" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(59,122,109,0.2)", borderTop: "3px solid #3B7A6D", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{processingMsg}</div>
          <div style={{ fontSize: 11, color: "#555" }}>Claude가 분석 중 → Supabase에 저장됩니다</div>
        </div>
      )}
    </div>
  );
}
