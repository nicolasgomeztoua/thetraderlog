ALTER TABLE "filter_preset" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "filter_preset" ADD COLUMN "is_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "filter_preset" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "filter_preset_is_default_idx" ON "filter_preset" USING btree ("is_default");