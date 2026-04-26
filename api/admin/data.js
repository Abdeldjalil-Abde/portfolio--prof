// functions/api/admin/data.js
// CRUD complet pour toutes les sections du portfolio
// Toutes les routes sont protégées par JWT

import { requireAuth } from '../../_auth.js';

function unauth() { return Response.json({ error: 'Non autorisé' }, { status: 401 }); }
function bad(msg) { return Response.json({ error: msg }, { status: 400 }); }
function ok(data) { return Response.json(data); }
function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

// ─── Router ────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const claims = await requireAuth(request, env);
  if (!claims) return unauth();

  const url = new URL(request.url);
  // /api/admin/data?section=personal|experience|education|skills|projects|publications
  const section = url.searchParams.get('section');
  const method = request.method;
  const db = env.DB;

  if (!section) return bad('Paramètre "section" manquant');

  try {
    if (method === 'GET')    return await handleGet(section, db, url);
    if (method === 'POST')   return await handlePost(section, db, await request.json());
    if (method === 'PUT')    return await handlePut(section, db, await request.json(), url);
    if (method === 'DELETE') return await handleDelete(section, db, url);
    return Response.json({ error: 'Méthode non supportée' }, { status: 405 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── GET ───────────────────────────────────────────────────
async function handleGet(section, db, url) {
  switch (section) {
    case 'personal':
      return ok(await db.prepare('SELECT * FROM personal WHERE id=1').first());
    case 'experience': {
      const exps = await db.prepare('SELECT * FROM experience ORDER BY sort_order').all();
      const tasks = await db.prepare('SELECT * FROM experience_tasks ORDER BY sort_order').all();
      return ok(exps.results.map(e => ({
        ...e, tasks: tasks.results.filter(t => t.experience_id === e.id).map(t => t.task)
      })));
    }
    case 'education':
      return ok((await db.prepare('SELECT * FROM education ORDER BY sort_order').all()).results);
    case 'skills':
      return ok((await db.prepare('SELECT * FROM skills ORDER BY category,sort_order').all()).results);
    case 'projects': {
      const projs = await db.prepare('SELECT * FROM projects ORDER BY sort_order').all();
      const tags  = await db.prepare('SELECT * FROM project_tags').all();
      return ok(projs.results.map(p => ({
        ...p, tags: tags.results.filter(t => t.project_id === p.id).map(t => t.tag)
      })));
    }
    case 'publications':
      return ok((await db.prepare('SELECT * FROM publications ORDER BY sort_order').all()).results);
    default: return bad('Section inconnue');
  }
}

// ─── POST (ajouter) ────────────────────────────────────────
async function handlePost(section, db, body) {
  const id = genId();
  switch (section) {
    case 'experience': {
      await db.prepare(
        'INSERT INTO experience (id,role,company,location,period,type,sort_order) VALUES (?,?,?,?,?,?,?)'
      ).bind(id, body.role||'', body.company||'', body.location||'', body.period||'', body.type||'CDI', body.sort_order||0).run();
      if (Array.isArray(body.tasks)) {
        for (let i=0; i<body.tasks.length; i++) {
          await db.prepare('INSERT INTO experience_tasks (experience_id,task,sort_order) VALUES (?,?,?)').bind(id, body.tasks[i], i).run();
        }
      }
      return ok({ id, created: true });
    }
    case 'education':
      await db.prepare('INSERT INTO education (id,degree,institution,location,period,details,sort_order) VALUES (?,?,?,?,?,?,?)')
        .bind(id, body.degree||'', body.institution||'', body.location||'', body.period||'', body.details||'', body.sort_order||0).run();
      return ok({ id, created: true });
    case 'projects': {
      await db.prepare('INSERT INTO projects (id,title,category,status,year,description,publication,role,link_url,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, body.title||'', body.category||'', body.status||'completed', body.year||null, body.description||'', body.publication||'', body.role||'', body.link_url||'', body.sort_order||0).run();
      if (Array.isArray(body.tags)) {
        for (const tag of body.tags) {
          await db.prepare('INSERT INTO project_tags (project_id,tag) VALUES (?,?)').bind(id, tag).run();
        }
      }
      return ok({ id, created: true });
    }
    case 'publications':
      await db.prepare('INSERT INTO publications (id,title,venue,year,role,doi,sort_order) VALUES (?,?,?,?,?,?,?)')
        .bind(id, body.title||'', body.venue||'', body.year||null, body.role||'', body.doi||'', body.sort_order||0).run();
      return ok({ id, created: true });
    case 'skills':
      await db.prepare('INSERT INTO skills (category,item,sort_order) VALUES (?,?,?)').bind(body.category||'', body.item||'', body.sort_order||0).run();
      return ok({ created: true });
    default: return bad('Section inconnue');
  }
}

// ─── PUT (modifier) ────────────────────────────────────────
async function handlePut(section, db, body, url) {
  const id = url.searchParams.get('id');
  switch (section) {
    case 'personal':
      await db.prepare(`
        UPDATE personal SET name=?,title=?,subtitle=?,tagline=?,email=?,phone=?,location=?,github_url=?,linkedin_url=?,updated_at=datetime('now') WHERE id=1
      `).bind(body.name, body.title, body.subtitle, body.tagline, body.email, body.phone, body.location, body.github_url, body.linkedin_url).run();
      return ok({ updated: true });
    case 'experience': {
      if (!id) return bad('id requis');
      await db.prepare('UPDATE experience SET role=?,company=?,location=?,period=?,type=? WHERE id=?').bind(body.role, body.company, body.location, body.period, body.type, id).run();
      await db.prepare('DELETE FROM experience_tasks WHERE experience_id=?').bind(id).run();
      if (Array.isArray(body.tasks)) {
        for (let i=0; i<body.tasks.length; i++) {
          await db.prepare('INSERT INTO experience_tasks (experience_id,task,sort_order) VALUES (?,?,?)').bind(id, body.tasks[i], i).run();
        }
      }
      return ok({ updated: true });
    }
    case 'education':
      if (!id) return bad('id requis');
      await db.prepare('UPDATE education SET degree=?,institution=?,location=?,period=?,details=? WHERE id=?').bind(body.degree, body.institution, body.location, body.period, body.details, id).run();
      return ok({ updated: true });
    case 'projects': {
      if (!id) return bad('id requis');
      await db.prepare('UPDATE projects SET title=?,category=?,status=?,year=?,description=?,publication=?,role=?,link_url=? WHERE id=?')
        .bind(body.title, body.category, body.status, body.year, body.description, body.publication, body.role, body.link_url, id).run();
      await db.prepare('DELETE FROM project_tags WHERE project_id=?').bind(id).run();
      if (Array.isArray(body.tags)) {
        for (const tag of body.tags) {
          await db.prepare('INSERT INTO project_tags (project_id,tag) VALUES (?,?)').bind(id, tag).run();
        }
      }
      return ok({ updated: true });
    }
    case 'publications':
      if (!id) return bad('id requis');
      await db.prepare('UPDATE publications SET title=?,venue=?,year=?,role=?,doi=? WHERE id=?').bind(body.title, body.venue, body.year, body.role, body.doi, id).run();
      return ok({ updated: true });
    default: return bad('Section inconnue');
  }
}

// ─── DELETE ────────────────────────────────────────────────
async function handleDelete(section, db, url) {
  const id = url.searchParams.get('id');
  if (!id) return bad('id requis');
  const tables = { experience:'experience', education:'education', projects:'projects', publications:'publications' };
  if (tables[section]) {
    await db.prepare(`DELETE FROM ${tables[section]} WHERE id=?`).bind(id).run();
    return ok({ deleted: true });
  }
  return bad('Section non supprimable');
}
