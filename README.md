# Portfolio Abdeldjalil Tedjini – Cloudflare Stack

## Architecture

```
Cloudflare Pages (public/)      ← Frontend statique
      ↕ fetch /api/*
Cloudflare Pages Functions      ← API backend (functions/)
      ↕
  D1 (SQL)    KV (cache)    R2 (images)
```

---

## Prérequis

- Compte Cloudflare (gratuit)
- Node.js ≥ 18 installé
- Wrangler CLI : `npm install -g wrangler`

---

## Déploiement étape par étape

### 1. Connexion Cloudflare

```bash
wrangler login
```

### 2. Créer la base D1

```bash
wrangler d1 create portfolio_db
```

Copiez le `database_id` affiché et collez-le dans `wrangler.toml` :
```toml
database_id = "VOTRE_ID_ICI"
```

### 3. Initialiser le schéma et les données

```bash
# En local (test)
wrangler d1 execute portfolio_db --local --file=sql/schema.sql

# En production
wrangler d1 execute portfolio_db --file=sql/schema.sql
```

### 4. Créer le KV namespace

```bash
wrangler kv:namespace create "KV"
```

Copiez l'id dans `wrangler.toml`.

### 5. Créer le bucket R2

```bash
wrangler r2 bucket create portfolio-images
```

### 6. Configurer les secrets (sécurité)

```bash
# Générer le hash du mot de passe admin
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('VotreMotDePasse').digest('hex'))"

# Stocker les secrets (ne jamais les mettre dans le code)
wrangler secret put ADMIN_PASSWORD_HASH
wrangler secret put JWT_SECRET
```

### 7. (Optionnel) Activer l'accès public R2

Dans le dashboard Cloudflare → R2 → portfolio-images → Settings → Public Access

Mettez à jour l'URL dans `functions/api/portfolio.js` :
```js
personal.photo_url = `https://pub-VOTRE_HASH.r2.dev/${personal.photo_key}`;
```

### 8. Déployer sur Cloudflare Pages

```bash
# Test local
wrangler pages dev public --d1=DB:portfolio_db --r2=R2:portfolio-images

# Déploiement production
wrangler pages deploy public
```

---

## Structure des fichiers

```
portfolio-cf/
├── wrangler.toml              ← Configuration Cloudflare
├── sql/
│   └── schema.sql             ← Schéma D1 + données initiales
├── functions/                 ← API backend (Pages Functions)
│   ├── _middleware.js         ← CORS global
│   ├── _auth.js               ← JWT (Web Crypto API)
│   └── api/
│       ├── portfolio.js       ← GET /api/portfolio (public)
│       ├── image/[key].js     ← GET /api/image/:key (R2)
│       └── admin/
│           ├── login.js       ← POST /api/admin/login
│           ├── data.js        ← CRUD /api/admin/data
│           └── upload.js      ← POST /api/admin/upload (R2)
└── public/                    ← Frontend statique
    ├── index.html
    ├── css/style.css
    ├── js/main.js
    └── admin/
        ├── index.html
        ├── admin.js
        └── admin.css
```

---

## API Reference

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/portfolio` | Non | Toutes les données publiques |
| GET | `/api/image/:key` | Non | Servir une image depuis R2 |
| POST | `/api/admin/login` | Non | Authentification → JWT |
| GET | `/api/admin/data?section=X` | JWT | Lire une section |
| POST | `/api/admin/data?section=X` | JWT | Ajouter un élément |
| PUT | `/api/admin/data?section=X&id=Y` | JWT | Modifier un élément |
| DELETE | `/api/admin/data?section=X&id=Y` | JWT | Supprimer un élément |
| POST | `/api/admin/upload` | JWT | Upload image → R2 |

Sections disponibles : `personal`, `experience`, `education`, `skills`, `projects`, `publications`

---

## Plan tarifaire Cloudflare (gratuit)

| Service | Limite gratuite |
|---------|----------------|
| Pages | Illimité de déploiements |
| D1 | 5 GB stockage, 5M req/jour |
| R2 | 10 GB stockage, 1M req/mois |
| Workers | 100K req/jour |

Largement suffisant pour un portfolio personnel.

---

## Sécurité

- Le mot de passe admin n'est **jamais** stocké en clair : SHA-256 hash dans les secrets Cloudflare
- Les tokens JWT sont signés avec HMAC-SHA256 via Web Crypto API
- Le token expire après **24h**
- CORS configuré via le middleware global
- Toutes les routes admin vérifient le JWT avant toute opération
