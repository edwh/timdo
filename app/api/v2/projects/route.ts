import { NextResponse } from 'next/server';
import { getWorkerApiBaseUrl } from '../../../lib/apiConfig';
import { auth } from '../../../lib/auth';

export const runtime = 'edge';

async function proxyRequest(path: string, init: RequestInit): Promise<NextResponse> {
  const response = await fetch(`${getWorkerApiBaseUrl()}${path}`, init);
  const text = await response.text();
  const contentType = response.headers.get('content-type');

  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let payload: unknown = { error: 'Worker request failed' };
    if (isJson && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }
    } else if (text) {
      payload = { error: text };
    }

    return NextResponse.json(payload, { status: response.status });
  }

  if (isJson) {
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return NextResponse.json(json, { status: response.status });
  }

  return new NextResponse(text, {
    status: response.status,
    headers: contentType ? { 'content-type': contentType } : undefined,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return proxyRequest('/projects', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.text();

  return proxyRequest('/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });
}
