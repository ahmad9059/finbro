DROP INDEX "expense_user_date_idx";--> statement-breakpoint
DROP INDEX "subscription_user_status_idx";--> statement-breakpoint
CREATE INDEX "expense_user_date_id_idx" ON "expense" USING btree ("user_id","date","id");--> statement-breakpoint
CREATE INDEX "expense_category_idx" ON "expense" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expense_subscription_idx" ON "expense" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_user_status_due_idx" ON "subscription" USING btree ("user_id","status","next_due_date");--> statement-breakpoint
CREATE INDEX "subscription_category_idx" ON "subscription" USING btree ("category_id");