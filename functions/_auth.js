// functions/_auth.js
// Utilitaires JWT légers pour Cloudflare Workers (Web Crypto API)

const ALG = { name: 'HMAC', hash: 'SHA-256' };

async function getKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), ALG, false, ['sign', 'verify']);
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

export async function signJWT(payload, secret, expiresInSec = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify(header)));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const key = await getKey(secret);
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify(ALG, key, decodeB64url(sig), enc.encode(`${head}.${body}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeB64url(body)));
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

export async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return await verifyJWT(token, env.JWT_SECRET || 'default_dev_secret_change_me');
}
