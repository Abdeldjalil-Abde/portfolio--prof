var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _auth.js
var ALG = { name: "HMAC", hash: "SHA-256" };
async function getKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), ALG, false, ["sign", "verify"]);
}
__name(getKey, "getKey");
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(b64url, "b64url");
function decodeB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
__name(decodeB64url, "decodeB64url");
async function signJWT(payload, secret, expiresInSec = 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const claims = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify(header)));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
__name(signJWT, "signJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const key = await getKey(secret);
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify(ALG, key, decodeB64url(sig), enc.encode(`${head}.${body}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeB64url(body)));
    if (claims.exp < Math.floor(Date.now() / 1e3)) return null;
    return claims;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  return await verifyJWT(token, env.JWT_SECRET || "default_dev_secret_change_me");
}
__name(requireAuth, "requireAuth");

// api/admin/login.js
async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const { password } = body;
  if (!password) return Response.json({ error: "Mot de passe requis" }, { status: 400 });
  const expectedHash = env.ADMIN_PASSWORD_HASH;
  if (!expectedHash) {
    if (password !== "admin123") {
      return Response.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }
  } else {
    const inputHash = await hashPassword(password);
    if (inputHash !== expectedHash) {
      return Response.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }
  }
  const secret = env.JWT_SECRET || "default_dev_secret_change_me";
  const token = await signJWT({ role: "admin" }, secret, 86400);
  return Response.json({ token, expiresIn: 86400 });
}
__name(onRequestPost, "onRequestPost");

// api/admin/upload.js
var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
var MAX_SIZE = 5 * 1024 * 1024;
async function onRequestPost2({ request, env }) {
  const user = await requireAuth(request, env);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  const context = formData.get("context");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Invalid file type (JPEG, PNG, WebP, GIF only)" },
      { status: 400 }
    );
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_SIZE) {
    return Response.json(
      { error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const key = `${context || "general"}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  await env.R2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type
    },
    customMetadata: {
      originalName: file.name,
      context
    }
  });
  if (context === "profile") {
    await env.DB.prepare(`
      UPDATE personal
      SET photo_key = ?, updated_at = datetime('now')
      WHERE id = 1
    `).bind(key).run();
  }
  if (context && context !== "profile") {
    await env.DB.prepare(`
      INSERT INTO project_images (project_id, r2_key, caption, sort_order)
      VALUES (?, ?, ?, ?)
    `).bind(context, key, "", 0).run();
  }
  const url = `/api/image/${encodeURIComponent(key)}`;
  return Response.json({
    success: true,
    key,
    url,
    size: buffer.byteLength,
    context
  });
}
__name(onRequestPost2, "onRequestPost");

// api/admin/data.js
function unauth() {
  return Response.json({ error: "Non autoris\xE9" }, { status: 401 });
}
__name(unauth, "unauth");
function bad(msg) {
  return Response.json({ error: msg }, { status: 400 });
}
__name(bad, "bad");
function ok(data) {
  return Response.json(data);
}
__name(ok, "ok");
function genId() {
  return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}
