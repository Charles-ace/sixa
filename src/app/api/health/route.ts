import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ ok: true, service: 'sixa', time: new Date().toISOString() });
}