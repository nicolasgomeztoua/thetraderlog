-- =============================================================================
-- 0016 — Prop Compliance Overhaul (2026 model)
-- Adds the expanded prop-firm rule model: drawdown 4-axis fields, daily-loss
-- variants, typed consistency, qualifying-day definition, payout-eligibility
-- fields, position/scaling, conduct/time rules, and the account_payout table.
--
-- Apply with:  bun run db:migrate:sql drizzle/0016_prop_compliance_overhaul.sql
-- The runner splits on the drizzle breakpoint marker and SKIPS duplicate-object,
-- duplicate-column and already-exists errors, so this is safe to re-run and to
-- apply to BOTH Neon branches (dev + prod — see memory neon-prod-dev-branches).
-- All columns are nullable so existing live/demo/CFD rows are unaffected.
-- =============================================================================
--> statement-breakpoint
CREATE TYPE "drawdown_anchor" AS ENUM ('static','trailing');--> statement-breakpoint
CREATE TYPE "drawdown_high_water_source" AS ENUM ('intraday_unrealized','eod_realized');--> statement-breakpoint
CREATE TYPE "drawdown_lock" AS ENUM ('none','at_start','at_start_plus_buffer');--> statement-breakpoint
CREATE TYPE "drawdown_basis" AS ENUM ('balance_realized','equity_unrealized');--> statement-breakpoint
CREATE TYPE "daily_loss_anchor" AS ENUM ('static_from_initial','from_day_start_balance');--> statement-breakpoint
CREATE TYPE "consistency_rule_type" AS ENUM ('off','best_day_pct_of_total','best_day_pct_of_target','per_trade_pct_of_total','top_days_ratio','best_day_pct_of_positive_days');--> statement-breakpoint
CREATE TYPE "consistency_window" AS ENUM ('full_evaluation','since_last_payout','fixed_cycle');--> statement-breakpoint
CREATE TYPE "consistency_comparator" AS ENUM ('lt','lte');--> statement-breakpoint
CREATE TYPE "consistency_phase" AS ENUM ('evaluation_only','funded_only','both');--> statement-breakpoint
CREATE TYPE "qualifying_day_mode" AS ENUM ('any_trade','any_positive','min_profit_abs','min_profit_pct');--> statement-breakpoint
CREATE TYPE "payout_cycle_type" AS ENUM ('winning_days','calendar_days','hours');--> statement-breakpoint
CREATE TYPE "buffer_type" AS ENUM ('none','start_plus_drawdown');--> statement-breakpoint
CREATE TYPE "scaling_basis" AS ENUM ('eod_balance','profit_from_start');--> statement-breakpoint
CREATE TYPE "scaling_applies_at" AS ENUM ('next_session','next_day','immediate');--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "prop_preset_id" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "drawdown_anchor" "drawdown_anchor";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "drawdown_high_water_source" "drawdown_high_water_source";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "drawdown_lock" "drawdown_lock";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "drawdown_lock_buffer" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "drawdown_basis" "drawdown_basis";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_drawdown_absolute" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "daily_loss_anchor" "daily_loss_anchor";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "daily_loss_basis" "drawdown_basis";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "daily_loss_fails_account" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "daily_loss_reset_time" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "daily_loss_timezone" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "profit_target_absolute" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "eval_max_days" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "qualifying_day_mode" "qualifying_day_mode";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "qualifying_day_min_profit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "day_boundary_timezone" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "day_reset_time" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "inactivity_limit_days" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "inactivity_limit_days_eval" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_rule_type" "consistency_rule_type";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_window" "consistency_window";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_comparator" "consistency_comparator";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_phase" "consistency_phase";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_expires_after_payouts" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "consistency_tiers" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "winning_day_threshold" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "winning_days_required" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "payout_cycle_type" "payout_cycle_type";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "payout_cycle_length" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "first_payout_wait_days" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "buffer_type" "buffer_type";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "payout_requires_buffer_cleared" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "min_withdrawal" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "first_payout_caps" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_lifetime_payouts" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "payout_consistency_pct" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "profit_split_tiers" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "lifetime_bonus_threshold" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "activation_fee" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_contracts" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "micro_to_mini_ratio" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_lots_fx" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_lots_metals_indices" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_open_positions" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_risk_per_trade_pct" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "stop_loss_required" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_margin_pct" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "scaling_plan" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "scaling_basis" "scaling_basis";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "scaling_applies_at" "scaling_applies_at";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "session_flat_enabled" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "session_flat_time" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "session_flat_timezone" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "weekend_holding_allowed" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "overnight_holding_allowed" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "min_hold_seconds" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "quick_strike_profit_pct" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "max_trades_per_day" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "news_blackout_enabled" boolean;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "news_blackout_minutes_before" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "news_blackout_minutes_after" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "prohibited_strategies_ack" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"requested_amount" numeric(14, 2),
	"paid_amount" numeric(14, 2),
	"split" numeric(6, 2),
	"cycle_index" integer,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "account_payout" ADD CONSTRAINT "account_payout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_payout" ADD CONSTRAINT "account_payout_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_payout_account_id_idx" ON "account_payout" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_payout_user_id_idx" ON "account_payout" ("user_id");
