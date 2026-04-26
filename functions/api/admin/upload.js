// functions/api/admin/upload.js
// POST /api/admin/upload
// Upload image → R2 + register in D1

import { requireAuth } from '../../_auth.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function onRequestPost({ request, env }) {
  // ─── 1. Auth ─────────────────────────────
  const user = await requireAuth(request, env);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── 2. Form data ────────────────────────
  const formData = await request.formData();
  const file = formData.get('file');

  /**
   * context =
   * - "profile" → image de profil
   * - "proj1", "proj2", ... → project_id
   */
  const context = formData.get('context');

  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: 'Invalid file type (JPEG, PNG, WebP, GIF only)' },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();

  if (buffer.byteLength > MAX_SIZE) {
    return Response.json(
      { error: 'File too large (max 5MB)' },
      { status: 400 }
    );
  }

  // ─── 3. Generate unique R2 key ───────────
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');

  const key = `${context || 'general'}/${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}.${ext}`;

  // ─── 4. Upload to R2 ─────────────────────
  await env.R2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      originalName: file.name,
      context,
    },
  });

  // ─── 5. Profile image update ─────────────
  if (context === 'profile') {
    await env.DB.prepare(`
      UPDATE personal
      SET photo_key = ?, updated_at = datetime('now')
      WHERE id = 1
    `)
      .bind(key)
      .run();
  }

  // ─── 6. Project image insert ─────────────
  if (context && context !== 'profile') {
    await env.DB.prepare(`
      INSERT INTO project_images (project_id, r2_key, caption, sort_order)
      VALUES (?, ?, ?, ?)
    `)
      .bind(context, key, '', 0)
      .run();
  }

  // ─── 7. Public URL ───────────────────────
  const url = `/api/image/${encodeURIComponent(key)}`;

  return Response.json({
    success: true,
    key,
    url,
    size: buffer.byteLength,
    context
  });
}