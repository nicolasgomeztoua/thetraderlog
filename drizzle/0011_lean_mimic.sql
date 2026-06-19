CREATE TYPE "public"."attachment_entity_type" AS ENUM('journal', 'trade', 'strategy');--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" "attachment_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"embedded_context" text,
	"caption" text,
	"is_orphaned" boolean DEFAULT false,
	"orphaned_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_user_id_idx" ON "attachment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attachment_entity_idx" ON "attachment" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachment_orphaned_idx" ON "attachment" USING btree ("is_orphaned") WHERE is_orphaned = true;--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_key_idx" ON "attachment" USING btree ("key");