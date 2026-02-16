import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
