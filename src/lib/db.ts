import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/shared/schema";

// Provide a more helpful error message
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("Make sure you have a .env.local file with DATABASE_URL");
}

// Configure Neon
// @ts-ignore - fetchOptions may not be in type definitions but works at runtime
neonConfig.fetchOptions = {
  cache: "no-store",
};

// Use a fallback connection string for development
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "development"
    ? "postgres://placeholder" // This will fail, but with a clearer error
    : "");

// Create SQL client
const sql = neon(connectionString);

// Use the sql with drizzle
export const db = drizzle(sql, { schema });
