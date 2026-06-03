import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = '/api/' + path.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${BACKEND_URL}${pathname}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = '/api/' + path.join('/');
  const url = `${BACKEND_URL}${pathname}`;

  const body = await request.text();
  console.log(`[API Proxy] POST ${pathname} -> ${url}`, body.substring(0, 100));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await response.json();
    console.log(`[API Proxy] Response status: ${response.status}`);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json({ success: false, message: '代理请求失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = '/api/' + path.join('/');
  const url = `${BACKEND_URL}${pathname}`;

  const body = await request.text();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = '/api/' + path.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${BACKEND_URL}${pathname}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}