/* =================================================================
   MAIN.JS – Portfolio dynamique via Cloudflare API
   Toutes les données viennent de /api/portfolio (D1 + R2)
   ================================================================= */

const API_BASE = '/api';
let portfolioData = null;
let activeFilter = 'Tous';

// ─── Fetch avec gestion d'erreur ─────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ─── Cursor ───────────────────────────────────────────────────
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
if (window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    setTimeout(() => { follower.style.left = e.clientX + 'px'; follower.style.top = e.clientY + 'px'; }, 80);
  });
}

// ─── Theme ────────────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let currentTheme = localStorage.getItem('portfolio_theme') || 'dark';
applyTheme(currentTheme);
function applyTheme(t) {
  document.body.classList.remove('dark', 'light');
  document.body.classList.add(t);
  themeIcon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('portfolio_theme', t);
  currentTheme = t;
}
themeToggle.addEventListener('click', () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark'));

// ─── Nav ──────────────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 30);
  document.getElementById('scrollTop').classList.toggle('visible', window.scrollY > 400);
});
document.getElementById('scrollTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('navBurger').addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
document.querySelectorAll('#mobileMenu a').forEach(a => a.addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('open')));
document.getElementById('footerYear').textContent = new Date().getFullYear();

// ─── Skeleton helpers ─────────────────────────────────────────
function clearSkeleton(id) {
  const el = document.getElementById(id);
  if (el) el.querySelectorAll('.skeleton').forEach(s => s.remove());
}

// ─── Render Hero ──────────────────────────────────────────────
function renderHero(p) {
  clearSkeleton('heroTitle');
  clearSkeleton('heroSub');
  clearSkeleton('heroTagline');
  document.getElementById('heroTitle').innerHTML = `${p.name}<br><span class="accent">${p.subtitle}</span>`;
  document.getElementById('heroSub').textContent = p.title;
  document.getElementById('heroTagline').textContent = p.tagline;
  document.getElementById('heroInitials').textContent = p.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  if (p.photo_url || p.photo_key) {
    const url = p.photo_url || `/api/image/${encodeURIComponent(p.photo_key)}`;
    document.getElementById('heroAvatar').innerHTML = `<img src="${url}" alt="${p.name}" />`;
  }
}

// ─── Render About ─────────────────────────────────────────────
function renderAbout(p, languages) {
  clearSkeleton('aboutDesc');
  document.getElementById('aboutDesc').innerHTML = `
    <p>Ingénieur en informatique spécialisé en <strong>administration et sécurité des réseaux</strong>, je possède une expérience solide dans la maintenance des systèmes, la gestion de réseaux LAN, et l'administration de serveurs Windows.</p>
    <p>Mes recherches portent sur l'<strong>apprentissage fédéré</strong> appliqué à la cybersécurité et à l'IoT. Trois de mes travaux ont été publiés dans des conférences IEEE et des revues internationales.</p>
  `;

  document.getElementById('aboutLangs').innerHTML = languages.map(l => `
    <div class="lang-item">
      <span class="lang-name">${l.name}</span>
      <div class="lang-bar-wrap"><div class="lang-bar" style="width:0%" data-target="${l.percent}%"></div></div>
      <span class="lang-level">${l.level}</span>
    </div>
  `).join('');

  document.getElementById('aboutCards').innerHTML = [
    { icon: '🛡️', title: 'Sécurité Réseaux', desc: 'ISO 27001, pare-feu, antivirus, CIA Triad' },
    { icon: '🔬', title: 'Recherche', desc: '3 publications IEEE & revues internationales' },
    { icon: '💻', title: 'Développement', desc: 'Full-stack web & logiciel desktop' },
    { icon: '🌐', title: 'Administration', desc: 'Serveurs Windows, LAN, VPN, virtualisation' }
  ].map(c => `
    <div class="about-card">
      <div class="about-card-icon">${c.icon}</div>
      <h4>${c.title}</h4>
      <p>${c.desc}</p>
    </div>
  `).join('');
}

