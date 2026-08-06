import { getCorsHeaders } from './cors.ts';

export function jsonResponse(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { error: true, message, ...(code ? { code } : {}) }, status);
}
