import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  user_id: text("user_id").notNull(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  originalId: text("original_id"),
  name: text("name").notNull(),
  slug: text("slug"),
  address: text("address"),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  description: text("description"),
  information: text("information"),
  timing: text("timing_content"),
  pricing: text("pricing_content"),
  booking_type: text("booking_type"),
  redirect_url: text("redirect_url"),
  embeddings: jsonb("embeddings").$type<number[]>(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  role: true,
  user_id: true,
});

export const insertActivitySchema = createInsertSchema(activities)
  .omit({
    id: true,
  })
  .extend({
    originalId: z.string().optional(),
  });

export type Message = typeof messages.$inferSelect & {
  isStreaming?: boolean;
};

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