// ─── Render Skills ────────────────────────────────────────────
const skillGroupMeta = {
  backend:       { icon: 'fa-code',           label: 'Back-End' },
  frontend:      { icon: 'fa-palette',         label: 'Front-End' },
  databases:     { icon: 'fa-database',        label: 'Bases de données' },
  security:      { icon: 'fa-shield-alt',      label: 'Sécurité' },
  networking:    { icon: 'fa-network-wired',   label: 'Réseaux' },
  virtualization:{ icon: 'fa-server',          label: 'Virtualisation' },
  os:            { icon: 'fa-desktop',         label: 'Systèmes d\'exploitation' },
  devops:        { icon: 'fa-tools',           label: 'DevOps & Outils' },
  office:        { icon: 'fa-file-excel',      label: 'Office' },
  soft:          { icon: 'fa-users',           label: 'Compétences Soft' },
};
function renderSkills(skills) {
  clearSkeleton('skillsContainer');
  document.getElementById('skillsContainer').innerHTML = Object.entries(skills).map(([key, items]) => {
    const meta = skillGroupMeta[key] || { icon: 'fa-star', label: key };
    return `
      <div class="skill-group">
        <div class="skill-group-title"><i class="fas ${meta.icon}"></i>${meta.label}</div>
        <div class="skill-pills">${items.map(i => `<span class="skill-pill">${i}</span>`).join('')}</div>
      </div>
    `;
  }).join('');
}

