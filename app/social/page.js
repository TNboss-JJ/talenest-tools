"use client";
/**
 * app/social/page.js
 * Social Scheduler — AI 소셜 콘텐츠 생성 + 스케줄 관리
 */
import { useState, useEffect, useCallback } from "react";

const PLATFORMS = ["instagram", "threads", "linkedin", "twitter"];
const PLATFORM_EMOJI = { instagram: "📸", threads: "🧵", linkedin: "💼", twitter: "🐦" };
const PLATFORM_LIMITS = { instagram: 2200, threads: 500, linkedin: 1300, twitter: 280 };
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500",
  scheduled: "bg-blue-50 text-blue-600",
  posted: "bg-emerald-50 text-emerald-600",
  failed: "bg-red-50 text-red-500",
};
const STATUS_LABELS = { draft: "초안", scheduled: "예약됨", posted: "발행됨", failed: "실패" };

const TALENEST_EMOTIONS = [
  "기쁨", "슬픔", "화남", "두려움", "놀람", "설렘", "걱정", "자신감",
  "부끄러움", "사랑", "외로움", "감사", "질투", "희망",
];

export default function SocialPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [activePostId, setActivePostId] = useState(null);

  const emptyForm = {
    platform: "instagram", content: "", hashtags: "", image_url: "",
    scheduled_at: "", emotion_tag: "", campaign: "",
  };
  const [form, setForm] = useState(emptyForm);
  const aiEmptyForm = {
    platform: "instagram", topic: "", emotion: "", tone: "따뜻하고 전문적", language: "ko", campaign: "",
  };
  const [aiForm, setAiForm] = useState(aiEmptyForm);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterPlatform !== "all") params.set("platform", filterPlatform);
    if (filterStatus !== "all") params.set("status", filterStatus);
    const res = await fetch(`/api/social?${params}`);
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }, [filterPlatform, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function generateAI(e) {
    e.preventDefault();
    setGenerating(true); setAiResult(null);
    const res = await fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "ai_generate", ...aiForm }),
    });
    if (res.ok) {
      const data = await res.json();
      setAiResult(data.draft);
      setForm({
        ...emptyForm,
        platform: aiForm.platform,
        content: data.draft.content,
        hashtags: (data.draft.hashtags ?? []).join(" "),
        emotion_tag: aiForm.emotion,
        campaign: aiForm.campaign,
      });
      setAiMode(false);
    }
    setGenerating(false);
  }

  async function savePost(e) {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      hashtags: form.hashtags ? form.hashtags.split(/\s+/).filter(Boolean) : [],
      ai_generated: !!aiResult,
    };
    const res = await fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false); setAiResult(null); setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function markPosted(id) {
    await fetch("/api/social", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, _action: "mark_posted" }),
    });
    await load();
  }

  async function deletePost(id) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/social?id=${id}`, { method: "DELETE" });
    await load();
  }

  const charLimit = PLATFORM_LIMITS[form.platform] ?? 9999;
  const charCount = form.content.length;

  // 캘린더 뷰 - 예약된 포스트만
  const scheduled = posts.filter((p) => p.status === "scheduled" && p.scheduled_at);

  return (
    <div style={{ minHeight: "100vh", background: "#F9F7F3", color: "#1a1a1a", padding: "24px" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <a href="/" className="text-sm text-[#4E6F79] hover:underline">← Tools Hub</a>
            <h1 className="text-2xl font-bold text-[#2d4a52] mt-1">📱 Social Scheduler</h1>
            <p className="text-sm text-gray-500">AI 소셜 콘텐츠 초안 생성 + 스케줄 관리</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAiMode(true); setShowForm(false); setAiResult(null); }}
              className="px-4 py-2 bg-[#D08B74] text-white rounded-lg text-sm font-medium hover:bg-[#c07a63] transition-colors"
            >
              ✨ AI 초안 생성
            </button>
            <button
              onClick={() => { setShowForm(true); setAiMode(false); }}
              className="px-4 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] transition-colors"
            >
              + 직접 작성
            </button>
          </div>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "전체", count: posts.length, color: "text-gray-600" },
            { label: "초안", count: posts.filter(p => p.status === "draft").length, color: "text-gray-400" },
            { label: "예약", count: scheduled.length, color: "text-blue-500" },
            { label: "발행", count: posts.filter(p => p.status === "posted").length, color: "text-emerald-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center" style={{ backgroundColor: "white" }}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex gap-2 flex-wrap">
          {["all", ...PLATFORMS].map((p) => (
            <button key={p} onClick={() => setFilterPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterPlatform === p ? "bg-[#4E6F79] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-[#4E6F79]"
              }`}>
              {p === "all" ? "전체" : `${PLATFORM_EMOJI[p]} ${p}`}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {["all", "draft", "scheduled", "posted"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? "bg-[#4E6F79] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-[#4E6F79]"
              }`}>
              {s === "all" ? "전체 상태" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* 포스트 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ backgroundColor: "white" }}>
          {loading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📱</div>
              <div className="text-sm">AI로 소셜 콘텐츠를 생성해보세요</div>
              <div className="text-xs text-gray-300 mt-1">TaleNest 감정 키워드 기반 자동 초안 생성</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {posts.map((post) => (
                <div key={post.id} className={`px-5 py-4 ${activePostId === post.id ? "bg-slate-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-xl">{PLATFORM_EMOJI[post.platform]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>
                          {STATUS_LABELS[post.status]}
                        </span>
                        {post.ai_generated && (
                          <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-500 rounded-full">✨ AI</span>
                        )}
                        {post.emotion_tag && (
                          <span className="text-xs px-2 py-0.5 bg-[#DCEBDE] text-[#4E6F79] rounded-full">
                            {post.emotion_tag}
                          </span>
                        )}
                        {post.campaign && (
                          <span className="text-xs text-gray-400">{post.campaign}</span>
                        )}
                        {post.scheduled_at && (
                          <span className="text-xs text-blue-400">
                            📅 {new Date(post.scheduled_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm text-gray-700 ${activePostId === post.id ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>
                      {post.hashtags?.length > 0 && (
                        <div className="text-xs text-[#4E6F79] mt-1 line-clamp-1">
                          {post.hashtags.join(" ")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button onClick={() => setActivePostId(activePostId === post.id ? null : post.id)}
                        className="text-xs text-gray-400 hover:text-[#4E6F79]">
                        {activePostId === post.id ? "접기" : "펼치기"}
                      </button>
                      {post.status !== "posted" && (
                        <button onClick={() => markPosted(post.id)}
                          className="text-xs text-emerald-500 hover:underline">
                          ✓ 발행 완료
                        </button>
                      )}
                      <button onClick={() => deletePost(post.id)}
                        className="text-xs text-gray-300 hover:text-red-400">
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI 초안 생성 폼 */}
        {aiMode && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ backgroundColor: "white" }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">✨ AI 초안 생성</h3>
                <button onClick={() => setAiMode(false)} className="text-gray-400">✕</button>
              </div>
              <form onSubmit={generateAI} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">플랫폼 *</label>
                    <select value={aiForm.platform} onChange={(e) => setAiForm({ ...aiForm, platform: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{PLATFORM_EMOJI[p]} {p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">감정 키워드</label>
                    <select value={aiForm.emotion} onChange={(e) => setAiForm({ ...aiForm, emotion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      <option value="">자유</option>
                      {TALENEST_EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">주제 *</label>
                  <input value={aiForm.topic} onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })} required
                    placeholder="예: 아이의 감정 학습이 중요한 이유"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">톤앤매너</label>
                    <input value={aiForm.tone} onChange={(e) => setAiForm({ ...aiForm, tone: e.target.value })}
                      placeholder="따뜻하고 전문적"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">언어</label>
                    <select value={aiForm.language} onChange={(e) => setAiForm({ ...aiForm, language: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      <option value="ko">🇰🇷 한국어</option>
                      <option value="en">🇺🇸 English</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">캠페인</label>
                  <input value={aiForm.campaign} onChange={(e) => setAiForm({ ...aiForm, campaign: e.target.value })}
                    placeholder="예: 파일럿 모집, 감정의 달"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setAiMode(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={generating || !aiForm.topic}
                    className="flex-1 py-2 bg-[#D08B74] text-white rounded-lg text-sm font-medium hover:bg-[#c07a63] disabled:opacity-50">
                    {generating ? "⏳ AI 생성 중..." : "✨ 생성하기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 포스트 작성/편집 폼 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "white" }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {aiResult ? "✨ AI 초안 편집 & 저장" : "포스트 작성"}
                </h3>
                <button onClick={() => { setShowForm(false); setAiResult(null); }} className="text-gray-400">✕</button>
              </div>
              <form onSubmit={savePost} className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">플랫폼 *</label>
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{PLATFORM_EMOJI[p]} {p} (최대 {PLATFORM_LIMITS[p].toLocaleString()}자)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-gray-500">본문 *</label>
                    <span className={`text-xs ${charCount > charLimit ? "text-red-500" : "text-gray-400"}`}>
                      {charCount.toLocaleString()} / {charLimit.toLocaleString()}
                    </span>
                  </div>
                  <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required
                    rows={6} placeholder="포스트 내용..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79] resize-none" />
                </div>
                {aiResult?.alt_versions?.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">AI 대안 버전 (클릭해서 적용)</label>
                    <div className="space-y-1">
                      {aiResult.alt_versions.map((v, i) => (
                        <button key={i} type="button" onClick={() => setForm({ ...form, content: v })}
                          className="w-full text-left text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg hover:bg-[#DCEBDE] transition-colors line-clamp-2">
                          {i + 1}. {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">해시태그 (공백 구분)</label>
                  <input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
                    placeholder="#TaleNest #감정교육 #에듀테크"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">감정 태그</label>
                    <select value={form.emotion_tag} onChange={(e) => setForm({ ...form, emotion_tag: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]">
                      <option value="">없음</option>
                      {TALENEST_EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">예약 발행일시</label>
                    <input type="datetime-local" value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#4E6F79]" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setAiResult(null); }}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={saving || charCount > charLimit}
                    className="flex-1 py-2 bg-[#4E6F79] text-white rounded-lg text-sm font-medium hover:bg-[#3d5a62] disabled:opacity-50">
                    {saving ? "저장 중..." : "💾 저장"}
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
