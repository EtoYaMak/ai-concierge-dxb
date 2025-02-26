import {
  type Message,
  type InsertMessage,
  type Activity,
  type InsertActivity,
  messages,
  activities,
} from "@/shared/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getMessages(userId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getActivities(): Promise<Activity[]>;
  createActivity(
    data: InsertActivity & { embeddings: number[] }
  ): Promise<Activity>;
  createManyActivities(
    data: (InsertActivity & { embeddings: number[] })[]
  ): Promise<Activity[]>;
}

export class DatabaseStorage implements IStorage {
  async getMessages(userId: string): Promise<Message[]> {
    // Make sure we're referencing the correct column name from schema
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.user_id, userId))
      .orderBy(messages.timestamp);

    return result;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getActivities(): Promise<Activity[]> {
    return await db.select().from(activities);
  }

  async createActivity(
    data: InsertActivity & { embeddings: number[] }
  ): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(data).returning();
    return newActivity;
  }

  async createManyActivities(
    data: (InsertActivity & { embeddings: number[] })[]
  ): Promise<Activity[]> {
    return await db.insert(activities).values(data).returning();
  }
}

export const storage = new DatabaseStorage();
