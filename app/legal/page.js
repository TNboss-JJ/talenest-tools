"use client";
/**
 * app/legal/page.js
 * Legal Tracker — 상표/계약/기한 관리
 */
import { useState, useEffect, useCallback } from "react";

const TYPES = ["trademark", "contract", "filing", "renewal", "other"];
const TYPE_LABELS = { trademark: "상표", contract: "계약", filing: "출원", renewal: "갱신", other: "기타" };
const TYPE_EMOJI = { trademark: "™️", contract: "📜", filing: "📋", renewal: "🔄", other: "📌" };
const JURISDICTIONS = ["US", "KR", "EU", "Global", "기타"];
const STATUS_OPTIONS = ["active", "pending", "expired", "completed"];
const STATUS_LABELS = { active: "진행중", pending: "대기중", expired: "만료", completed: "완료" };

export default function LegalPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    type: "trademark", title: "", jurisdiction: "US", status: "active",
    filing_date: "", due_date: "", registration_number: "", notes: "", drive_url: "", notify_days: 30,
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const params = filterType !== "all" ? `?type=${filterType}` : "?status=all";
    const res = await fetch(`/api/legal${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const method = editItem ? "PATCH" : "POST";
    const body = editItem ? { ...form, id: editItem.id } : form;

    const res = await fetch("/api/legal", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false); setEditItem(null); setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function deleteItem(id) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/legal?id=${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(item) {
    setForm({
      type: item.type, title: item.title, jurisdiction: item.jurisdiction ?? "US",
      status: item.status, filing_date: item.filing_date ?? "",
      due_date: item.due_date ?? "", registration_number: item.registration_number ?? "",
      notes: item.notes ?? "", drive_url: item.drive_url ?? "", notify_days: item.notify_days ?? 30,
    });
    setEditItem(item);
    setShowForm(true);
  }

  const DaysBadge = ({ days }) => {
    if (days === null) return null;
    const cfg = days < 0 ? "bg-red-100 text-red-600" :
      days <= 7 ? "bg-red-50 text-red-500" :
      days <= 30 ? "bg-amber-50 text-amber-600" :
      "bg-emerald-50 text-emerald-600";
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg}`}>
        {days < 0 ? `${Math.abs(days)}일 초과` : `D-${days}`}
      </span>
    );
  };

  // 요약
  const upcoming = items.filter((i) => i.days_left !== null && i.days_left >= 0 && i.days_left <= 30);
  const overdue = items.filter((i) => i.days_left !== null && i.days_left < 0);

  return (
    <div className="min-h-screen bg-[#F9F7F3] p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <a href="/" className="text-sm text-[#4E6F79] hover:underline">← Tools Hub</a>
            <h1 className="text-2xl font-bold text-[#2d4a52] mt-1">⚖️ Legal Tracker</h1>
            <p className="text-sm text-gray-500">상표권, 계약, 법무 일정 관리</p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setEditItem(null); setShowForm(true); }}
            className="px-4 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] transition-colors"
          >
            + 항목 추가
          </button>
        </div>

        {/* 알림 배너 */}
        {(overdue.length > 0 || upcoming.length > 0) && (
          <div className="space-y-2">
            {overdue.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                🔴 <strong>{overdue.length}건</strong>이 기한을 초과했습니다
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-600">
                🟡 <strong>{upcoming.length}건</strong>이 30일 이내 마감입니다
              </div>
            )}
          </div>
        )}

        {/* 탭 필터 */}
        <div className="flex gap-2 flex-wrap">
          {["all", ...TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-[#4E6F79] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-[#4E6F79]"
              }`}
            >
              {t === "all" ? "전체" : `${TYPE_EMOJI[t]} ${TYPE_LABELS[t]}`}
            </button>
          ))}
        </div>

        {/* 항목 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">⚖️</div>
              <div className="text-sm">법무 항목을 추가하세요</div>
              <div className="text-xs text-gray-300 mt-1">상표, 계약, 출원 일정을 한 곳에서 관리</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="text-2xl mt-0.5">{TYPE_EMOJI[item.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        {item.jurisdiction}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === "active" ? "bg-emerald-50 text-emerald-600" :
                        item.status === "pending" ? "bg-blue-50 text-blue-600" :
                        item.status === "expired" ? "bg-red-50 text-red-500" :
                        "bg-gray-50 text-gray-400"
                      }`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    {item.registration_number && (
                      <div className="text-xs text-gray-400 mt-0.5">등록번호: {item.registration_number}</div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {item.filing_date && <span>출원: {item.filing_date}</span>}
                      {item.due_date && <span>마감: {item.due_date}</span>}
                    </div>
                    {item.notes && <div className="text-xs text-gray-400 mt-1 line-clamp-1">{item.notes}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <DaysBadge days={item.days_left} />
                    <div className="flex gap-2">
                      {item.drive_url && (
                        <a href={item.drive_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#4E6F79] hover:underline">
                          📁 Drive
                        </a>
                      )}
                      <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-[#4E6F79]">
                        수정
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-gray-300 hover:text-red-400">
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 추가/수정 폼 모달 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{editItem ? "항목 수정" : "항목 추가"}</h3>
                <button onClick={() => { setShowForm(false); setEditItem(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={save} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">유형 *</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      {TYPES.map((t) => <option key={t} value={t}>{TYPE_EMOJI[t]} {TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">관할권</label>
                    <select value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">제목 *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                    placeholder="예: TaleNest 미국 상표 (Class 41)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">출원/계약일</label>
                    <input type="date" value={form.filing_date} onChange={(e) => setForm({ ...form, filing_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">마감일</label>
                    <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">등록번호</label>
                  <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                    placeholder="출원/등록번호"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Google Drive URL</label>
                  <input value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">메모</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2} placeholder="추가 메모"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79] resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
