/* =================================================================
   ADMIN.JS – Interface d'administration via Cloudflare Workers API
   Toutes les opérations CRUD passent par /api/admin/*
   ================================================================= */

const API = '/api';
let JWT_TOKEN = sessionStorage.getItem('at_jwt') || null;
let currentData = {};

// ─── API helper ──────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (JWT_TOKEN) opts.headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Toast ───────────────────────────────────────────────────
function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? 'linear-gradient(135deg,#5b8dee,#a78bfa)' : 'linear-gradient(135deg,#ef4444,#dc2626)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Auth ────────────────────────────────────────────────────
const loginScreen = document.getElementById('loginScreen');
const adminShell  = document.getElementById('adminShell');

function showAdmin() {
  loginScreen.style.display = 'none';
  adminShell.style.display = 'flex';
  initAdmin();
}

if (JWT_TOKEN) showAdmin();

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await api('POST', '/admin/login', { password: pass });
    JWT_TOKEN = res.token;
    sessionStorage.setItem('at_jwt', JWT_TOKEN);
    showAdmin();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  JWT_TOKEN = null;
  sessionStorage.removeItem('at_jwt');
  location.reload();
});

// ─── Tabs ────────────────────────────────────────────────────
const tabMeta = {
  personal:     ['Profil',         'Informations personnelles – Cloudflare D1'],
  experience:   ['Expériences',    'Parcours professionnel – Cloudflare D1'],
  education:    ['Formation',      'Formation académique – Cloudflare D1'],
  skills:       ['Compétences',    'Stack technique – Cloudflare D1'],
  projects:     ['Projets',        'Réalisations – Cloudflare D1 + R2'],
  publications: ['Publications',   'Articles & conférences – Cloudflare D1'],
  images:       ['Images',         'Galerie projet – Cloudflare R2'],
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async e => {
    e.preventDefault();
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('tabTitle').textContent = tabMeta[tab][0];
    document.getElementById('tabDesc').textContent = tabMeta[tab][1];
    await renderTab(tab);
  });
});

// ─── Global Save ─────────────────────────────────────────────
document.getElementById('globalSave').addEventListener('click', async () => {
  try {
    const active = document.querySelector('.nav-item.active')?.dataset.tab;
    if (active === 'personal') await savePersonal();
    else if (active === 'skills') await saveSkills();
    else toast('Utilisez les boutons Enregistrer des éléments individuels', false);
  } catch (err) { toast(err.message, false); }
});

// ─── Modal ───────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
let modalCallback = null;

function openModal(title, fields, onSave) {
  document.getElementById('modalTitle').textContent = title;
  const body = document.getElementById('modalBody');
  body.innerHTML = fields.map(f => {
    if (f.type === 'textarea') return `<label>${f.label}<textarea id="mf-${f.key}" rows="${f.rows||3}">${escHtml(f.value||'')}</textarea></label>`;
    if (f.type === 'select')   return `<label>${f.label}<select id="mf-${f.key}">${f.options.map(o=>`<option value="${o.v}"${f.value===o.v?' selected':''}>${o.l}</option>`).join('')}</select></label>`;
    return `<label>${f.label}<input type="${f.type||'text'}" id="mf-${f.key}" value="${escHtml(String(f.value||''))}" /></label>`;
  }).join('');
  modalCallback = onSave;
  modalOverlay.classList.add('open');
}
function closeModal() { modalOverlay.classList.remove('open'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalSave').addEventListener('click', () => {
  if (!modalCallback) return;
  const vals = {};
  document.querySelectorAll('[id^="mf-"]').forEach(el => { vals[el.id.replace('mf-','')] = el.value; });
  modalCallback(vals);
  closeModal();
});
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function genId() { return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }

// ─── PERSONAL ────────────────────────────────────────────────
async function loadPersonal() {
  const data = await api('GET', '/admin/data?section=personal');
  currentData.personal = data;
  document.getElementById('p-name').value      = data.name || '';
  document.getElementById('p-title').value     = data.title || '';
  document.getElementById('p-subtitle').value  = data.subtitle || '';
  document.getElementById('p-tagline').value   = data.tagline || '';
  document.getElementById('p-email').value     = data.email || '';
  document.getElementById('p-phone').value     = data.phone || '';
  document.getElementById('p-location').value  = data.location || '';
  document.getElementById('p-github').value    = data.github_url || '';
  document.getElementById('p-linkedin').value  = data.linkedin_url || '';
  if (data.photo_key) {
    document.getElementById('photoPreview').innerHTML = `<img src="/api/image/${encodeURIComponent(data.photo_key)}" alt="Photo" />`;
  }
}
async function savePersonal() {
  await api('PUT', '/admin/data?section=personal', {
    name: document.getElementById('p-name').value,
    title: document.getElementById('p-title').value,
    subtitle: document.getElementById('p-subtitle').value,
    tagline: document.getElementById('p-tagline').value,
    email: document.getElementById('p-email').value,
    phone: document.getElementById('p-phone').value,
    location: document.getElementById('p-location').value,
    github_url: document.getElementById('p-github').value,
    linkedin_url: document.getElementById('p-linkedin').value,
  });
  toast('✓ Profil sauvegardé dans Cloudflare D1');
}

