-- Prefixed UUID Migration
-- Migrates all integer IDs to prefixed text IDs (e.g., tr-abc123...)
-- This migration is complex due to FK dependencies

-- Helper function to generate prefixed IDs (16 char nanoid-style)
CREATE OR REPLACE FUNCTION generate_prefixed_id(prefix text) RETURNS text AS $$
DECLARE
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := prefix || '-';
  i integer;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: Add new text ID columns to all tables
-- ============================================================================

-- Users
ALTER TABLE "user" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "user" SET "id_new" = generate_prefixed_id('us') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint

-- Account Groups
ALTER TABLE "account_group" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "account_group" SET "id_new" = generate_prefixed_id('ag') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "account_group" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account_group" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- Accounts
ALTER TABLE "account" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "account" SET "id_new" = generate_prefixed_id('ac') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "user_id_new" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "linked_account_id_new" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "group_id_new" text;--> statement-breakpoint

-- Trades
ALTER TABLE "trade" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "trade" SET "id_new" = generate_prefixed_id('tr') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "user_id_new" text;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "account_id_new" text;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "strategy_id_new" text;--> statement-breakpoint

-- Trade Executions
ALTER TABLE "trade_execution" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "trade_execution" SET "id_new" = generate_prefixed_id('ex') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "trade_execution" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD COLUMN "trade_id_new" text;--> statement-breakpoint

-- Tags
ALTER TABLE "tag" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "tag" SET "id_new" = generate_prefixed_id('tg') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- Trade Tags (junction table)
ALTER TABLE "trade_tag" ADD COLUMN "trade_id_new" text;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD COLUMN "tag_id_new" text;--> statement-breakpoint

-- Trade Screenshots
ALTER TABLE "trade_screenshot" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "trade_screenshot" SET "id_new" = generate_prefixed_id('ss') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ADD COLUMN "trade_id_new" text;--> statement-breakpoint

-- User Settings
ALTER TABLE "user_settings" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "user_settings" SET "id_new" = generate_prefixed_id('st') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- Filter Presets
ALTER TABLE "filter_preset" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "filter_preset" SET "id_new" = generate_prefixed_id('fp') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "filter_preset" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_preset" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- AI Conversations
ALTER TABLE "ai_conversation" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "ai_conversation" SET "id_new" = generate_prefixed_id('cv') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_conversation" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- AI Messages
ALTER TABLE "ai_message" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "ai_message" SET "id_new" = generate_prefixed_id('mg') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_message" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_message" ADD COLUMN "conversation_id_new" text;--> statement-breakpoint

-- Strategies
ALTER TABLE "strategy" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "strategy" SET "id_new" = generate_prefixed_id('sy') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "strategy" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy" ADD COLUMN "user_id_new" text;--> statement-breakpoint

-- Strategy Rules
ALTER TABLE "strategy_rule" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "strategy_rule" SET "id_new" = generate_prefixed_id('sr') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "strategy_rule" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "strategy_id_new" text;--> statement-breakpoint

-- Trade Rule Checks (junction table)
ALTER TABLE "trade_rule_check" ADD COLUMN "trade_id_new" text;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ADD COLUMN "rule_id_new" text;--> statement-breakpoint

-- Candle Cache
ALTER TABLE "candle_cache" ADD COLUMN "id_new" text;--> statement-breakpoint
UPDATE "candle_cache" SET "id_new" = generate_prefixed_id('cc') WHERE "id_new" IS NULL;--> statement-breakpoint
ALTER TABLE "candle_cache" ALTER COLUMN "id_new" SET NOT NULL;--> statement-breakpoint

-- ============================================================================
-- STEP 2: Populate FK references using JOINs
-- ============================================================================

-- Account Groups -> Users
UPDATE "account_group" ag SET "user_id_new" = u."id_new" FROM "user" u WHERE ag."user_id" = u."id";--> statement-breakpoint

-- Accounts -> Users
UPDATE "account" a SET "user_id_new" = u."id_new" FROM "user" u WHERE a."user_id" = u."id";--> statement-breakpoint

-- Accounts -> Account Groups
UPDATE "account" a SET "group_id_new" = ag."id_new" FROM "account_group" ag WHERE a."group_id" = ag."id";--> statement-breakpoint

