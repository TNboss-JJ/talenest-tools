# TaleNest Tools — 코드 리뷰 & Phase 2 통합 가이드
> 작성: 2026-03-26 | Claude AI

---

## 🔴 발견된 버그 & 픽스

### 1. `lib/slack.js` — Slack 일부만 작동하는 원인
**증상:** 일부 채널만 알림이 옴
**원인:**
- 환경변수 `SLACK_WEBHOOK_*` 중 하나라도 미설정 시 `fetch(undefined)` → TypeError 발생
- 에러가 catch되지 않아 해당 API route 전체 크래시 가능성
- 에러 로그가 없어 어느 채널 문제인지 파악 불가

**픽스:** `lib/slack.js` 완전 재작성
- 환경변수 없으면 `console.warn`만 하고 스킵 (앱 크래시 방지)
- fetch 실패 시 `console.error` 후 조용히 처리
- Block Kit 포맷으로 통일 (가독성 향상)
- `slack.testAll()` 메서드 추가 → 5채널 동시 테스트

**즉시 확인:** 배포 후 `https://tools.talenest.org/api/slack-test` 접속
```json
{
  "status": "✅ 전체 연동 정상",
  "channels": {
    "ceo": "✅ 성공",
    "content": "✅ 성공",
    "sales": "✅ 성공",
    "engineering": "⚠️ 환경변수 없음",   ← 이런 식으로 어느 채널 문제인지 표시
    "marketing": "✅ 성공"
  },
  "missing_env_vars": ["SLACK_WEBHOOK_ENGINEERING"]
}
```

---

### 2. `lib/rate-limit.js` — Serverless 주의사항
**증상:** 없음 (현재는 무관)
**원인:** Vercel Serverless는 인스턴스가 독립적 → Map이 공유 안 됨
**현실적 영향:** 1인 사용자이므로 실질적 문제 없음
**픽스:** `getClientIp()` 헬퍼 추가, 주석으로 명확화

---

### 3. Supabase 쿼리 패턴 확인 필요 (직접 코드 봐야 확인 가능)
가능성 있는 버그들:
- `supabase-server.js`에서 Next.js 15 cookie handling
  → `@supabase/ssr` v0.5+ 사용 중인지 확인
  → `createServerClient` + `cookies()` 패턴이 올바른지 확인
- API route에서 `await supabase.auth.getUser()` 구조분해 시 `data`가 null일 경우 크래시
  → 방어 코드: `const { data: { user } = {} } = await supabase.auth.getUser()`

---

## ✅ Phase 2 추가 파일 목록

### 새로 만든 파일
```
lib/slack.js                          ← 기존 파일 교체 (버그 픽스)
lib/rate-limit.js                     ← 기존 파일 교체 (minor 개선)

app/monitor/page.js                   ← Site Monitor UI
app/api/monitor/route.js              ← 업타임 체크 API
app/api/slack-test/route.js           ← Slack 연동 테스트

app/legal/page.js                     ← Legal Tracker UI
app/api/legal/route.js                ← 법무 항목 CRUD API

app/social/page.js                    ← Social Scheduler UI
app/api/social/route.js               ← 소셜 포스트 + AI 생성 API

phase2/migration.sql                  ← Supabase DB 마이그레이션
```

---

## 📋 배포 체크리스트

### Step 1: Supabase DB 마이그레이션
```
Supabase Dashboard
→ SQL Editor
→ migration.sql 내용 전체 복붙
→ Run
```
생성되는 테이블: `uptime_checks`, `monitor_targets`, `legal_items`, `social_posts`

