// functions/api/image/[key].js

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  const key = decodeURIComponent(
    url.pathname.replace('/api/image/', '')
  );

  if (!key) {
    return new Response('Missing key', { status: 400 });
  }

  const object = await env.R2.get(key);

  if (!object) {
    return new Response('Image introuvable', { status: 404 });
  }

  const contentType =
    object.httpMetadata?.contentType || 'application/octet-stream';

  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.httpEtag,
    },
  });
}