-- Accounts -> Accounts (self-reference for linked accounts)
UPDATE "account" a SET "linked_account_id_new" = a2."id_new" FROM "account" a2 WHERE a."linked_account_id" = a2."id";--> statement-breakpoint

-- Trades -> Users
UPDATE "trade" t SET "user_id_new" = u."id_new" FROM "user" u WHERE t."user_id" = u."id";--> statement-breakpoint

-- Trades -> Accounts
UPDATE "trade" t SET "account_id_new" = a."id_new" FROM "account" a WHERE t."account_id" = a."id";--> statement-breakpoint

-- Trades -> Strategies
UPDATE "trade" t SET "strategy_id_new" = s."id_new" FROM "strategy" s WHERE t."strategy_id" = s."id";--> statement-breakpoint

-- Trade Executions -> Trades
UPDATE "trade_execution" te SET "trade_id_new" = t."id_new" FROM "trade" t WHERE te."trade_id" = t."id";--> statement-breakpoint

-- Tags -> Users
UPDATE "tag" tg SET "user_id_new" = u."id_new" FROM "user" u WHERE tg."user_id" = u."id";--> statement-breakpoint

-- Trade Tags -> Trades
UPDATE "trade_tag" tt SET "trade_id_new" = t."id_new" FROM "trade" t WHERE tt."trade_id" = t."id";--> statement-breakpoint

-- Trade Tags -> Tags
UPDATE "trade_tag" tt SET "tag_id_new" = tg."id_new" FROM "tag" tg WHERE tt."tag_id" = tg."id";--> statement-breakpoint

-- Trade Screenshots -> Trades
UPDATE "trade_screenshot" ts SET "trade_id_new" = t."id_new" FROM "trade" t WHERE ts."trade_id" = t."id";--> statement-breakpoint

-- User Settings -> Users
UPDATE "user_settings" us SET "user_id_new" = u."id_new" FROM "user" u WHERE us."user_id" = u."id";--> statement-breakpoint

-- Filter Presets -> Users
UPDATE "filter_preset" fp SET "user_id_new" = u."id_new" FROM "user" u WHERE fp."user_id" = u."id";--> statement-breakpoint

-- AI Conversations -> Users
UPDATE "ai_conversation" ac SET "user_id_new" = u."id_new" FROM "user" u WHERE ac."user_id" = u."id";--> statement-breakpoint

-- AI Messages -> AI Conversations
UPDATE "ai_message" am SET "conversation_id_new" = ac."id_new" FROM "ai_conversation" ac WHERE am."conversation_id" = ac."id";--> statement-breakpoint

-- Strategies -> Users
UPDATE "strategy" s SET "user_id_new" = u."id_new" FROM "user" u WHERE s."user_id" = u."id";--> statement-breakpoint

-- Strategy Rules -> Strategies
UPDATE "strategy_rule" sr SET "strategy_id_new" = s."id_new" FROM "strategy" s WHERE sr."strategy_id" = s."id";--> statement-breakpoint

-- Trade Rule Checks -> Trades
UPDATE "trade_rule_check" trc SET "trade_id_new" = t."id_new" FROM "trade" t WHERE trc."trade_id" = t."id";--> statement-breakpoint

-- Trade Rule Checks -> Strategy Rules
UPDATE "trade_rule_check" trc SET "rule_id_new" = sr."id_new" FROM "strategy_rule" sr WHERE trc."rule_id" = sr."id";--> statement-breakpoint

-- ============================================================================
-- STEP 3: Drop old FK constraints
-- ============================================================================

-- Account Groups
ALTER TABLE "account_group" DROP CONSTRAINT IF EXISTS "account_group_user_id_user_id_fk";--> statement-breakpoint

-- Accounts
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_group_id_account_group_id_fk";--> statement-breakpoint

-- Trades
ALTER TABLE "trade" DROP CONSTRAINT IF EXISTS "trade_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "trade" DROP CONSTRAINT IF EXISTS "trade_account_id_account_id_fk";--> statement-breakpoint

-- Trade Executions
ALTER TABLE "trade_execution" DROP CONSTRAINT IF EXISTS "trade_execution_trade_id_trade_id_fk";--> statement-breakpoint

