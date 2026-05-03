create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  cache_key text,
  brand_name text,
  product_name text,
  target_query text,
  report jsonb not null
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_brand_name_idx on public.reports (brand_name);
create index if not exists reports_cache_key_created_at_idx on public.reports (cache_key, created_at desc);

alter table public.reports enable row level security;

-- Public users never write directly to Supabase from the browser.
-- The Vercel serverless API uses SUPABASE_SERVICE_ROLE_KEY to insert and read reports.