### Step 2: Vercel 환경변수 확인
```
Vercel → talenest-tools → Settings → Environment Variables
```
현재 있어야 하는 것들:
- [x] NEXT_PUBLIC_SUPABASE_URL
- [x] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [x] SUPABASE_SERVICE_ROLE_KEY
- [x] ANTHROPIC_API_KEY
- [x] ALLOWED_EMAIL
- [x] OWNER_USER_ID
- [x] CRON_SECRET
- [ ] SLACK_WEBHOOK_CEO          ← slack-test로 확인
- [ ] SLACK_WEBHOOK_CONTENT      ← slack-test로 확인
- [ ] SLACK_WEBHOOK_SALES        ← slack-test로 확인
- [ ] SLACK_WEBHOOK_ENGINEERING  ← slack-test로 확인
- [ ] SLACK_WEBHOOK_MARKETING    ← slack-test로 확인

### Step 3: 파일 복사
```powershell
cd C:\Users\chlwo\expense-bot

# lib 교체
copy fixes\lib\slack.js lib\slack.js
copy fixes\lib\rate-limit.js lib\rate-limit.js

# Phase 2 폴더 생성
mkdir app\monitor
mkdir app\legal
mkdir app\social
mkdir app\api\monitor
mkdir app\api\legal
mkdir app\api\social
mkdir app\api\slack-test

# 파일 복사
copy phase2\app\monitor\page.js app\monitor\page.js
copy phase2\app\api\monitor\route.js app\api\monitor\route.js
copy phase2\app\legal\page.js app\legal\page.js
copy phase2\app\api\legal\route.js app\api\legal\route.js
copy phase2\app\social\page.js app\social\page.js
copy phase2\app\api\social\route.js app\api\social\route.js
copy phase2\app\api\slack-test\route.js app\api\slack-test\route.js
```

### Step 4: app/page.js TOOLS 배열에 3개 추가
(ADDITIONS.js 파일의 [1] 섹션 참고)

### Step 5: 배포
```powershell
git add .
git commit -m "feat: Phase 2 - Monitor/Legal/Social + Slack fix"
git push
```

### Step 6: 연동 테스트
1. 배포 완료 후 `https://tools.talenest.org/api/slack-test` 접속
2. 각 채널에 테스트 메시지 수신 확인
3. 누락된 채널 있으면 Vercel 환경변수 추가

---

## 🔧 DNS 픽스 (tools.talenest.org 안 열릴 때)

### 원인: CNAME 레코드 누락
```
WordPress 관리자 → 도메인 → talenest.org → DNS 레코드

추가해야 할 레코드:
Type:  CNAME
Name:  tools
Value: cname.vercel-dns.com
TTL:   3600
```

### Vercel에서도 확인
```
vercel.com → talenest-tools → Settings → Domains
→ tools.talenest.org가 ✅ Valid인지 확인
→ ❌ Invalid라면 Vercel이 제시하는 레코드로 업데이트
```

### 전파 확인
https://dnschecker.org/#CNAME/tools.talenest.org

---

## 📊 Phase 2 완성 후 도구 현황

| # | 경로 | 도구 | 상태 |
|---|------|------|------|
| 1 | /expense | Expense Bot | ✅ Live |
| 2 | /crm | Investor CRM | ✅ Live |
| 3 | /map-scraper | Google Maps Scraper | ✅ Live |
| 4 | /feedback | Feedback Hub | ✅ Live |
| 5 | /content | Content Vault + Factory | ✅ Live |
| 6 | /daily-brief | CEO Daily Brief | ✅ Live |
| 7 | /import | CSV Import | ✅ Live |
| 8 | /public-feedback | 공개 피드백 (QR) | ✅ Live |
| 9 | /monitor | Site Monitor | 🆕 Phase 2 |
| 10 | /legal | Legal Tracker | 🆕 Phase 2 |
| 11 | /social | Social Scheduler | 🆕 Phase 2 |

**총 11개 도구 완성!**

---

## 📋 Phase 3 예고 (다음 달)

- `/nurture` — Email Nurture Engine
- `/blog-writer` — AI 블로그 작성
- `/investor-update` — 투자자 레터 자동화
- CRM 제안서 생성

---
© 2026 TaleNest® LLC