-- Tags
ALTER TABLE "tag" DROP CONSTRAINT IF EXISTS "tag_user_id_user_id_fk";--> statement-breakpoint

-- Trade Tags
ALTER TABLE "trade_tag" DROP CONSTRAINT IF EXISTS "trade_tag_trade_id_trade_id_fk";--> statement-breakpoint
ALTER TABLE "trade_tag" DROP CONSTRAINT IF EXISTS "trade_tag_tag_id_tag_id_fk";--> statement-breakpoint
ALTER TABLE "trade_tag" DROP CONSTRAINT IF EXISTS "trade_tag_trade_id_tag_id_pk";--> statement-breakpoint

-- Trade Screenshots
ALTER TABLE "trade_screenshot" DROP CONSTRAINT IF EXISTS "trade_screenshot_trade_id_trade_id_fk";--> statement-breakpoint

-- User Settings
ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_user_id_user_id_fk";--> statement-breakpoint

-- Filter Presets
ALTER TABLE "filter_preset" DROP CONSTRAINT IF EXISTS "filter_preset_user_id_user_id_fk";--> statement-breakpoint

-- AI Conversations
ALTER TABLE "ai_conversation" DROP CONSTRAINT IF EXISTS "ai_conversation_user_id_user_id_fk";--> statement-breakpoint

-- AI Messages
ALTER TABLE "ai_message" DROP CONSTRAINT IF EXISTS "ai_message_conversation_id_ai_conversation_id_fk";--> statement-breakpoint

-- Strategies
ALTER TABLE "strategy" DROP CONSTRAINT IF EXISTS "strategy_user_id_user_id_fk";--> statement-breakpoint

-- Strategy Rules
ALTER TABLE "strategy_rule" DROP CONSTRAINT IF EXISTS "strategy_rule_strategy_id_strategy_id_fk";--> statement-breakpoint

-- Trade Rule Checks
ALTER TABLE "trade_rule_check" DROP CONSTRAINT IF EXISTS "trade_rule_check_trade_id_trade_id_fk";--> statement-breakpoint
ALTER TABLE "trade_rule_check" DROP CONSTRAINT IF EXISTS "trade_rule_check_rule_id_strategy_rule_id_fk";--> statement-breakpoint
ALTER TABLE "trade_rule_check" DROP CONSTRAINT IF EXISTS "trade_rule_check_trade_id_rule_id_pk";--> statement-breakpoint

-- ============================================================================
-- STEP 4: Drop old indexes
-- ============================================================================

DROP INDEX IF EXISTS "user_clerk_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "account_group_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "account_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "account_is_default_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "account_group_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "account_linked_account_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_account_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_strategy_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_symbol_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_entry_time_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_deleted_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "execution_trade_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tag_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_tag_trade_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_tag_tag_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "screenshot_trade_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "filter_preset_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "conversation_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "message_conversation_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "strategy_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "strategy_is_active_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "strategy_rule_strategy_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "strategy_rule_category_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_rule_check_trade_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "trade_rule_check_rule_id_idx";--> statement-breakpoint

-- ============================================================================
-- STEP 5: Drop old PK constraints and columns, rename new columns
-- ============================================================================

