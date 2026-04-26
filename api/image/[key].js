// api/image/[key].js
// GET /api/image/:key → sert une image depuis R2 via AWS S3 SDK

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: decodeURIComponent(key),
    });

    const response = await s3.send(command);
    const contentType = response.ContentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (response.ETag) res.setHeader('ETag', response.ETag);

    // Pipe le stream R2 directement vers la réponse
    response.Body.pipe(res);

  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'Image introuvable' });
    console.error('image error:', err);
    res.status(500).json({ error: err.message });
  }
}
