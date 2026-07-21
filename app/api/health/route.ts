import { NextResponse } from 'next/server';

const startTime = Date.now();

/**
 * Health Check Endpoint
 * Used by Railway (and other platforms) to verify the container is alive.
 * Returns basic server status, uptime, and environment info.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'kpmg-trustlens',
    version: '1.0.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}
