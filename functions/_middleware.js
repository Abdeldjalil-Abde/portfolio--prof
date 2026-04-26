// functions/_middleware.js
// Middleware global : CORS + gestion erreurs

export async function onRequest(context) {
  const { request, next } = context;

  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const response = await next();
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
