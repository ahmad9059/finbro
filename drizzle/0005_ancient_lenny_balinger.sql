CREATE TABLE "assistant_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"model" text DEFAULT 'claude-sonnet-4-5' NOT NULL,
	"api_key_encrypted" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;