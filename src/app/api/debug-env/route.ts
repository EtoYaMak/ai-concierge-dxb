import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    // We don't expose the actual value for security
    hasDbUrl: !!process.env.DATABASE_URL,
    envKeys: Object.keys(process.env).filter((key) => !key.includes("SECRET")),
    nodeEnv: process.env.NODE_ENV,
  });
}
