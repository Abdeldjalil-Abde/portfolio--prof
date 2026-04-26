// Cloudflare D1 expose une API REST — utilisable depuis n'importe où
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.CF_DATABASE_ID;
const CF_API_TOKEN   = process.env.CF_API_TOKEN;

const BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

export async function dbQuery(sql, params = []) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || 'D1 error');
  return json.result[0].results; // tableau de lignes
}