-- Users
ALTER TABLE "user" DROP CONSTRAINT "user_pkey";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Account Groups
ALTER TABLE "account_group" DROP CONSTRAINT "account_group_pkey";--> statement-breakpoint
ALTER TABLE "account_group" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "account_group" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "account_group" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "account_group" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "account_group" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account_group" ADD CONSTRAINT "account_group_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Accounts
ALTER TABLE "account" DROP CONSTRAINT "account_pkey";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "linked_account_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "linked_account_id_new" TO "linked_account_id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "group_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "group_id_new" TO "group_id";--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Trades
ALTER TABLE "trade" DROP CONSTRAINT "trade_pkey";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "trade" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "trade" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "account_id";--> statement-breakpoint
ALTER TABLE "trade" RENAME COLUMN "account_id_new" TO "account_id";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "strategy_id";--> statement-breakpoint
ALTER TABLE "trade" RENAME COLUMN "strategy_id_new" TO "strategy_id";--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Trade Executions
ALTER TABLE "trade_execution" DROP CONSTRAINT "trade_execution_pkey";--> statement-breakpoint
ALTER TABLE "trade_execution" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "trade_execution" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "trade_execution" DROP COLUMN "trade_id";--> statement-breakpoint
ALTER TABLE "trade_execution" RENAME COLUMN "trade_id_new" TO "trade_id";--> statement-breakpoint
ALTER TABLE "trade_execution" ALTER COLUMN "trade_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Tags
ALTER TABLE "tag" DROP CONSTRAINT "tag_pkey";--> statement-breakpoint
ALTER TABLE "tag" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "tag" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "tag" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "tag" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Trade Tags
ALTER TABLE "trade_tag" DROP COLUMN "trade_id";--> statement-breakpoint
ALTER TABLE "trade_tag" RENAME COLUMN "trade_id_new" TO "trade_id";--> statement-breakpoint
ALTER TABLE "trade_tag" ALTER COLUMN "trade_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_tag" DROP COLUMN "tag_id";--> statement-breakpoint
ALTER TABLE "trade_tag" RENAME COLUMN "tag_id_new" TO "tag_id";--> statement-breakpoint
ALTER TABLE "trade_tag" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_trade_id_tag_id_pk" PRIMARY KEY ("trade_id", "tag_id");--> statement-breakpoint

-- Trade Screenshots
ALTER TABLE "trade_screenshot" DROP CONSTRAINT "trade_screenshot_pkey";--> statement-breakpoint
ALTER TABLE "trade_screenshot" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "trade_screenshot" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "trade_screenshot" DROP COLUMN "trade_id";--> statement-breakpoint
ALTER TABLE "trade_screenshot" RENAME COLUMN "trade_id_new" TO "trade_id";--> statement-breakpoint
ALTER TABLE "trade_screenshot" ALTER COLUMN "trade_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ADD CONSTRAINT "trade_screenshot_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- User Settings
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_pkey";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "user_settings" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "user_settings" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Filter Presets
ALTER TABLE "filter_preset" DROP CONSTRAINT "filter_preset_pkey";--> statement-breakpoint
ALTER TABLE "filter_preset" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "filter_preset" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "filter_preset" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "filter_preset" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "filter_preset" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_preset" ADD CONSTRAINT "filter_preset_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- AI Conversations
ALTER TABLE "ai_conversation" DROP CONSTRAINT "ai_conversation_pkey";--> statement-breakpoint
ALTER TABLE "ai_conversation" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "ai_conversation" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "ai_conversation" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "ai_conversation" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "ai_conversation" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- AI Messages
ALTER TABLE "ai_message" DROP CONSTRAINT "ai_message_pkey";--> statement-breakpoint
ALTER TABLE "ai_message" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "ai_message" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "ai_message" DROP COLUMN "conversation_id";--> statement-breakpoint
ALTER TABLE "ai_message" RENAME COLUMN "conversation_id_new" TO "conversation_id";--> statement-breakpoint
ALTER TABLE "ai_message" ALTER COLUMN "conversation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Strategies
ALTER TABLE "strategy" DROP CONSTRAINT "strategy_pkey";--> statement-breakpoint
ALTER TABLE "strategy" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "strategy" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "strategy" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "strategy" RENAME COLUMN "user_id_new" TO "user_id";--> statement-breakpoint
ALTER TABLE "strategy" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy" ADD CONSTRAINT "strategy_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Strategy Rules
ALTER TABLE "strategy_rule" DROP CONSTRAINT "strategy_rule_pkey";--> statement-breakpoint
ALTER TABLE "strategy_rule" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "strategy_rule" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "strategy_rule" DROP COLUMN "strategy_id";--> statement-breakpoint
ALTER TABLE "strategy_rule" RENAME COLUMN "strategy_id_new" TO "strategy_id";--> statement-breakpoint
ALTER TABLE "strategy_rule" ALTER COLUMN "strategy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD CONSTRAINT "strategy_rule_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- Trade Rule Checks
ALTER TABLE "trade_rule_check" DROP COLUMN "trade_id";--> statement-breakpoint
ALTER TABLE "trade_rule_check" RENAME COLUMN "trade_id_new" TO "trade_id";--> statement-breakpoint
ALTER TABLE "trade_rule_check" ALTER COLUMN "trade_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_rule_check" DROP COLUMN "rule_id";--> statement-breakpoint
ALTER TABLE "trade_rule_check" RENAME COLUMN "rule_id_new" TO "rule_id";--> statement-breakpoint
ALTER TABLE "trade_rule_check" ALTER COLUMN "rule_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ADD CONSTRAINT "trade_rule_check_trade_id_rule_id_pk" PRIMARY KEY ("trade_id", "rule_id");--> statement-breakpoint

