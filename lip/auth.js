// lib/auth.js — JWT via Web Crypto API (compatible Vercel Node.js runtime)

const ALG = { name: 'HMAC', hash: 'SHA-256' };

function encodeB64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

async function getKey(secret, usage = ['sign', 'verify']) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALG,
    false,
    usage
  );
}

export async function signJWT(payload) {
  const secret = process.env.JWT_SECRET || 'default_dev_secret_change_me';
  const header = encodeB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = encodeB64url(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h en secondes
  }));

  const key = await getKey(secret, ['sign']);
  const sig = await crypto.subtle.sign(
    ALG.name,
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );

  return `${header}.${body}.${encodeB64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [head, body, sig] = parts;
    const key = await getKey(secret, ['verify']);

    const valid = await crypto.subtle.verify(
      ALG.name,
      key,
      decodeB64url(sig),
      new TextEncoder().encode(`${head}.${body}`)
    );
    if (!valid) return null;

    const claims = JSON.parse(decodeB64url(body).toString('utf8'));
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return claims;
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function requireAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return verifyJWT(token, process.env.JWT_SECRET || 'default_dev_secret_change_me');
}
