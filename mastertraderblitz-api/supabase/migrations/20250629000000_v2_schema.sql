-- MasterTraderBlitz V2 schema

create extension if not exists "pgcrypto";

create table if not exists ai_settings (
  id uuid primary key default gen_random_uuid(),
  openrouter_model text not null default 'google/gemini-2.0-flash-001',
  confidence_threshold int not null default 70 check (confidence_threshold between 0 and 100),
  auto_trade_threshold int not null default 85 check (auto_trade_threshold between 0 and 100),
  max_loss_streak int not null default 5 check (max_loss_streak between 1 and 50),
  cooldown_between_trades_sec int not null default 5 check (cooldown_between_trades_sec between 0 and 300),
  allowed_assets text[] not null default '{}',
  allowed_expiry int[] not null default '{5,10,15,30}',
  updated_at timestamptz not null default now()
);

insert into ai_settings (id)
select gen_random_uuid()
where not exists (select 1 from ai_settings limit 1);

create table if not exists strategy_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  profile_id text not null,
  expiry_sec int not null check (expiry_sec in (5, 10, 15, 30)),
  preset_config jsonb not null default '{}',
  progression_levels jsonb not null default '[]',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_history (
  id uuid primary key default gen_random_uuid(),
  asset text not null,
  timestamp timestamptz not null default now(),
  expiry int not null check (expiry in (5, 10, 15, 30)),
  indicators jsonb not null,
  ai_decision text not null check (ai_decision in ('BUY', 'SELL', 'WAIT')),
  confidence int not null default 0 check (confidence between 0 and 100),
  reasoning jsonb not null default '[]',
  risks jsonb not null default '[]',
  result text check (result in ('win', 'loss')),
  pnl numeric,
  streak int,
  direction text check (direction in ('HIGHER', 'LOWER')),
  mode text not null default 'ai' check (mode in ('legacy', 'ai')),
  strategy_id uuid references strategy_templates(id) on delete set null,
  external_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists trade_history_timestamp_idx on trade_history (timestamp desc);
create index if not exists trade_history_asset_idx on trade_history (asset);

create table if not exists ai_decisions (
  id uuid primary key default gen_random_uuid(),
  asset text not null,
  timestamp timestamptz not null default now(),
  expiry int not null check (expiry in (5, 10, 15, 30)),
  snapshot jsonb not null,
  decision text not null check (decision in ('BUY', 'SELL', 'WAIT')),
  confidence int not null default 0 check (confidence between 0 and 100),
  reasoning jsonb not null default '[]',
  risks jsonb not null default '[]',
  supporting_indicators jsonb not null default '[]',
  trade_id uuid references trade_history(id) on delete set null,
  result text check (result in ('win', 'loss')),
  created_at timestamptz not null default now()
);

create index if not exists ai_decisions_timestamp_idx on ai_decisions (timestamp desc);

create table if not exists indicator_performance (
  id uuid primary key default gen_random_uuid(),
  dimension text not null,
  segment text not null,
  wins int not null default 0,
  losses int not null default 0,
  win_rate numeric not null default 0,
  sample_size int not null default 0,
  updated_at timestamptz not null default now(),
  unique (dimension, segment)
);

create index if not exists indicator_performance_dimension_idx on indicator_performance (dimension);

-- Seed AD strategy templates
insert into strategy_templates (name, profile_id, expiry_sec, preset_config, progression_levels, is_default)
values
  ('AD50', 'AD50', 5, '{"tradeExpirySec":5}', '[50,183,528,1440,3850,10078,26477,70205,187186,501021]', true),
  ('AD100', 'AD100', 5, '{"tradeExpirySec":5}', '[100,366,1056,2880,7699,20155,52954,140410,374371,1002044]', true),
  ('AD200', 'AD200', 5, '{"tradeExpirySec":5}', '[200,732,2112,5760,15398,40310,105907,280820,748743,2004088]', true),
  ('AD300', 'AD300', 5, '{"tradeExpirySec":5}', '[300,1098,3168,8640,23097,60465,158861,421230,1123114,3006132]', true),
  ('AD500', 'AD500', 5, '{"tradeExpirySec":5}', '[500,1830,5280,14400,38495,100775,264768,702050,1871857,5010220]', true),
  ('AD1000', 'AD1000', 5, '{"tradeExpirySec":5}', '[1000,3660,10560,28800,76990,201550,529536,1404099,3743714,10020439]', true)
on conflict (name) do nothing;
