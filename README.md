# TaleNest ExpenseBot

AI 기반 지출 관리 도구. 영수증 이미지를 올리면 Claude가 자동으로 분석해서 Supabase에 저장합니다.

## 아키텍처

```
[브라우저] → [Next.js 15 App Router]
                ├─ /login        → Magic Link 인증 (본인 이메일만)
                ├─ /expense      → 메인 대시보드
                ├─ /api/expenses → CRUD (Supabase DB)
                └─ /api/parse    → Claude AI 분석 (서버사이드)
                       ↓
               [Supabase]
               ├─ Auth (매직 링크)
               ├─ PostgreSQL (expenses 테이블, RLS)
               └─ Storage (원본 영수증 파일)
```

## 셋업 가이드 (10분)

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 가입 → New Project
2. Dashboard → SQL Editor → `supabase/migration.sql` 내용 전체 붙여넣고 Run
3. Dashboard → Settings → API 에서 `URL`과 `anon key` 복사

### 2. 인증 설정

1. Dashboard → Authentication → Settings
2. Site URL: `https://tools.talenest.org` (또는 개발 시 `http://localhost:3000`)
3. Redirect URLs에 추가:
   - `https://tools.talenest.org/auth/callback`
   - `http://localhost:3000/auth/callback`

### 3. 환경 변수

```bash
cp .env.example .env.local
```

`.env.local` 수정:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_EMAIL=your@email.com    ← 본인 이메일
```

### 4. 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

### 5. Vercel 배포

```bash
npx vercel
```

Vercel 대시보드에서:
- Environment Variables에 위 4개 추가
- Custom Domain: `tools.talenest.org` 연결
- talenest.org DNS에 CNAME `tools → cname.vercel-dns.com` 추가

## 파일 구조

```
├── app/
│   ├── layout.js              # 루트 레이아웃
│   ├── page.js                # / → /expense 리다이렉트
│   ├── login/page.js          # 로그인 (매직 링크)
│   ├── auth/callback/route.js # 인증 콜백
│   ├── expense/page.js        # 메인 대시보드 UI
│   └── api/
│       ├── expenses/route.js  # GET/POST/PATCH/DELETE
│       └── parse/route.js     # Claude AI 파싱 → DB 저장
├── lib/
│   ├── supabase-browser.js    # 클라이언트 Supabase
│   ├── supabase-server.js     # 서버 Supabase
│   └── use-expenses.js        # React hook (CRUD + AI 파싱)
├── middleware.js               # 인증 + 이메일 제한
└── supabase/
    └── migration.sql          # DB 스키마 + RLS 정책
```

## 보안

- **RLS (Row Level Security)**: 모든 DB 쿼리에 `user_id = auth.uid()` 강제
- **Middleware**: 로그인 안 하면 어떤 페이지도 접근 불가
- **이메일 제한**: `ALLOWED_EMAIL` 외 다른 이메일은 로그인 불가
- **API Key**: Claude API 키는 서버 사이드에서만 사용 (브라우저 노출 없음)
- **Storage RLS**: 본인 폴더만 업로드/조회 가능

## 나중에 추가할 것

- [ ] 월별 자동 리포트 (Supabase Edge Function + Cron)
- [ ] 파일 업로드 → Supabase Storage 저장
- [ ] 대시보드 차트 (recharts)
- [ ] 다른 도구 라우트 추가 (/content, /crm, /tasks...)
