import {
  type Message,
  type InsertMessage,
  type Activity,
  type InsertActivity,
  messages,
  activities,
} from "@/shared/schema";
import { db } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

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
  async getMessages(
    userId: string,
    options?: { limit?: number }
  ): Promise<Message[]> {
    return db.query.messages
      .findMany({
        where: eq(messages.user_id, userId),
        orderBy: [desc(messages.timestamp)],
        limit: options?.limit,
      })
      .then((msgs) => msgs.reverse());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    return (await db.insert(messages).values(message).returning())[0];
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
