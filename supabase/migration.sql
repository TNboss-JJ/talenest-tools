-- ============================================
-- TaleNest Expense Bot — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- 1. Expenses table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  vendor text not null,
  description text,
  amount numeric(12,2) not null,
  currency text default 'USD' check (currency in ('USD', 'KRW', 'EUR', 'GBP', 'JPY')),
  category text not null check (category in (
    'SaaS/구독', '클라우드/호스팅', '도메인/DNS', '디자인도구',
    '마케팅/광고', '법무/상표', '교통/출장', '사무용품',
    '식비/회의비', '교육/컨퍼런스', '기타'
  )),
  tax_deductible boolean default false,
  source_type text default 'card_statement' check (source_type in (
    'receipt_image', 'invoice_pdf', 'card_statement', 'email_confirmation', 'manual'
  )),
  source_file text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_expense_updated
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();

-- 3. Row Level Security (RLS) — 본인 데이터만 접근 가능
alter table public.expenses enable row level security;

create policy "Users can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id);

create policy "Users can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- 4. Indexes for fast queries
create index idx_expenses_user_date on public.expenses(user_id, date desc);
create index idx_expenses_category on public.expenses(user_id, category);

-- 5. Storage bucket for receipt files (original images, PDFs)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage RLS — 본인 폴더만 접근
create policy "Users can upload own receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Monthly summary view (optional, for dashboard)
create or replace view public.monthly_summary as
select
  user_id,
  date_trunc('month', date) as month,
  currency,
  category,
  count(*) as count,
  sum(amount) as total,
  sum(case when tax_deductible then amount else 0 end) as tax_deductible_total
from public.expenses
group by user_id, date_trunc('month', date), currency, category;
