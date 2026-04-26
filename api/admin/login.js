// functions/api/admin/login.js
// POST /api/admin/login  →  authentification admin

import { signJWT, hashPassword } from '../../_auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Corps JSON invalide' }, { status: 400 }); }

  const { password } = body;
  if (!password) return Response.json({ error: 'Mot de passe requis' }, { status: 400 });

  // Le hash du mot de passe est stocké dans un secret Cloudflare
  // Définir avec: wrangler secret put ADMIN_PASSWORD_HASH
  // Générer le hash: node -e "const c=require('crypto');console.log(c.createHash('sha256').update('VotreMotDePasse').digest('hex'))"
  const expectedHash = env.ADMIN_PASSWORD_HASH;

  if (!expectedHash) {
    // Mode développement : mot de passe par défaut
    if (password !== 'admin123') {
      return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }
  } else {
    const inputHash = await hashPassword(password);
    if (inputHash !== expectedHash) {
      return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }
  }

  const secret = env.JWT_SECRET || 'default_dev_secret_change_me';
  const token = await signJWT({ role: 'admin' }, secret, 86400); // 24h

  return Response.json({ token, expiresIn: 86400 });
}
