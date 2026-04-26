// api/portfolio.js
// GET /api/portfolio → toutes les données publiques du portfolio

import { dbQuery } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [personal, education, experience, skills, projects, publications, languages] = await Promise.all([
      dbQuery('SELECT * FROM personal WHERE id = 1').then(r => r[0] ?? null),
      dbQuery('SELECT * FROM education ORDER BY sort_order'),
      dbQuery('SELECT * FROM experience ORDER BY sort_order'),
      dbQuery('SELECT * FROM skills ORDER BY category, sort_order'),
      dbQuery('SELECT * FROM projects ORDER BY sort_order'),
      dbQuery('SELECT * FROM publications ORDER BY sort_order'),
      dbQuery('SELECT * FROM languages ORDER BY id'),
    ]);

    // Enrichir experience avec ses tâches
    let experienceWithTasks = experience;
    if (experience.length > 0) {
      const expIds = experience.map(e => `'${e.id}'`).join(',');
      const tasks = await dbQuery(
        `SELECT * FROM experience_tasks WHERE experience_id IN (${expIds}) ORDER BY sort_order`
      );
      experienceWithTasks = experience.map(exp => ({
        ...exp,
        tasks: tasks.filter(t => t.experience_id === exp.id).map(t => t.task),
      }));
    }

    // Enrichir projects avec tags et images
    let projectsEnriched = projects;
    if (projects.length > 0) {
      const projIds = projects.map(p => `'${p.id}'`).join(',');
      const [tags, images] = await Promise.all([
        dbQuery(`SELECT * FROM project_tags WHERE project_id IN (${projIds})`),
        dbQuery(`SELECT * FROM project_images WHERE project_id IN (${projIds}) ORDER BY sort_order`),
      ]);
      projectsEnriched = projects.map(proj => ({
        ...proj,
        tags: tags.filter(t => t.project_id === proj.id).map(t => t.tag),
        images: images.filter(i => i.project_id === proj.id),
      }));
    }

    // Grouper les compétences par catégorie
    const skillsGrouped = skills.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s.item);
      return acc;
    }, {});

    // URL de la photo de profil via route image
    if (personal?.photo_key) {
      personal.photo_url = `/api/image/${encodeURIComponent(personal.photo_key)}`;
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      personal,
      education,
      experience: experienceWithTasks,
      skills: skillsGrouped,
      projects: projectsEnriched,
      publications,
      languages,
    });

  } catch (err) {
    console.error('portfolio error:', err);
    res.status(500).json({ error: err.message });
  }
}
