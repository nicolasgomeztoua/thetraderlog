ALTER TABLE "daily_checklist_check" DROP CONSTRAINT "daily_checklist_check_journal_id_template_id_pk";--> statement-breakpoint
ALTER TABLE "daily_checklist_check" ALTER COLUMN "template_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_checklist_check" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_checklist_check" ADD COLUMN "forced_item_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklist_check_journal_template_idx" ON "daily_checklist_check" USING btree ("journal_id","template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklist_check_journal_forced_idx" ON "daily_checklist_check" USING btree ("journal_id","forced_item_id");