// ─── Render Projects ──────────────────────────────────────────
function renderProjects(projects) {
  clearSkeleton('projectsGrid');
  const categories = ['Tous', ...new Set(projects.map(p => p.category))];
  document.getElementById('projectFilters').innerHTML = categories.map(c =>
    `<button class="filter-btn${c === activeFilter ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      renderProjects(portfolioData.projects);
    });
  });

  const filtered = activeFilter === 'Tous' ? projects : projects.filter(p => p.category === activeFilter);
  document.getElementById('projectsGrid').innerHTML = filtered.map(p => `
    <div class="project-card">
      ${p.images && p.images.length ? `
        <div class="project-img">
          <img src="/api/image/${encodeURIComponent(p.images[0].r2_key)}" alt="${p.title}" loading="lazy" />
        </div>` : ''}
      <div class="project-top">
        <span class="project-category">${p.category} · ${p.year || ''}</span>
        <span class="project-badge ${p.status === 'completed' ? 'badge-completed' : 'badge-inprogress'}">
          ${p.status === 'completed' ? 'Terminé' : 'En cours'}
        </span>
      </div>
      <div class="project-title">${p.title}</div>
      <div class="project-desc">${p.description}</div>
      ${p.publication ? `<div class="project-pub"><i class="fas fa-book-open"></i>${p.publication}</div>` : ''}
      <div class="project-tags">${(p.tags || []).map(t => `<span class="project-tag">${t}</span>`).join('')}</div>
      <div class="project-footer">
        <span class="project-role">${p.role}</span>
        <a class="project-link" href="${p.link_url || '#'}" ${p.link_url ? 'target="_blank"' : ''}>
          <i class="fas fa-${p.link_url ? 'external-link-alt' : 'lock'}"></i>
        </a>
      </div>
    </div>
  `).join('');
}

// ─── Render Experience ────────────────────────────────────────
function renderExperience(experience, education) {
  document.getElementById('timeline').innerHTML = experience.map(e => `
    <div class="timeline-item">
      <div><div class="timeline-dot"><div class="timeline-dot-inner"></div></div></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-role">${e.role}</span>
          <span class="timeline-type">${e.type}</span>
        </div>
        <div class="timeline-meta">
          <i class="fas fa-building" style="font-size:.7rem;opacity:.6"></i> ${e.company} &nbsp;·&nbsp;
          <i class="fas fa-map-marker-alt" style="font-size:.7rem;opacity:.6"></i> ${e.location} &nbsp;·&nbsp;
          <i class="fas fa-calendar" style="font-size:.7rem;opacity:.6"></i> ${e.period}
        </div>
        <ul class="timeline-tasks">${(e.tasks || []).map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
    </div>
  `).join('');

  document.getElementById('educationGrid').innerHTML = education.map(e => `
    <div class="edu-card">
      <div class="edu-icon">🎓</div>
      <div class="edu-degree">${e.degree}</div>
      <div class="edu-institution">${e.institution} – ${e.location}</div>
      <div class="edu-period">${e.period}</div>
      <div class="edu-details">${e.details}</div>
    </div>
  `).join('');
}

// ─── Render Publications ──────────────────────────────────────
function renderPublications(publications) {
  document.getElementById('pubList').innerHTML = publications.map((p, i) => `
    <div class="pub-card">
      <div class="pub-number">0${i + 1}</div>
      <div>
        <div class="pub-title">${p.title}</div>
        <div class="pub-meta">
          <span class="pub-venue"><i class="fas fa-university" style="font-size:.7rem;margin-right:4px"></i>${p.venue}</span>
          <span>${p.year}</span>
          <span class="pub-role-badge">${p.role}</span>
          ${p.doi ? `<span class="pub-doi"><a href="${p.doi}" target="_blank"><i class="fas fa-external-link-alt"></i> DOI: ${p.doi}</a></span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ─── Render Contact ───────────────────────────────────────────
function renderContact(p) {
  document.getElementById('contactLinks').innerHTML = `
    <div class="contact-link-item">
      <div class="contact-link-icon"><i class="fas fa-envelope"></i></div>
      <div><div class="contact-link-label">Email</div>
      <div class="contact-link-value"><a href="mailto:${p.email}">${p.email}</a></div></div>
    </div>
    <div class="contact-link-item">
      <div class="contact-link-icon"><i class="fas fa-phone"></i></div>
      <div><div class="contact-link-label">Téléphone</div>
      <div class="contact-link-value">${p.phone}</div></div>
    </div>
    <div class="contact-link-item">
      <div class="contact-link-icon"><i class="fab fa-github"></i></div>
      <div><div class="contact-link-label">GitHub</div>
      <div class="contact-link-value"><a href="${p.github_url}" target="_blank">${(p.github_url||'').replace('https://','')}</a></div></div>
    </div>
    <div class="contact-link-item">
      <div class="contact-link-icon"><i class="fab fa-linkedin"></i></div>
      <div><div class="contact-link-label">LinkedIn</div>
      <div class="contact-link-value"><a href="${p.linkedin_url}" target="_blank">${(p.linkedin_url||'').replace('https://','')}</a></div></div>
    </div>
    <div class="contact-link-item">
      <div class="contact-link-icon"><i class="fas fa-map-marker-alt"></i></div>
      <div><div class="contact-link-label">Localisation</div>
      <div class="contact-link-value">${p.location}</div></div>
    </div>
  `;
  document.getElementById('footerSocial').innerHTML = `
    <a href="mailto:${p.email}"><i class="fas fa-envelope"></i></a>
    <a href="${p.github_url}" target="_blank"><i class="fab fa-github"></i></a>
    <a href="${p.linkedin_url}" target="_blank"><i class="fab fa-linkedin"></i></a>
  `;
}

// ─── Scroll animations ────────────────────────────────────────
function setupScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('.lang-bar').forEach(bar => { bar.style.width = bar.dataset.target; });
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.section').forEach(s => observer.observe(s));
}

// ─── Contact form ─────────────────────────────────────────────
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> Message envoyé !';
  btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; e.target.reset(); }, 3000);
});

// ─── Project card image style ─────────────────────────────────
const extraStyle = document.createElement('style');
extraStyle.textContent = `
  .project-img { border-radius: 10px; overflow: hidden; margin-bottom: 12px; height: 140px; }
  .project-img img { width: 100%; height: 100%; object-fit: cover; }
  .skeleton { display: block; background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
  .sk-title { height: 60px; width: 80%; margin-bottom: 12px; }
  .sk-line  { height: 20px; width: 60%; margin-bottom: 8px; }
  .sk-paragraph { height: 80px; width: 100%; }
  .sk-card { height: 220px; width: 100%; border-radius: 14px; }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
`;
document.head.appendChild(extraStyle);

// ─── Main init ────────────────────────────────────────────────
async function init() {
  try {
    portfolioData = await apiFetch('/portfolio');

    renderHero(portfolioData.personal);
    renderAbout(portfolioData.personal, portfolioData.languages);
    renderSkills(portfolioData.skills);
    renderProjects(portfolioData.projects);
    renderExperience(portfolioData.experience, portfolioData.education);
    renderPublications(portfolioData.publications);
    renderContact(portfolioData.personal);
    setupScrollAnimations();

    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 400);
  } catch (err) {
    console.error('Erreur chargement portfolio:', err);
    document.getElementById('loader').innerHTML = `
      <div style="text-align:center;color:#ef4444;padding:40px">
        <p style="font-size:1.1rem;margin-bottom:8px">⚠ Erreur de connexion à l'API</p>
        <p style="font-size:.85rem;opacity:.7">Vérifiez que Cloudflare Workers est déployé</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;border-radius:999px;background:#5b8dee;color:#fff;border:none;cursor:pointer">Réessayer</button>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', init);