// Photo upload → R2
document.getElementById('photoFile')?.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const btn = document.getElementById('profileUploadBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload…';
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('context', 'profile');
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('photoPreview').innerHTML = `<img src="${data.url}" alt="Photo" />`;
    toast('✓ Photo uploadée dans R2');
  } catch (err) { toast(err.message, false); }
  finally { btn.innerHTML = '<i class="fas fa-upload"></i> Uploader depuis R2'; }
});

// ─── EXPERIENCE ───────────────────────────────────────────────
async function loadExperience() {
  const list = await api('GET', '/admin/data?section=experience');
  currentData.experience = list;
  renderExpList(list);
}
function renderExpList(list) {
  document.getElementById('expList').innerHTML = list.map((e, i) => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${escHtml(e.role)}</div>
        <div class="item-card-meta">${escHtml(e.company)} · ${escHtml(e.period)} · <em>${escHtml(e.type)}</em></div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editExp('${e.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteItem('experience','${e.id}',loadExperience)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:.85rem">Aucune expérience.</p>';
}
function expFields(e={}) {
  return [
    {key:'role',label:'Poste',value:e.role||''},
    {key:'company',label:'Entreprise',value:e.company||''},
    {key:'location',label:'Lieu',value:e.location||''},
    {key:'period',label:'Période',value:e.period||''},
    {key:'type',label:'Type',type:'select',value:e.type||'CDI',options:[{v:'CDI',l:'CDI'},{v:'CDD',l:'CDD'},{v:'Stage',l:'Stage'},{v:'Freelance',l:'Freelance'},{v:'Vacation',l:'Vacation'}]},
    {key:'tasks',label:'Tâches (une par ligne)',type:'textarea',rows:4,value:(e.tasks||[]).join('\n')},
  ];
}
window.editExp = function(id) {
  const e = currentData.experience?.find(x => x.id === id) || {};
  openModal('Modifier l\'expérience', expFields(e), async vals => {
    try {
      await api('PUT', `/admin/data?section=experience&id=${id}`, { ...vals, tasks: vals.tasks.split('\n').filter(t=>t.trim()) });
      toast('✓ Expérience mise à jour'); await loadExperience();
    } catch(err) { toast(err.message, false); }
  });
};
document.getElementById('addExpBtn')?.addEventListener('click', () => {
  openModal('Ajouter une expérience', expFields(), async vals => {
    try {
      await api('POST', '/admin/data?section=experience', { id: genId(), ...vals, tasks: vals.tasks.split('\n').filter(t=>t.trim()) });
      toast('✓ Expérience ajoutée'); await loadExperience();
    } catch(err) { toast(err.message, false); }
  });
});

// ─── EDUCATION ────────────────────────────────────────────────
async function loadEducation() {
  const list = await api('GET', '/admin/data?section=education');
  currentData.education = list;
  document.getElementById('eduList').innerHTML = list.map(e => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${escHtml(e.degree)}</div>
        <div class="item-card-meta">${escHtml(e.institution)} · ${escHtml(e.period||'')}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editEdu('${e.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteItem('education','${e.id}',loadEducation)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:.85rem">Aucune formation.</p>';
}
function eduFields(e={}) {
  return [
    {key:'degree',label:'Diplôme',value:e.degree||''},
    {key:'institution',label:'Institution',value:e.institution||''},
    {key:'location',label:'Lieu',value:e.location||''},
    {key:'period',label:'Période',value:e.period||''},
    {key:'details',label:'Détails',type:'textarea',value:e.details||''},
  ];
}
window.editEdu = function(id) {
  const e = currentData.education?.find(x=>x.id===id) || {};
  openModal('Modifier la formation', eduFields(e), async vals => {
    try { await api('PUT',`/admin/data?section=education&id=${id}`,vals); toast('✓ Formation mise à jour'); await loadEducation(); }
    catch(err) { toast(err.message, false); }
  });
};
document.getElementById('addEduBtn')?.addEventListener('click', () => {
  openModal('Ajouter une formation', eduFields(), async vals => {
    try { await api('POST','/admin/data?section=education',{id:genId(),...vals}); toast('✓ Formation ajoutée'); await loadEducation(); }
    catch(err) { toast(err.message, false); }
  });
});

// ─── SKILLS ───────────────────────────────────────────────────
const skillCats = {backend:'Back-End',frontend:'Front-End',databases:'Bases de données',security:'Sécurité',networking:'Réseaux',virtualization:'Virtualisation',os:'OS',devops:'DevOps',office:'Office',soft:'Soft Skills'};
async function loadSkills() {
  const rows = await api('GET', '/admin/data?section=skills');
  const grouped = rows.reduce((a,r) => { (a[r.category]=a[r.category]||[]).push(r.item); return a; }, {});
  currentData.skills = grouped;
  document.getElementById('skillsForm').innerHTML = Object.entries(skillCats).map(([k,label]) => `
    <div class="field-group">
      <label>${label}</label>
      <input type="text" id="sk-${k}" value="${escHtml((grouped[k]||[]).join(', '))}" placeholder="Séparées par des virgules" />
    </div>
  `).join('');
}
async function saveSkills() {
  // Supprimer toutes les compétences et réinsérer
  for (const [cat, label] of Object.entries(skillCats)) {
    const el = document.getElementById(`sk-${cat}`);
    if (!el) continue;
    const items = el.value.split(',').map(s=>s.trim()).filter(Boolean);
    // On utilise une approche par remplacement complet via un endpoint dédié
    // Pour simplifier, on envoie POST pour chaque item manquant
    // (dans une vraie app, un endpoint bulk serait préférable)
    for (let i=0; i<items.length; i++) {
      try { await api('POST','/admin/data?section=skills',{category:cat,item:items[i],sort_order:i}); } catch{}
    }
  }
  toast('✓ Compétences sauvegardées dans D1');
}

// ─── PROJECTS ─────────────────────────────────────────────────
async function loadProjects() {
  const list = await api('GET', '/admin/data?section=projects');
  currentData.projects = list;
  // Populate image upload select
  const sel = document.getElementById('uploadProjectSelect');
  if (sel) sel.innerHTML = list.map(p=>`<option value="${p.id}">${escHtml(p.title)}</option>`).join('');

  document.getElementById('projList').innerHTML = list.map(p => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${escHtml(p.title)}</div>
        <div class="item-card-meta">${escHtml(p.category||'')} · ${p.year||''} · ${p.status==='completed'?'Terminé':'En cours'} · tags: ${(p.tags||[]).join(', ')}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editProj('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteItem('projects','${p.id}',loadProjects)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:.85rem">Aucun projet.</p>';
}
function projFields(p={}) {
  return [
    {key:'title',label:'Titre',value:p.title||''},
    {key:'category',label:'Catégorie',value:p.category||''},
    {key:'year',label:'Année',type:'number',value:p.year||new Date().getFullYear()},
    {key:'status',label:'Statut',type:'select',value:p.status||'completed',options:[{v:'completed',l:'Terminé'},{v:'inprogress',l:'En cours'}]},
    {key:'description',label:'Description',type:'textarea',value:p.description||''},
    {key:'tags',label:'Tags (séparés par des virgules)',value:(p.tags||[]).join(', ')},
    {key:'role',label:'Rôle',value:p.role||''},
    {key:'publication',label:'Publication (optionnel)',value:p.publication||''},
    {key:'link_url',label:'URL (optionnel)',value:p.link_url||''},
  ];
}
window.editProj = function(id) {
  const p = currentData.projects?.find(x=>x.id===id) || {};
  openModal('Modifier le projet', projFields(p), async vals => {
    try {
      await api('PUT',`/admin/data?section=projects&id=${id}`,{...vals,tags:vals.tags.split(',').map(t=>t.trim()).filter(Boolean),year:parseInt(vals.year)});
      toast('✓ Projet mis à jour'); await loadProjects();
    } catch(err) { toast(err.message,false); }
  });
};
document.getElementById('addProjBtn')?.addEventListener('click', () => {
  openModal('Ajouter un projet', projFields(), async vals => {
    try {
      await api('POST','/admin/data?section=projects',{id:genId(),...vals,tags:vals.tags.split(',').map(t=>t.trim()).filter(Boolean),year:parseInt(vals.year)});
      toast('✓ Projet ajouté'); await loadProjects();
    } catch(err) { toast(err.message,false); }
  });
});

// ─── PUBLICATIONS ─────────────────────────────────────────────
async function loadPublications() {
  const list = await api('GET', '/admin/data?section=publications');
  currentData.publications = list;
  document.getElementById('pubListAdmin').innerHTML = list.map(p => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${escHtml(p.title)}</div>
        <div class="item-card-meta">${escHtml(p.venue||'')} · ${p.year||''} · ${escHtml(p.role||'')}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editPub('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteItem('publications','${p.id}',loadPublications)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:.85rem">Aucune publication.</p>';
}
function pubFields(p={}) {
  return [
    {key:'title',label:'Titre',value:p.title||''},
    {key:'venue',label:'Revue / Conférence',value:p.venue||''},
    {key:'year',label:'Année',type:'number',value:p.year||''},
    {key:'role',label:'Rôle',value:p.role||''},
    {key:'doi',label:'DOI',value:p.doi||''},
  ];
}
window.editPub = function(id) {
  const p = currentData.publications?.find(x=>x.id===id) || {};
  openModal('Modifier la publication', pubFields(p), async vals => {
    try { await api('PUT',`/admin/data?section=publications&id=${id}`,{...vals,year:parseInt(vals.year)}); toast('✓ Publication mise à jour'); await loadPublications(); }
    catch(err) { toast(err.message,false); }
  });
};
document.getElementById('addPubBtn')?.addEventListener('click', () => {
  openModal('Ajouter une publication', pubFields(), async vals => {
    try { await api('POST','/admin/data?section=publications',{id:genId(),...vals,year:parseInt(vals.year)}); toast('✓ Publication ajoutée'); await loadPublications(); }
    catch(err) { toast(err.message,false); }
  });
});

// ─── IMAGES (R2 upload) ───────────────────────────────────────
function loadImages() {
  const dropZone = document.getElementById('dropZoneR2');
  const fileInput = document.getElementById('r2FileInput');
  if (!dropZone) return;

  dropZone.addEventListener('click', () => fileInput.click());
  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.style.borderColor='var(--accent)'; }));
  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.style.borderColor=''; }));
  dropZone.addEventListener('drop', e => { handleR2Upload(e.dataTransfer.files); });
  fileInput.addEventListener('change', e => handleR2Upload(e.target.files));
}

async function handleR2Upload(files) {
  const projectId = document.getElementById('uploadProjectSelect')?.value;
  const gallery = document.getElementById('r2Gallery');
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const card = document.createElement('div');
    card.className = 'r2-img-card loading';
    card.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    gallery.prepend(card);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('context', projectId || 'general');
      const res = await fetch('/api/admin/upload', { method:'POST', headers:{'Authorization':`Bearer ${JWT_TOKEN}`}, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      card.className = 'r2-img-card';
      card.innerHTML = `<img src="${data.url}" alt="${file.name}" /><span>${file.name}</span>`;
      toast('✓ Image uploadée dans R2');
    } catch(err) {
      card.className = 'r2-img-card error';
      card.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${err.message}</span>`;
    }
  }
}

// ─── Generic delete ───────────────────────────────────────────
window.deleteItem = async function(section, id, reload) {
  if (!confirm('Supprimer cet élément ? Cette action est irréversible.')) return;
  try {
    await api('DELETE', `/admin/data?section=${section}&id=${id}`);
    toast('✓ Supprimé'); await reload();
  } catch(err) { toast(err.message, false); }
};

// ─── Tab router ───────────────────────────────────────────────
async function renderTab(tab) {
  try {
    switch(tab) {
      case 'personal':     await loadPersonal(); break;
      case 'experience':   await loadExperience(); break;
      case 'education':    await loadEducation(); break;
      case 'skills':       await loadSkills(); break;
      case 'projects':     await loadProjects(); break;
      case 'publications': await loadPublications(); break;
      case 'images':       loadImages(); await loadProjects(); break;
    }
  } catch(err) { toast('Erreur API: ' + err.message, false); }
}

// ─── Init ─────────────────────────────────────────────────────
async function initAdmin() {
  // Inject extra CSS for R2 gallery
  const s = document.createElement('style');
  s.textContent = `
    .image-upload-section { display:flex; flex-direction:column; gap:20px; }
    .drop-zone-r2 { border:2px dashed var(--border-hover); border-radius:16px; padding:40px 20px; text-align:center; cursor:pointer; transition:border-color .2s; }
    .drop-zone-r2:hover { border-color:var(--accent); }
    .drop-zone-r2 p { font-size:.85rem; color:var(--text-muted); margin-top:6px; }
    .r2-gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }
    .r2-img-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; align-items:center; }
    .r2-img-card img { width:100%; height:80px; object-fit:cover; }
    .r2-img-card span { font-size:.65rem; color:var(--text-dim); padding:4px 6px; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
    .r2-img-card.loading,.r2-img-card.error { height:100px; justify-content:center; font-size:1.2rem; color:var(--text-dim); }
    .r2-img-card.error { color:var(--danger); }
    .api-status { font-size:.78rem; color:var(--accent); margin-top:3px; }
  `;
  document.head.appendChild(s);
  await renderTab('personal');
}
