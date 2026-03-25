const WEBHOOKS = {
  ceo:         process.env.SLACK_WEBHOOK_CEO,
  content:     process.env.SLACK_WEBHOOK_CONTENT,
  sales:       process.env.SLACK_WEBHOOK_SALES,
  engineering: process.env.SLACK_WEBHOOK_ENGINEERING,
  marketing:   process.env.SLACK_WEBHOOK_MARKETING,
};

const BASE_URL = "https://tools.talenest.org";

async function notify(channel, { title, message, emoji = "🔔", fields = [], link, linkText }) {
  const url = WEBHOOKS[channel];
  if (!url) return;

  const text = [
    `${emoji} *${title}*`,
    message,
    fields.length ? fields.map(f => `• *${f.label}:* ${f.value}`).join("\n") : null,
    link ? `<${link}|${linkText || "열기 →"}>` : null,
  ].filter(Boolean).join("\n");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("[Slack] notify failed:", e.message);
  }
}

export const slack = {
  notify,

  newExpense(vendor, amount, currency, category) {
    return notify("ceo", {
      emoji: "💳",
      title: "새 지출 기록",
      message: `*${vendor}* — ${amount.toLocaleString()} ${currency}`,
      fields: [{ label: "카테고리", value: category }],
      link: `${BASE_URL}/expense`,
      linkText: "Expense Bot 열기",
    });
  },

  expenseParsed(count, source) {
    return notify("ceo", {
      emoji: "🤖",
      title: `AI 파싱 완료 — ${count}건`,
      message: source ? `출처: ${source}` : "영수증/인보이스 분석",
      link: `${BASE_URL}/expense`,
      linkText: "Expense Bot 열기",
    });
  },

  newLeads(count, query, location) {
    return notify("sales", {
      emoji: "🗺️",
      title: `Maps 리드 ${count}개 저장`,
      message: [query, location].filter(Boolean).join(" · "),
      link: `${BASE_URL}/crm`,
      linkText: "CRM 열기",
    });
  },

  stageChange(name, company, fromStage, toStage) {
    return notify("sales", {
      emoji: "🤝",
      title: "파이프라인 단계 변경",
      message: `*${name}* (${company})`,
      fields: [{ label: "변경", value: `${fromStage} → ${toStage}` }],
      link: `${BASE_URL}/crm`,
      linkText: "CRM 열기",
    });
  },

  newContact(name, company, type) {
    return notify("sales", {
      emoji: "👤",
      title: "새 연락처 추가",
      message: `*${name}* ${company ? `@ ${company}` : ""}`,
      fields: type ? [{ label: "유형", value: type }] : [],
      link: `${BASE_URL}/crm`,
      linkText: "CRM 열기",
    });
  },

  leadConverted(name, company, score) {
    return notify("sales", {
      emoji: "✅",
      title: "리드 → 연락처 전환",
      message: `*${name}* (${company})`,
      fields: [{ label: "Fit Score", value: `${score}/100` }],
      link: `${BASE_URL}/crm`,
      linkText: "CRM 열기",
    });
  },

  newFeedback(respondentName, respondentRole, sentiment, rating) {
    const emoji = sentiment === "positive" ? "😊" : sentiment === "negative" ? "😟" : "😐";
    return notify("ceo", {
      emoji,
      title: "새 피드백 수집",
      message: [respondentName, respondentRole].filter(Boolean).join(" · "),
      fields: [
        ...(sentiment ? [{ label: "감성", value: sentiment }] : []),
        ...(rating    ? [{ label: "평점", value: `${rating}/10` }] : []),
      ],
      link: `${BASE_URL}/feedback`,
      linkText: "Feedback Hub 열기",
    });
  },

  newAsset(title, type, emotion, character) {
    return notify("content", {
      emoji: "📚",
      title: "새 에셋 추가",
      message: `*${title}*`,
      fields: [
        ...(type      ? [{ label: "유형", value: type }] : []),
        ...(emotion   ? [{ label: "감정", value: emotion }] : []),
        ...(character ? [{ label: "캐릭터", value: character }] : []),
      ],
      link: `${BASE_URL}/content`,
      linkText: "Content Vault 열기",
    });
  },

  csvImported(table, count) {
    return notify("ceo", {
      emoji: "📥",
      title: `CSV 임포트 완료 — ${count}건`,
      message: `테이블: *${table}*`,
      link: `${BASE_URL}/import`,
      linkText: "CSV Import 열기",
    });
  },

  error(endpoint, message) {
    return notify("engineering", {
      emoji: "🚨",
      title: `API 에러: ${endpoint}`,
      message,
      link: `${BASE_URL}`,
      linkText: "Tools Hub 열기",
    });
  },

  custom(channel, title, message, emoji = "🔔") {
    return notify(channel, { title, message, emoji });
  },
};
