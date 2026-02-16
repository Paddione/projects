import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memoryUsage = process.memoryUsage();

  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'shop',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: { status: 'healthy', responseTime },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'shop',
      database: { status: 'unhealthy', responseTime: 0 },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
