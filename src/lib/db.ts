import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/shared/schema";

// Check for DATABASE_URL only in production
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set in production environment");
  // Don't throw error immediately to allow initialization
}

// Try to create SQL with fallback for development
const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : neon("postgresql://postgres:postgres@localhost:5432/dubai_ai"); // Fallback for development

// Create a Drizzle ORM instance
export const db = drizzle(sql, { schema });