-- Candle Cache
ALTER TABLE "candle_cache" DROP CONSTRAINT "candle_cache_pkey";--> statement-breakpoint
ALTER TABLE "candle_cache" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "candle_cache" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
ALTER TABLE "candle_cache" ADD CONSTRAINT "candle_cache_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- ============================================================================
-- STEP 6: Recreate FK constraints
-- ============================================================================

-- Account Groups -> Users
ALTER TABLE "account_group" ADD CONSTRAINT "account_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Accounts -> Users
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Accounts -> Account Groups
ALTER TABLE "account" ADD CONSTRAINT "account_group_id_account_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "account_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint

-- Trades -> Users
ALTER TABLE "trade" ADD CONSTRAINT "trade_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trades -> Accounts
ALTER TABLE "trade" ADD CONSTRAINT "trade_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Executions -> Trades
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Tags -> Users
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Tags -> Trades
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Tags -> Tags
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Screenshots -> Trades
ALTER TABLE "trade_screenshot" ADD CONSTRAINT "trade_screenshot_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- User Settings -> Users
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Filter Presets -> Users
ALTER TABLE "filter_preset" ADD CONSTRAINT "filter_preset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- AI Conversations -> Users
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- AI Messages -> AI Conversations
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_conversation_id_ai_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Strategies -> Users
ALTER TABLE "strategy" ADD CONSTRAINT "strategy_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Strategy Rules -> Strategies
ALTER TABLE "strategy_rule" ADD CONSTRAINT "strategy_rule_strategy_id_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "strategy"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Rule Checks -> Trades
ALTER TABLE "trade_rule_check" ADD CONSTRAINT "trade_rule_check_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- Trade Rule Checks -> Strategy Rules
ALTER TABLE "trade_rule_check" ADD CONSTRAINT "trade_rule_check_rule_id_strategy_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "strategy_rule"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint

-- ============================================================================
-- STEP 7: Recreate indexes
-- ============================================================================

CREATE INDEX "user_clerk_id_idx" ON "user" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "account_group_user_id_idx" ON "account_group" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_is_default_idx" ON "account" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "account_group_id_idx" ON "account" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "account_linked_account_id_idx" ON "account" USING btree ("linked_account_id");--> statement-breakpoint
CREATE INDEX "trade_user_id_idx" ON "trade" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_account_id_idx" ON "trade" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "trade_strategy_id_idx" ON "trade" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "trade_symbol_idx" ON "trade" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trade_entry_time_idx" ON "trade" USING btree ("entry_time");--> statement-breakpoint
CREATE INDEX "trade_status_idx" ON "trade" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trade_deleted_at_idx" ON "trade" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "execution_trade_id_idx" ON "trade_execution" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "tag_user_id_idx" ON "tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_tag_trade_id_idx" ON "trade_tag" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_tag_tag_id_idx" ON "trade_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "screenshot_trade_id_idx" ON "trade_screenshot" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "filter_preset_user_id_idx" ON "filter_preset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_user_id_idx" ON "ai_conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_conversation_id_idx" ON "ai_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "strategy_user_id_idx" ON "strategy" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategy_is_active_idx" ON "strategy" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "strategy_rule_strategy_id_idx" ON "strategy_rule" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_rule_category_idx" ON "strategy_rule" USING btree ("category");--> statement-breakpoint
CREATE INDEX "trade_rule_check_trade_id_idx" ON "trade_rule_check" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_rule_check_rule_id_idx" ON "trade_rule_check" USING btree ("rule_id");--> statement-breakpoint

-- ============================================================================
-- STEP 8: Re-add unique constraints
-- ============================================================================

ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_unique" UNIQUE ("user_id");--> statement-breakpoint

-- ============================================================================
-- STEP 9: Cleanup - drop helper function
-- ============================================================================

DROP FUNCTION IF EXISTS generate_prefixed_id(text);