__name(genId, "genId");
async function onRequest({ request, env }) {
  const claims = await requireAuth(request, env);
  if (!claims) return unauth();
  const url = new URL(request.url);
  const section = url.searchParams.get("section");
  const method = request.method;
  const db = env.DB;
  if (!section) return bad('Param\xE8tre "section" manquant');
  try {
    if (method === "GET") return await handleGet(section, db, url);
    if (method === "POST") return await handlePost(section, db, await request.json());
    if (method === "PUT") return await handlePut(section, db, await request.json(), url);
    if (method === "DELETE") return await handleDelete(section, db, url);
    return Response.json({ error: "M\xE9thode non support\xE9e" }, { status: 405 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
__name(onRequest, "onRequest");
async function handleGet(section, db, url) {
  switch (section) {
    case "personal":
      return ok(await db.prepare("SELECT * FROM personal WHERE id=1").first());
    case "experience": {
      const exps = await db.prepare("SELECT * FROM experience ORDER BY sort_order").all();
      const tasks = await db.prepare("SELECT * FROM experience_tasks ORDER BY sort_order").all();
      return ok(exps.results.map((e) => ({
        ...e,
        tasks: tasks.results.filter((t) => t.experience_id === e.id).map((t) => t.task)
      })));
    }
    case "education":
      return ok((await db.prepare("SELECT * FROM education ORDER BY sort_order").all()).results);
    case "skills":
      return ok((await db.prepare("SELECT * FROM skills ORDER BY category,sort_order").all()).results);
    case "projects": {
      const projs = await db.prepare("SELECT * FROM projects ORDER BY sort_order").all();
      const tags = await db.prepare("SELECT * FROM project_tags").all();
      return ok(projs.results.map((p) => ({
        ...p,
        tags: tags.results.filter((t) => t.project_id === p.id).map((t) => t.tag)
      })));
    }
    case "publications":
      return ok((await db.prepare("SELECT * FROM publications ORDER BY sort_order").all()).results);
    default:
      return bad("Section inconnue");
  }
}
__name(handleGet, "handleGet");
async function handlePost(section, db, body) {
  const id = genId();
  switch (section) {
    case "experience": {
      await db.prepare(
        "INSERT INTO experience (id,role,company,location,period,type,sort_order) VALUES (?,?,?,?,?,?,?)"
      ).bind(id, body.role || "", body.company || "", body.location || "", body.period || "", body.type || "CDI", body.sort_order || 0).run();
      if (Array.isArray(body.tasks)) {
        for (let i = 0; i < body.tasks.length; i++) {
          await db.prepare("INSERT INTO experience_tasks (experience_id,task,sort_order) VALUES (?,?,?)").bind(id, body.tasks[i], i).run();
        }
      }
      return ok({ id, created: true });
    }
    case "education":
      await db.prepare("INSERT INTO education (id,degree,institution,location,period,details,sort_order) VALUES (?,?,?,?,?,?,?)").bind(id, body.degree || "", body.institution || "", body.location || "", body.period || "", body.details || "", body.sort_order || 0).run();
      return ok({ id, created: true });
    case "projects": {
      await db.prepare("INSERT INTO projects (id,title,category,status,year,description,publication,role,link_url,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, body.title || "", body.category || "", body.status || "completed", body.year || null, body.description || "", body.publication || "", body.role || "", body.link_url || "", body.sort_order || 0).run();
      if (Array.isArray(body.tags)) {
        for (const tag of body.tags) {
          await db.prepare("INSERT INTO project_tags (project_id,tag) VALUES (?,?)").bind(id, tag).run();
        }
      }
      return ok({ id, created: true });
    }
    case "publications":
      await db.prepare("INSERT INTO publications (id,title,venue,year,role,doi,sort_order) VALUES (?,?,?,?,?,?,?)").bind(id, body.title || "", body.venue || "", body.year || null, body.role || "", body.doi || "", body.sort_order || 0).run();
      return ok({ id, created: true });
    case "skills":
      await db.prepare("INSERT INTO skills (category,item,sort_order) VALUES (?,?,?)").bind(body.category || "", body.item || "", body.sort_order || 0).run();
      return ok({ created: true });
    default:
      return bad("Section inconnue");
  }
}
__name(handlePost, "handlePost");
async function handlePut(section, db, body, url) {
  const id = url.searchParams.get("id");
  switch (section) {
    case "personal":
      await db.prepare(`
        UPDATE personal SET name=?,title=?,subtitle=?,tagline=?,email=?,phone=?,location=?,github_url=?,linkedin_url=?,updated_at=datetime('now') WHERE id=1
      `).bind(body.name, body.title, body.subtitle, body.tagline, body.email, body.phone, body.location, body.github_url, body.linkedin_url).run();
      return ok({ updated: true });
    case "experience": {
      if (!id) return bad("id requis");
      await db.prepare("UPDATE experience SET role=?,company=?,location=?,period=?,type=? WHERE id=?").bind(body.role, body.company, body.location, body.period, body.type, id).run();
      await db.prepare("DELETE FROM experience_tasks WHERE experience_id=?").bind(id).run();
      if (Array.isArray(body.tasks)) {
        for (let i = 0; i < body.tasks.length; i++) {
          await db.prepare("INSERT INTO experience_tasks (experience_id,task,sort_order) VALUES (?,?,?)").bind(id, body.tasks[i], i).run();
        }
      }
      return ok({ updated: true });
    }
    case "education":
      if (!id) return bad("id requis");
      await db.prepare("UPDATE education SET degree=?,institution=?,location=?,period=?,details=? WHERE id=?").bind(body.degree, body.institution, body.location, body.period, body.details, id).run();
      return ok({ updated: true });
    case "projects": {
      if (!id) return bad("id requis");
      await db.prepare("UPDATE projects SET title=?,category=?,status=?,year=?,description=?,publication=?,role=?,link_url=? WHERE id=?").bind(body.title, body.category, body.status, body.year, body.description, body.publication, body.role, body.link_url, id).run();
      await db.prepare("DELETE FROM project_tags WHERE project_id=?").bind(id).run();
      if (Array.isArray(body.tags)) {
        for (const tag of body.tags) {
          await db.prepare("INSERT INTO project_tags (project_id,tag) VALUES (?,?)").bind(id, tag).run();
        }
      }
      return ok({ updated: true });
    }
    case "publications":
      if (!id) return bad("id requis");
      await db.prepare("UPDATE publications SET title=?,venue=?,year=?,role=?,doi=? WHERE id=?").bind(body.title, body.venue, body.year, body.role, body.doi, id).run();
      return ok({ updated: true });
    default:
      return bad("Section inconnue");
  }
}
__name(handlePut, "handlePut");
async function handleDelete(section, db, url) {
  const id = url.searchParams.get("id");
  if (!id) return bad("id requis");
  const tables = { experience: "experience", education: "education", projects: "projects", publications: "publications" };
  if (tables[section]) {
    await db.prepare(`DELETE FROM ${tables[section]} WHERE id=?`).bind(id).run();
    return ok({ deleted: true });
  }
  return bad("Section non supprimable");
}
__name(handleDelete, "handleDelete");

// api/image/[key].js
async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = decodeURIComponent(
    url.pathname.replace("/api/image/", "")
  );
  if (!key) {
    return new Response("Missing key", { status: 400 });
  }
  const object = await env.R2.get(key);
  if (!object) {
    return new Response("Image introuvable", { status: 404 });
  }
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.httpEtag
    }
  });
}
__name(onRequestGet, "onRequestGet");

// api/portfolio.js
async function onRequestGet2({ env }) {
  const db = env.DB;
  const [personal, education, experience, skills, projects, publications, languages] = await Promise.all([
    db.prepare("SELECT * FROM personal WHERE id = 1").first(),
    db.prepare("SELECT * FROM education ORDER BY sort_order").all(),
    db.prepare("SELECT * FROM experience ORDER BY sort_order").all(),
    db.prepare("SELECT * FROM skills ORDER BY category, sort_order").all(),
    db.prepare("SELECT * FROM projects ORDER BY sort_order").all(),
    db.prepare("SELECT * FROM publications ORDER BY sort_order").all(),
    db.prepare("SELECT * FROM languages ORDER BY id").all()
  ]);
  const expIds = experience.results.map((e) => `'${e.id}'`).join(",");
  const tasks = expIds.length ? await db.prepare(`SELECT * FROM experience_tasks WHERE experience_id IN (${expIds}) ORDER BY sort_order`).all() : { results: [] };
  const experienceWithTasks = experience.results.map((exp) => ({
    ...exp,
    tasks: tasks.results.filter((t) => t.experience_id === exp.id).map((t) => t.task)
  }));
  const projIds = projects.results.map((p) => `'${p.id}'`).join(",");
  let tags = { results: [] };
  let images = { results: [] };
  if (projIds.length) {
    [tags, images] = await Promise.all([
      db.prepare(`SELECT * FROM project_tags WHERE project_id IN (${projIds})`).all(),
      db.prepare(`SELECT * FROM project_images WHERE project_id IN (${projIds}) ORDER BY sort_order`).all()
    ]);
  }
  const projectsEnriched = projects.results.map((proj) => ({
    ...proj,
    tags: tags.results.filter((t) => t.project_id === proj.id).map((t) => t.tag),
    images: images.results.filter((i) => i.project_id === proj.id)
  }));
  const skillsGrouped = skills.results.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s.item);
    return acc;
  }, {});
  if (personal?.photo_key) {
    personal.photo_url = `/api/image/${encodeURIComponent(personal.photo_key)}`;
  }
  return Response.json({
    personal,
    education: education.results,
    experience: experienceWithTasks,
    skills: skillsGrouped,
    projects: projectsEnriched,
    publications: publications.results,
    languages: languages.results
  }, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}
__name(onRequestGet2, "onRequestGet");

// _middleware.js
async function onRequest2(context) {
  const { request, next } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  try {
    const response = await next();
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
__name(onRequest2, "onRequest");

// ../.wrangler/tmp/pages-RN1jfR/functionsRoutes-0.5514798582259387.mjs
var routes = [
  {
    routePath: "/api/admin/login",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/upload",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/data",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/image/:key",
    mountPath: "/api/image",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/portfolio",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest2],
    modules: []
  }
];

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-bzXtMs/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-bzXtMs/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.5478314508601541.mjs.map
