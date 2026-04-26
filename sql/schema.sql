-- ============================================================
--  SCHEMA D1 – Portfolio Abdeldjalil Tedjini
--  Exécuter avec: wrangler d1 execute portfolio_db --file=sql/schema.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- ─── Informations personnelles ───────────────────────────────
CREATE TABLE IF NOT EXISTS personal (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  name       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  subtitle   TEXT,
  tagline    TEXT,
  email      TEXT,
  phone      TEXT,
  location   TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  photo_key  TEXT,          -- clé R2 de la photo de profil
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Formation académique ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS education (
  id          TEXT PRIMARY KEY,
  degree      TEXT NOT NULL,
  institution TEXT NOT NULL,
  location    TEXT,
  period      TEXT,
  details     TEXT,
  sort_order  INTEGER DEFAULT 0
);

-- ─── Expériences professionnelles ────────────────────────────
CREATE TABLE IF NOT EXISTS experience (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,
  company    TEXT NOT NULL,
  location   TEXT,
  period     TEXT,
  type       TEXT DEFAULT 'CDI',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS experience_tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  experience_id TEXT NOT NULL REFERENCES experience(id) ON DELETE CASCADE,
  task          TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

-- ─── Compétences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT NOT NULL,   -- 'backend','frontend','databases'...
  item       TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ─── Projets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  title       TEXT    NOT NULL,
  category    TEXT,
  status      TEXT    DEFAULT 'completed',
  year        INTEGER,
  description TEXT,
  publication TEXT,
  role        TEXT,
  link_url    TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  r2_key     TEXT NOT NULL,      -- clé dans le bucket R2
  caption    TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ─── Publications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publications (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  venue      TEXT,
  year       INTEGER,
  role       TEXT,
  doi        TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ─── Langues ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS languages (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT    NOT NULL,
  level   TEXT,
  percent INTEGER DEFAULT 0
);

-- ─── Admin (sessions JWT) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- ============================================================
--  DONNÉES INITIALES
-- ============================================================

INSERT OR IGNORE INTO personal (id, name, title, subtitle, tagline, email, phone, location, github_url, linkedin_url)
VALUES (1,
  'Abdeldjalil Tedjini',
  'Ingénieur en Informatique',
  'Administration & Sécurité des Réseaux',
  'Je conçois et développe des systèmes fiables — de la sécurité réseau aux plateformes distribuées.',
  'tedjini.abdeldjalil@univ-ouargla.dz',
  '(+213)06.67.09.55.01',
  'Ouargla, Algeria',
  'https://github.com/your-github',
  'https://linkedin.com/in/your-handle'
);

INSERT OR IGNORE INTO education VALUES
  ('edu1','Master en Administration et Sécurité des Réseaux','Université Kasdi Merbah','Ouargla, Algérie','2022 – 2024','Spécialisation en sécurité des SI, protocoles réseaux, systèmes distribués.',0),
  ('edu2','Licence en Informatique','Université Kasdi Merbah','Ouargla, Algérie','2019 – 2022','Formation fondamentale en algorithmique, structures de données, bases de données.',1);

INSERT OR IGNORE INTO experience VALUES
  ('exp1','Ingénieur d'||char(39)||'État en Informatique','Direction du Logement','Ouargla','Oct. 2024 – Présent','CDI',0),
  ('exp2','Enseignant d'||char(39)||'Algorithmes','Institut Supérieur de Gestion','Ouargla','Nov. 2024 – Fév. 2025','Vacation',1),
  ('exp3','Assistant de Bureau','SARL HB Grand Service','Ouargla','Juil. 2024 – Oct. 2024','CDD',2),
  ('exp4','Stagiaire – EMRC','Algérie Télécom SPA','Ouargla','Fév. 2024','Stage',3),
  ('exp5','Stagiaire – DRT','Algérie Télécom SPA','Ouargla','Juil. 2023','Stage',4),
  ('exp6','Développeur Freelance','Indépendant','Ouargla','2021 – Présent','Freelance',5);

INSERT OR IGNORE INTO experience_tasks (experience_id, task, sort_order) VALUES
  ('exp1','Administration et maintenance des systèmes informatiques',0),
  ('exp1','Gestion de l'||char(39)||'infrastructure réseau LAN',1),
  ('exp1','Mise en place de solutions de sécurité informatique',2),
  ('exp2','Enseignement de l'||char(39)||'algorithmique et de la programmation',0),
  ('exp3','Support informatique et maintenance des équipements',0),
  ('exp6','Développement de sites web professionnels (service client, gestion scolaire, hôtellerie)',0),
  ('exp6','Création de logiciels de gestion (magasin, écoles, facturation)',1);

INSERT OR IGNORE INTO skills (category, item, sort_order) VALUES
  ('backend','C',0),('backend','Java',1),('backend','PHP',2),('backend','Python',3),
  ('frontend','HTML',0),('frontend','CSS',1),('frontend','JavaScript',2),('frontend','Bootstrap',3),
  ('databases','Oracle',0),('databases','MySQL',1),('databases','SQL Server',2),
  ('security','ISO/IEC 27001',0),('security','CIA Triad',1),('security','Pare-feu',2),('security','Kaspersky',3),('security','Bitdefender',4),
  ('networking','LAN',0),('networking','VPN',1),('networking','Configuration Réseaux',2),
  ('virtualization','VMware Workstation',0),('virtualization','Oracle VirtualBox',1),
  ('os','Linux (Kali)',0),('os','Windows',1),('os','Windows Server 2012',2),
  ('devops','GitHub',0),('devops','LaTeX',1),
  ('office','Word',0),('office','Excel',1),('office','PowerPoint',2),('office','Access',3),('office','Microsoft Project',4),
  ('soft','Travail en équipe',0),('soft','Résolution de problèmes',1),('soft','Communication',2),('soft','Adaptabilité',3);

INSERT OR IGNORE INTO projects VALUES
  ('proj1','Federated Learning – IDS avec Deep Neural Network','Recherche','completed',2025,'Approche d'||char(39)||'apprentissage fédéré basée sur les CNNs pour la détection des intrusions réseaux tout en garantissant la confidentialité des données.','IEEE Xplore – ISNIB 2025, Université de Biskra','Premier auteur','',0),
  ('proj2','FedAGGEnsemble – Détection du Paludisme','Recherche','completed',2025,'Combinaison de l'||char(39)||'apprentissage fédéré et de l'||char(39)||'apprentissage par ensemble pour améliorer la détection du paludisme.','IEEE Xplore – ISNIB 2025, Université de Biskra','Co-auteur','',1),
  ('proj3','Federated Learning – Détection d'||char(39)||'Intrusions IoT','Recherche','completed',2025,'Exploitation de l'||char(39)||'apprentissage fédéré avec des réseaux convolutionnels pour la détection d'||char(39)||'intrusions IoT.','PRZEGLĄD ELEKTROTECHNICZNY','Co-auteur','https://doi.org/10.15199/48.2025.09.21',2),
  ('proj4','Logiciel de Gestion de Magasin','Développement','completed',2023,'Application de gestion complète : inventaire, ventes, facturation et rapports.','','Développeur principal','',3),
  ('proj5','Plateforme de Gestion Scolaire','Développement Web','completed',2022,'Site web et logiciel de gestion pour écoles d'||char(39)||'éducation spécialisée.','','Développeur Full-Stack','',4),
  ('proj6','Système de Réservation Hôtelière','Développement Web','completed',2023,'Plateforme web de gestion d'||char(39)||'hôtel avec réservation en ligne.','','Développeur Full-Stack','',5);

INSERT OR IGNORE INTO project_tags (project_id, tag) VALUES
  ('proj1','Federated Learning'),('proj1','CNN'),('proj1','IDS'),('proj1','Python'),('proj1','IEEE'),
  ('proj2','Federated Learning'),('proj2','Ensemble Learning'),('proj2','Deep Learning'),('proj2','Python'),
  ('proj3','Federated Learning'),('proj3','IoT'),('proj3','IDS'),('proj3','CNN'),('proj3','Privacy'),
  ('proj4','Java'),('proj4','MySQL'),('proj4','Desktop App'),
  ('proj5','PHP'),('proj5','MySQL'),('proj5','HTML'),('proj5','CSS'),('proj5','JavaScript'),
  ('proj6','PHP'),('proj6','MySQL'),('proj6','Bootstrap'),('proj6','JavaScript');

INSERT OR IGNORE INTO publications VALUES
  ('pub1','A Federated Learning Approach for Intrusion Detection System using Deep Neural Network','IEEE Xplore – ISNIB 2025',2025,'Premier auteur','',0),
  ('pub2','FedAGGEnsemble: A Federated Ensemble Learning based Approach for Malaria Detection','IEEE Xplore – ISNIB 2025',2025,'Co-auteur','',1),
  ('pub3','Enhancing Federated Learning for Privacy Preserving Intrusion Detection in IoT networks','PRZEGLĄD ELEKTROTECHNICZNY',2025,'Co-auteur','10.15199/48.2025.09.21',2);

INSERT OR IGNORE INTO languages VALUES
  (1,'Arabe','Langue maternelle',100),
  (2,'Français','Intermédiaire',65),
  (3,'Anglais','Intermédiaire',60);
