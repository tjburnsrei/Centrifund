create table if not exists deal_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  log_type text not null,
  notes text not null default '',
  inputs_json jsonb not null,
  outputs_json jsonb not null,
  purchase_price numeric,
  rehab_budget numeric,
  estimated_arv numeric,
  requested_purchase_pct numeric,
  requested_construction_pct numeric,
  purchase_money_loan numeric,
  rehab_loan numeric,
  final_rate numeric,
  project_type text,
  tier text
);

create index if not exists deal_logs_created_at_idx
  on deal_logs (created_at desc);

create index if not exists deal_logs_log_type_idx
  on deal_logs (log_type);
