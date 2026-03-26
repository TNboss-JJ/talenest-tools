/**
 * lib/slack.js
 * TaleNest Internal Tools — Slack Webhook 유틸리티
 *
 * 버그 픽스 (2026-03-26):
 * - 환경 변수 누락 시 silent fail → 경고 로그로 변경
 * - fetch 실패 시 앱 크래시 방지 (try/catch)
 * - Block Kit 포맷으로 통일 (더 예쁜 메시지)
 */

const WEBHOOKS = {
  ceo: process.env.SLACK_WEBHOOK_CEO,
  content: process.env.SLACK_WEBHOOK_CONTENT,
  sales: process.env.SLACK_WEBHOOK_SALES,
  engineering: process.env.SLACK_WEBHOOK_ENGINEERING,
  marketing: process.env.SLACK_WEBHOOK_MARKETING,
};

// ─── 내부 전송 함수 ───────────────────────────────────────────────────────────
async function send(channel, payload) {
  const url = WEBHOOKS[channel];

  if (!url) {
    console.warn(`[Slack] ⚠️  SLACK_WEBHOOK_${channel.toUpperCase()} 환경변수 누락 — 알림 스킵`);
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Slack] ❌ ${channel} 전송 실패 (${res.status}): ${text}`);
    }
  } catch (err) {
    // 네트워크 오류가 앱 크래시로 이어지지 않도록
    console.error(`[Slack] ❌ ${channel} fetch 오류:`, err.message);
  }
}

// ─── 블록 킷 헬퍼 ─────────────────────────────────────────────────────────────
function divider() {
  return { type: "divider" };
}
function header(text) {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}
function section(markdown) {
  return { type: "section", text: { type: "mrkdwn", text: markdown } };
}
function fields(...items) {
  return {
    type: "section",
    fields: items.map((item) => ({ type: "mrkdwn", text: item })),
  };
}
function context(text) {
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  };
}

// ─── 프리빌트 템플릿 ──────────────────────────────────────────────────────────
export const slack = {
  // 💰 새 지출 (→ #ceo-daily-brief)
  newExpense(vendor, amount, currency, category) {
    const emoji = { 식비: "🍱", 교통: "🚌", 구독: "📦", 마케팅: "📢", 기타: "📝" }[category] ?? "💸";
    return send("ceo", {
      blocks: [
        header(`${emoji} 새 지출 기록`),
        fields(
          `*업체*\n${vendor}`,
          `*금액*\n${amount.toLocaleString()} ${currency}`,
          `*카테고리*\n${category}`
        ),
        context(`_tools.talenest.org/expense · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 🏢 새 리드 (→ #sales-pipeline)
  newLeads(count, query, location) {
    return send("sales", {
      blocks: [
        header(`🏢 새 기관 리드 ${count}건`),
        fields(`*검색어*\n${query}`, `*지역*\n${location}`),
        context(`_tools.talenest.org/map-scraper · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 💬 새 피드백 (→ #ceo-daily-brief)
  newFeedback(name, role, sentiment, rating) {
    const sentimentEmoji = { positive: "😊", neutral: "😐", negative: "😟" }[sentiment] ?? "💬";
    return send("ceo", {
      blocks: [
        header(`${sentimentEmoji} 새 피드백`),
        fields(
          `*작성자*\n${name} (${role})`,
          `*감성*\n${sentiment}`,
          `*평점*\n${"⭐".repeat(Math.min(rating, 5))}`
        ),
        context(`_tools.talenest.org/feedback · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 📚 새 에셋 (→ #content-factory)
  newAsset(title, type, emotion, character) {
    const typeEmoji = { story: "📖", worksheet: "📝", song: "🎵", quiz: "❓", ar: "🥽" }[type] ?? "📦";
    return send("content", {
      blocks: [
        header(`${typeEmoji} 새 콘텐츠 에셋`),
        fields(
          `*제목*\n${title}`,
          `*타입*\n${type}`,
          `*감정*\n${emotion}`,
          `*캐릭터*\n${character ?? "-"}`
        ),
        context(`_tools.talenest.org/content · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 📥 CSV 임포트 완료 (→ #ceo-daily-brief)
  csvImported(table, count) {
    return send("ceo", {
      blocks: [
        header("📥 CSV 임포트 완료"),
        fields(`*테이블*\n${table}`, `*건수*\n${count.toLocaleString()}건`),
        context(`_tools.talenest.org/import · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 🔴 API 에러 (→ #engineering)
  error(endpoint, message) {
    return send("engineering", {
      blocks: [
        header("🔴 API 에러 발생"),
        section(`*엔드포인트:* \`${endpoint}\`\n*에러:* ${message}`),
        context(`_${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 📊 업타임 알림 (→ #engineering) [신규 - Monitor용]
  siteDown(url, statusCode, responseTime) {
    return send("engineering", {
      blocks: [
        header("🔴 사이트 다운 감지"),
        fields(
          `*URL*\n${url}`,
          `*상태코드*\n${statusCode ?? "응답 없음"}`,
          `*응답시간*\n${responseTime ? `${responseTime}ms` : "-"}`
        ),
        context(`_tools.talenest.org/monitor · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  siteRecovered(url, responseTime) {
    return send("engineering", {
      blocks: [
        header("🟢 사이트 복구"),
        fields(`*URL*\n${url}`, `*응답시간*\n${responseTime}ms`),
        context(`_tools.talenest.org/monitor · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 📅 법무 데드라인 알림 (→ #ceo-daily-brief) [신규 - Legal용]
  legalDeadline(title, type, dueDate, daysLeft) {
    const urgency = daysLeft <= 7 ? "🔴" : daysLeft <= 30 ? "🟡" : "🟢";
    return send("ceo", {
      blocks: [
        header(`${urgency} 법무 데드라인 알림`),
        fields(
          `*항목*\n${title}`,
          `*유형*\n${type}`,
          `*마감일*\n${dueDate}`,
          `*남은 일수*\n${daysLeft}일`
        ),
        context(`_tools.talenest.org/legal · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 📱 소셜 포스팅 완료 (→ #marketing) [신규 - Social용]
  socialPosted(platform, preview) {
    const platformEmoji = {
      instagram: "📸", twitter: "🐦", linkedin: "💼", threads: "🧵"
    }[platform] ?? "📱";
    return send("marketing", {
      blocks: [
        header(`${platformEmoji} 소셜 포스팅 완료`),
        section(`*플랫폼:* ${platform}\n*내용 미리보기:* ${preview.slice(0, 100)}...`),
        context(`_tools.talenest.org/social · ${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // ✉️ 커스텀 메시지
  custom(channel, title, message, emoji = "📌") {
    if (!WEBHOOKS[channel]) {
      console.warn(`[Slack] ⚠️  알 수 없는 채널: "${channel}" — 유효 채널: ${Object.keys(WEBHOOKS).join(", ")}`);
      return Promise.resolve();
    }
    return send(channel, {
      blocks: [
        header(`${emoji} ${title}`),
        section(message),
        context(`_${new Date().toLocaleString("ko-KR")}_`),
      ],
    });
  },

  // 🧪 Slack 연동 테스트 (모든 채널에 핑 전송)
  async testAll() {
    const results = {};
    for (const [channel, url] of Object.entries(WEBHOOKS)) {
      if (!url) {
        results[channel] = "⚠️ 환경변수 없음";
        continue;
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🧪 TaleNest Tools #${channel} 채널 연동 테스트 — ${new Date().toLocaleString("ko-KR")}`,
          }),
        });
        results[channel] = res.ok ? "✅ 성공" : `❌ ${res.status}`;
      } catch (e) {
        results[channel] = `❌ ${e.message}`;
      }
    }
    return results;
  },
};
