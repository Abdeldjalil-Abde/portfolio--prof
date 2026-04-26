// functions/api/portfolio.js
// GET /api/portfolio  →  toutes les données publiques du portfolio

export async function onRequestGet({ env }) {
  const db = env.DB;

  const [personal, education, experience, skills, projects, publications, languages] = await Promise.all([
    db.prepare('SELECT * FROM personal WHERE id = 1').first(),
    db.prepare('SELECT * FROM education ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM experience ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM skills ORDER BY category, sort_order').all(),
    db.prepare('SELECT * FROM projects ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM publications ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM languages ORDER BY id').all(),
  ]);

  // Enrichir experience avec ses tâches
  const expIds = experience.results.map(e => `'${e.id}'`).join(',');
  const tasks = expIds.length
    ? await db.prepare(`SELECT * FROM experience_tasks WHERE experience_id IN (${expIds}) ORDER BY sort_order`).all()
    : { results: [] };

  const experienceWithTasks = experience.results.map(exp => ({
    ...exp,
    tasks: tasks.results.filter(t => t.experience_id === exp.id).map(t => t.task),
  }));

  // Enrichir projects avec tags et images
  const projIds = projects.results.map(p => `'${p.id}'`).join(',');
  let tags = { results: [] };
  let images = { results: [] };

  if (projIds.length) {
    [tags, images] = await Promise.all([
      db.prepare(`SELECT * FROM project_tags WHERE project_id IN (${projIds})`).all(),
      db.prepare(`SELECT * FROM project_images WHERE project_id IN (${projIds}) ORDER BY sort_order`).all(),
    ]);
  }

  const projectsEnriched = projects.results.map(proj => ({
    ...proj,
    tags: tags.results.filter(t => t.project_id === proj.id).map(t => t.tag),
    images: images.results.filter(i => i.project_id === proj.id),
  }));

  // Grouper les compétences par catégorie
  const skillsGrouped = skills.results.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s.item);
    return acc;
  }, {});

  // URL publique R2 pour la photo de profil
  if (personal?.photo_key) {
    // personal.photo_url = `https://pub-f3ad241587f8489ba3cacb4c0305b9ce.r2.dev/${personal.photo_key}`;
    personal.photo_url = `/api/image/${encodeURIComponent(personal.photo_key)}`;
  }

  return Response.json({
    personal,
    education: education.results,
    experience: experienceWithTasks,
    skills: skillsGrouped,
    projects: projectsEnriched,
    publications: publications.results,
    languages: languages.results,
  }, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}


