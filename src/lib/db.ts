import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Create a SQL query executor
const sql = neon(process.env.DATABASE_URL!);

// Create a Drizzle ORM instance
export const db = drizzle(sql, { schema });
