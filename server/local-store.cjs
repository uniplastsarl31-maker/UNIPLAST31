"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const { defaultSettings } = require("./generated/defaults.cjs");
const {
  validateProduct,
  canBuy,
  cartTotals,
  discountPercent,
} = require("./generated/domain.cjs");
const digits = (value) =>
  String(value || "")
    .replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632)
    .replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 1776);
function phoneOf(value) {
  let p = digits(value).replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^0[567]\d{8}$/.test(p)) p = "+213" + p.slice(1);
  if (!/^\+?[1-9]\d{7,14}$/.test(p))
    throw new Error("Numéro de téléphone invalide.");
  return p;
}
async function hashSecret(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(value, salt, 32)).toString("hex");
}
async function verify(value, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const result = await scrypt(value, salt, 32);
  const target = Buffer.from(hash, "hex");
  return (
    result.length === target.length && crypto.timingSafeEqual(result, target)
  );
}
const fingerprint = (v) => crypto.createHash("sha256").update(v).digest("hex");
const uid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const assert = (condition, message, status = 400) => {
  if (!condition) {
    const e = new Error(message);
    e.status = status;
    throw e;
  }
};
const cleanText = (v, max, min = 0) => {
  assert(
    typeof v === "string" && v.trim().length >= min && v.length <= max,
    "Texte invalide ou trop long.",
  );
  return v.trim();
};

function createLocalStore({
  dataDir = path.join(__dirname, "..", ".uniplast-data"),
  seedPath,
  seedData,
  allowSetup = true,
  hosting = null,
  readUpload = (id) => fs.readFileSync(path.join(dataDir, "uploads", id)),
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "store.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS documents(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS codes(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,hash TEXT NOT NULL,enabled INTEGER NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,role TEXT NOT NULL,owner TEXT NOT NULL,version INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until_time INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,mime TEXT NOT NULL,owner TEXT NOT NULL,public INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS order_keys ON documents(kind,json_extract(body,'$.user_id'),json_extract(body,'$.idempotency_key')) WHERE kind IN ('order','request');`);
  const get = (kind, id) => {
    const r = db
      .prepare("SELECT body FROM documents WHERE kind=? AND id=?")
      .get(kind, id);
    return r ? JSON.parse(r.body) : null;
  };
  const all = (kind) =>
    db
      .prepare("SELECT body FROM documents WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((r) => JSON.parse(r.body));
  const put = (kind, value) =>
    db
      .prepare(
        "INSERT INTO documents(kind,id,body) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
      )
      .run(kind, String(value.id), JSON.stringify(value));
  const meta = (key) =>
    db.prepare("SELECT value FROM meta WHERE key=?").get(key)?.value;
  const setMeta = (key, value) =>
    db
      .prepare(
        "INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  if (!meta("seeded"))
    transaction(() => {
      const seed =
        seedData ||
        JSON.parse(
          fs.readFileSync(
            seedPath || path.join(__dirname, "generated/seed.json"),
            "utf8",
          ),
        );
      seed.products.forEach((p) => put("product", p));
      seed.families.forEach((f) => put("family", f));
      put("settings", defaultSettings);
      setMeta("seeded", "1");
    });
  const settings = () => ({ ...defaultSettings, ...get("settings", "true") });
  const setupToken = crypto.randomBytes(32).toString("hex");
  const cookieName = hosting ? "__Host-uniplast_session" : "uniplast_session";
  const cookieFlags = `HttpOnly; SameSite=Strict; Path=/${hosting ? "; Secure" : ""}`;
  const setupAvailable =
    allowSetup &&
    (!hosting ||
      (typeof hosting.setupKey === "string" &&
        hosting.setupKey.length >= 24 &&
        hosting.setupKey.length <= 256));
  const role = (req) => {
    const cookie = new RegExp(
      `(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`,
    ).exec(req.headers.cookie || "")?.[1];
    if (!cookie) return null;
    const s = db
      .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
      .get(fingerprint(cookie), Date.now());
    if (!s) return null;
    if (s.role === "client") {
      const c = db.prepare("SELECT * FROM codes WHERE id=?").get(s.owner);
      if (!c?.enabled || c.version !== s.version) return null;
      s.client = c;
    }
    return s;
  };
  const admin = (s) =>
    assert(s?.role === "admin", "Connexion administrateur nécessaire.", 403);
  function session(res, roleName, owner, version = 1) {
    const token = crypto.randomBytes(32).toString("hex"),
      age = roleName === "admin" ? 28800 : 2592000;
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?)").run(
      fingerprint(token),
      roleName,
      owner,
      version,
      Date.now() + age * 1000,
    );
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${token}; ${cookieFlags}; Max-Age=${age}`,
    );
  }
  function limit(keys, max = 5, window = 900000) {
    for (const k of keys) {
      const a = db.prepare("SELECT * FROM attempts WHERE key=?").get(k);
      assert(
        !a || a.until_time <= Date.now() || a.count < max,
        "Trop de tentatives. Réessayez dans 15 minutes.",
        429,
      );
    }
    return {
      fail: () => {
        for (const k of keys)
          db.prepare(
            `INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until_time<? THEN 1 ELSE count+1 END,until_time=CASE WHEN until_time<? THEN excluded.until_time ELSE until_time END`,
          ).run(k, Date.now() + window, Date.now(), Date.now());
      },
      clear: () => {
        for (const k of keys)
          db.prepare("DELETE FROM attempts WHERE key=?").run(k);
      },
    };
  }
  const prices = (s) =>
    s?.role === "admin" ||
    s?.role === "client" ||
    settings().price_visibility === "public";
  const clientView = (c) => ({
    user_id: c.id,
    name: c.name,
    phone: c.phone,
    status: c.enabled ? "approved" : "revoked",
    created_at: c.created_at,
  });
  const snapCompany = (s) =>
    Object.fromEntries(
      [
        "company_name",
        "logo_url",
        "phone",
        "email",
        "address",
        "tax_note",
        "timezone",
      ].map((k) => [k, s[k]]),
    );
  const customer = (c, full = true) => ({
    name: cleanText(c?.name, 150, 2),
    phone: phoneOf(c?.phone),
    wilaya: cleanText(c?.wilaya || "", 100, full ? 2 : 0),
    address: cleanText(c?.address || "", 500, full ? 5 : 0),
    notes: cleanText(c?.notes || "", 2000),
    ...(c?.email ? { email: cleanText(c.email, 254) } : {}),
  });
  async function body(req, max = 1024 * 1024) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      assert(size <= max, "Fichier trop volumineux.", 413);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  const reply = (res, value, status = 200) => {
    const payload = JSON.stringify(value ?? null);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(payload);
  };
  async function handle(req, res) {
    const address = new URL(req.url || "/", "http://127.0.0.1");
    if (!address.pathname.startsWith("/api/local/")) return false;
    try {
      assert(
        hosting
          ? hosting.origins.some((o) => new URL(o).host === req.headers.host)
          : /^127\.0\.0\.1:\d+$/.test(req.headers.host || ""),
        "Hôte refusé.",
        403,
      );
      const origin = "http://" + req.headers.host;
      if (req.headers.origin)
        assert(
          hosting
            ? hosting.origins.includes(req.headers.origin)
            : req.headers.origin === origin,
          "Origine refusée.",
          403,
        );
      assert(
        !req.headers["sec-fetch-site"] ||
          ["same-origin", "none"].includes(req.headers["sec-fetch-site"]),
        "Origine refusée.",
        403,
      );
      const name = address.pathname.slice(11),
        s = role(req),
        ip = hosting?.clientIp || req.socket.remoteAddress || "local";
      if (req.method === "GET" && name === "status") {
        if (!s) session(res, "guest", uid());
        return (
          reply(res, {
            admin: s?.role === "admin",
            setup_required: !meta("admin"),
            setup_token: !hosting && !meta("admin") ? setupToken : undefined,
            setup_key_required: !!hosting && !meta("admin"),
            setup_available: setupAvailable,
            session: {
              email: "",
              personal: s?.role === "client",
              guest: !s || s.role === "guest",
              access: s?.client ? clientView(s.client) : null,
            },
          }),
          true
        );
      }
      if (req.method === "GET" && name === "catalog") {
        const isAdmin = s?.role === "admin",
          allowed = prices(s),
          families = all("family")
            .filter((f) => isAdmin || f.visible)
            .sort((a, b) => a.sort_order - b.sort_order);
        const products = all("product")
          .filter((p) => isAdmin || families.some((f) => f.id === p.family_id))
          .map((p) => {
            if (!isAdmin) delete p.source_metadata;
            delete p.public_discount_percent;
            delete p.price_hidden;
            if (!allowed) {
              p.public_discount_percent = discountPercent(p);
              p.price_hidden = true;
              p.unit_price_cents = 0;
              p.discount_price_cents = null;
            }
            return p;
          });
        const sales = {};
        for (const o of all("order").filter((o) =>
          ["confirmed", "preparing", "delivered"].includes(o.status),
        ))
          for (const i of o.items)
            sales[i.product_id] = (sales[i.product_id] || 0) + i.cartons;
        return (
          reply(res, { products, families, settings: settings(), sales }),
          true
        );
      }
      if (req.method === "GET" && name === "file") {
        const id = address.searchParams.get("id"),
          file = db.prepare("SELECT * FROM uploads WHERE id=?").get(id);
        assert(
          file &&
            (file.public || s?.role === "admin" || s?.owner === file.owner),
          "Fichier inaccessible.",
          404,
        );
        const content = await readUpload(file.id);
        assert(content, "Fichier inaccessible.", 404);
        res.writeHead(200, {
          "Content-Type": file.mime,
          "Content-Length": content.length,
          "Cache-Control": file.public
            ? "public, max-age=3600"
            : "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition":
            file.mime === "application/pdf"
              ? 'inline; filename="catalogue.pdf"'
              : "inline",
        });
        res.end(content);
        return true;
      }
      assert(req.method === "POST", "Méthode non autorisée.", 405);
      if (name === "upload") {
        const type = String(req.headers["content-type"] || "").split(";")[0],
          isPublic = address.searchParams.get("public") === "1";
        if (isPublic) admin(s);
        else assert(s, "Connectez-vous avant de joindre un fichier.", 403);
        const bytes = await body(
          req,
          hosting
            ? 4 * 1024 * 1024
            : isPublic && type === "application/pdf"
              ? 15 * 1024 * 1024
              : 5 * 1024 * 1024,
        );
        const valid =
          (type === "application/pdf" &&
            bytes.subarray(0, 5).toString() === "%PDF-") ||
          (type === "image/png" &&
            bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (type === "image/jpeg" &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255) ||
          (type === "image/webp" &&
            bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP");
        assert(valid, "Format du fichier invalide.");
        const quota = db
          .prepare("SELECT count(*) n FROM uploads WHERE owner=? AND public=0")
          .get(s?.owner || "").n;
        assert(isPublic || quota < 40, "Limite de pièces jointes atteinte.");
        const id = uid();
        fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
        fs.writeFileSync(path.join(dataDir, "uploads", id), bytes, {
          flag: "wx",
        });
        db.prepare("INSERT INTO uploads VALUES(?,?,?,?)").run(
          id,
          type,
          s.owner,
          isPublic ? 1 : 0,
        );
        reply(res, "/api/local/file?id=" + id);
        return true;
      }
      assert(
        req.headers["content-type"]?.startsWith("application/json"),
        "Format JSON requis.",
        415,
      );
      let p;
      try {
        p = JSON.parse((await body(req)).toString("utf8"));
      } catch (e) {
        if (e.status) throw e;
        throw new Error("Requête JSON invalide.");
      }
      let result = null;
      switch (name) {
        case "setup": {
          assert(
            setupAvailable && !meta("admin"),
            "Initialisation indisponible.",
            403,
          );
          if (hosting) {
            const l = limit(["setup:" + ip]);
            l.fail();
            assert(
              typeof p.setup_key === "string" &&
                p.setup_key.length <= 256 &&
                crypto.timingSafeEqual(
                  Buffer.from(fingerprint(p.setup_key), "hex"),
                  Buffer.from(fingerprint(hosting.setupKey), "hex"),
                ),
              "Clé d’installation incorrecte.",
              403,
            );
            l.clear();
          } else
            assert(p.token === setupToken, "Initialisation indisponible.", 403);
          assert(
            typeof p.password === "string" &&
              p.password.length >= 12 &&
              p.password.length <= 128,
            "Choisissez un mot de passe de 12 à 128 caractères.",
          );
          const hash = await hashSecret(p.password);
          assert(!meta("admin"), "Administrateur déjà configuré.", 409);
          setMeta("admin", hash);
          session(res, "admin", "admin");
          break;
        }
        case "admin-login": {
          const l = limit(["admin", "ip:" + ip]);
          l.fail();
          assert(
            typeof p.password === "string" &&
              p.password.length <= 128 &&
              (await verify(p.password, meta("admin"))),
            "Mot de passe incorrect.",
            401,
          );
          l.clear();
          session(res, "admin", "admin");
          break;
        }
        case "admin-password": {
          admin(s);
          const l = limit(["admin-password", "ip:" + ip]);
          l.fail();
          assert(
            typeof p.current === "string" &&
              p.current.length <= 128 &&
              (await verify(p.current, meta("admin"))),
            "Mot de passe actuel incorrect.",
            401,
          );
          assert(
            typeof p.password === "string" &&
              p.password.length >= 12 &&
              p.password.length <= 128,
            "Utilisez 12 à 128 caractères.",
          );
          setMeta("admin", await hashSecret(p.password));
          db.prepare("DELETE FROM sessions WHERE role='admin'").run();
          session(res, "admin", "admin");
          l.clear();
          break;
        }
        case "client-login": {
          const phone = phoneOf(p.phone),
            pin = digits(p.pin);
          const l = limit(["phone:" + fingerprint(phone), "ip:" + ip]);
          l.fail();
          const c = db.prepare("SELECT * FROM codes WHERE phone=?").get(phone);
          const hash = c?.hash || meta("admin");
          const ok = /^\d{6}$/.test(pin) && (await verify(pin, hash));
          assert(c?.enabled && ok, "Téléphone ou code incorrect.", 401);
          l.clear();
          if (s?.role === "guest")
            transaction(() => {
              for (const kind of ["order", "request"])
                for (const doc of all(kind).filter(
                  (d) => d.user_id === s.owner,
                ))
                  put(kind, { ...doc, user_id: c.id });
              db.prepare("UPDATE uploads SET owner=? WHERE owner=?").run(
                c.id,
                s.owner,
              );
              db.prepare("DELETE FROM sessions WHERE token=?").run(s.token);
            });
          session(res, "client", c.id, c.version);
          break;
        }
        case "logout":
          db.prepare("DELETE FROM sessions WHERE token=?").run(s?.token || "");
          res.setHeader(
            "Set-Cookie",
            `${cookieName}=; ${cookieFlags}; Max-Age=0`,
          );
          break;
        case "codes-list":
          admin(s);
          result = db
            .prepare(
              "SELECT id,name,phone,enabled,created_at FROM codes ORDER BY created_at DESC",
            )
            .all()
            .map(clientView);
          break;
        case "codes-save": {
          admin(s);
          const old = p.id
              ? db.prepare("SELECT * FROM codes WHERE id=?").get(p.id)
              : null,
            phone = phoneOf(p.phone),
            name = cleanText(p.name, 150, 2),
            pin = digits(p.pin),
            id = old?.id || uid();
          assert(
            old || /^\d{6}$/.test(pin),
            "Le code doit contenir exactement 6 chiffres.",
          );
          assert(
            !pin || /^\d{6}$/.test(pin),
            "Le code doit contenir exactement 6 chiffres.",
          );
          const hash = pin ? await hashSecret(pin) : old.hash,
            version = (old?.version || 0) + 1;
          try {
            db.prepare(
              "INSERT INTO codes VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,hash=excluded.hash,enabled=excluded.enabled,version=excluded.version",
            ).run(
              id,
              name,
              phone,
              hash,
              p.enabled ? 1 : 0,
              version,
              old?.created_at || nowISO(),
            );
          } catch (e) {
            if (String(e).includes("UNIQUE"))
              throw new Error("Ce téléphone est déjà attribué.");
            throw e;
          }
          db.prepare(
            "DELETE FROM sessions WHERE owner=? AND role='client'",
          ).run(id);
          result = { id };
          break;
        }
        case "product-save": {
          admin(s);
          const e = validateProduct(p);
          assert(!e, e);
          assert(get("family", p.family_id), "Collection introuvable.");
          assert(
            !all("product").some(
              (x) =>
                x.id !== p.id &&
                (x.code.toLowerCase() === p.code.toLowerCase() ||
                  (p.barcode && x.barcode === p.barcode)),
            ),
            "Référence ou code-barres déjà utilisé.",
          );
          delete p.price_hidden;
          delete p.public_discount_percent;
          delete p.demo;
          put("product", p);
          break;
        }
        case "product-delete":
          admin(s);
          db.prepare("DELETE FROM documents WHERE kind='product' AND id=?").run(
            p.id,
          );
          break;
        case "family-save":
          admin(s);
          cleanText(p.name, 150, 1);
          validateSlides(p.slides || [], p.slider_height || 380);
          put("family", p);
          break;
        case "family-delete":
          admin(s);
          transaction(() => {
            const products = all("product").filter((x) => x.family_id === p.id);
            assert(
              !products.length ||
                (p.target !== p.id && get("family", p.target)),
              "Choisissez une collection de destination.",
            );
            products.forEach((x) =>
              put("product", { ...x, family_id: p.target }),
            );
            db.prepare(
              "DELETE FROM documents WHERE kind='family' AND id=?",
            ).run(p.id);
          });
          break;
        case "family-reorder":
          admin(s);
          transaction(() => {
            const families = all("family");
            assert(
              Array.isArray(p.ids) &&
                new Set(p.ids).size === families.length &&
                p.ids.length === families.length &&
                families.every((f) => p.ids.includes(f.id)),
              "Ordre invalide.",
            );
            families.forEach((f) =>
              put("family", { ...f, sort_order: p.ids.indexOf(f.id) }),
            );
          });
          break;
        case "settings-save": {
          admin(s);
          assert(
            ["public", "approved"].includes(p.price_visibility),
            "Visibilité invalide.",
          );
          assert(
            Number.isSafeInteger(p.shipping_cents) &&
              p.shipping_cents >= 0 &&
              p.shipping_cents <= 100000000 &&
              /^[A-Z]{3}$/.test(p.currency),
            "Devise ou frais invalides.",
          );
          validateSlides(p.heroes, p.home_slider_height);
          assert(
            Number.isInteger(p.slider_interval) &&
              p.slider_interval >= 3 &&
              p.slider_interval <= 20,
            "Intervalle de 3 à 20 secondes.",
          );
          cleanText(p.about_title, 200, 1);
          cleanText(p.about_body, 10000, 1);
          assert(
            Array.isArray(p.seasons) &&
              p.seasons.length <= 20 &&
              p.seasons.every(
                (x) =>
                  x.title &&
                  /^\d{4}-\d{2}-\d{2}$/.test(x.starts_on) &&
                  x.starts_on <= x.ends_on,
              ),
            "Sélection saisonnière invalide.",
          );
          for (const k of ["primary_color", "accent_color"])
            assert(/^#[0-9a-f]{6}$/i.test(p[k]), "Couleur invalide.");
          new Intl.DateTimeFormat("fr", { timeZone: p.timezone }).format();
          for (const k of ["website_url", "facebook_url", "catalog_pdf_url"])
            if (p[k])
              assert(safeUrl(p[k]), "Lien HTTPS ou fichier du magasin requis.");
          put("settings", { ...p, id: true });
          break;
        }
        case "orders-list":
          if (p.admin) admin(s);
          result = s
            ? all("order").filter(
                (o) => s.role === "admin" || o.user_id === s.owner,
              )
            : [];
          break;
        case "order-create": {
          assert(
            prices(s) && s,
            "Connectez-vous avec votre téléphone et votre code pour commander.",
            403,
          );
          result = transaction(() => {
            assert(
              typeof p.key === "string" && /^[a-f0-9-]{36}$/i.test(p.key),
              "Clé invalide.",
            );
            const old = all("order").find(
              (o) => o.user_id === s.owner && o.idempotency_key === p.key,
            );
            if (old) return old;
            const throttle = limit(["order:" + s.owner], 5, 60000);
            throttle.fail();
            const c = customer(p.customer),
              sett = settings();
            assert(
              Array.isArray(p.cart) &&
                p.cart.length > 0 &&
                p.cart.length <= 100 &&
                new Set(p.cart.map((i) => i.product_id)).size === p.cart.length,
              "Panier invalide.",
            );
            const products = p.cart.map((i) => {
              const item = get("product", i.product_id);
              assert(
                item && canBuy(item) && get("family", item.family_id)?.visible,
                "Un produit est indisponible.",
              );
              assert(
                Number.isInteger(i.cartons) &&
                  i.cartons >= 1 &&
                  i.cartons <= 10000 &&
                  (item.stock_cartons === null ||
                    item.stock_cartons >= i.cartons),
                "Quantité indisponible.",
              );
              return item;
            });
            const totals = cartTotals(p.cart, products, sett.shipping_cents);
            assert(
              p.currency === sett.currency &&
                p.shipping === sett.shipping_cents &&
                totals.lines.every((i) =>
                  p.expected.some(
                    (x) =>
                      x.product_id === i.product_id &&
                      x.unit_price_cents === i.unit_price_cents &&
                      x.pack_size === i.pack_size,
                  ),
                ),
              "Les tarifs ont changé. Actualisez le panier.",
            );
            assert(
              Number.isSafeInteger(totals.total) &&
                totals.total <= 100000000000,
              "Total trop élevé.",
            );
            const order = {
              id: uid(),
              reference:
                "UNI-" +
                new Date().getFullYear() +
                "-" +
                String(all("order").length + 1).padStart(6, "0"),
              user_id: s.owner,
              created_at: nowISO(),
              status: "new",
              customer: c,
              items: totals.lines,
              subtotal_cents: totals.subtotal,
              discount_cents: totals.discount,
              shipping_cents: totals.shipping,
              total_cents: totals.total,
              currency: sett.currency,
              company_snapshot: snapCompany(sett),
              stock_reserved_ids: products
                .filter((item) => item.stock_cartons !== null)
                .map((item) => item.id),
              idempotency_key: p.key,
            };
            products.forEach((item) => {
              if (item.stock_cartons !== null)
                put("product", {
                  ...item,
                  stock_cartons:
                    item.stock_cartons -
                    p.cart.find((i) => i.product_id === item.id).cartons,
                });
            });
            put("order", order);
            return order;
          });
          break;
        }
        case "order-status":
          admin(s);
          transaction(() => {
            const o = get("order", p.id);
            assert(o, "Commande introuvable.");
            const transitions = {
              new: ["confirmed", "cancelled"],
              confirmed: ["preparing", "cancelled"],
              preparing: ["delivered", "cancelled"],
              delivered: [],
              cancelled: [],
            };
            assert(
              o.status === p.status ||
                transitions[o.status]?.includes(p.status),
              "Transition de statut interdite.",
            );
            if (o.status !== p.status && p.status === "cancelled")
              o.items.forEach((i) => {
                const prod = get("product", i.product_id);
                if (
                  prod &&
                  prod.stock_cartons !== null &&
                  o.stock_reserved_ids?.includes(i.product_id)
                )
                  put("product", {
                    ...prod,
                    stock_cartons: prod.stock_cartons + i.cartons,
                  });
              });
            put("order", { ...o, status: p.status });
          });
          break;
        case "requests-list":
          admin(s);
          result = all("request");
          break;
        case "request-create": {
          assert(s, "Connectez-vous pour envoyer votre projet.", 403);
          const l = limit(["request:" + s.owner], 5, 60000);
          const old = all("request").find(
            (r) => r.user_id === s.owner && r.idempotency_key === p.key,
          );
          if (old) {
            result = old;
            break;
          }
          l.fail();
          const r = p.request;
          assert(
            ["preorder", "custom"].includes(r.kind),
            "Type de demande invalide.",
          );
          r.customer = customer(r.customer, r.kind === "preorder");
          if (r.kind === "preorder") {
            const product = get("product", r.product_id);
            assert(
              product?.upcoming &&
                product.preorder_enabled &&
                get("family", product.family_id)?.visible,
              "Réservation non ouverte.",
            );
            assert(
              Number.isInteger(r.cartons) &&
                r.cartons >= 1 &&
                r.cartons <= 10000,
              "Quantité invalide.",
            );
            r.details = {
              ...r.details,
              product_name: product.name,
              product_code: product.code,
              pack_size: product.pack_size,
            };
          } else {
            r.cartons = 0;
            r.product_id = null;
            cleanText(r.details?.description, 5000, 10);
            cleanText(r.details?.quantity, 100, 1);
          }
          assert(
            r.details && Buffer.byteLength(JSON.stringify(r.details)) <= 30000,
            "Détails trop longs.",
          );
          assert(
            Array.isArray(r.details?.attachments) &&
              r.details.attachments.length <= 4,
            "Quatre pièces jointes au maximum.",
          );
          for (const ref of r.details.attachments) {
            const id = new URL(ref, "http://127.0.0.1").searchParams.get("id");
            assert(
              db
                .prepare(
                  "SELECT id FROM uploads WHERE id=? AND owner=? AND public=0",
                )
                .get(id, s.owner),
              "Pièce jointe inaccessible.",
            );
          }
          result = {
            ...r,
            id: uid(),
            reference:
              "REQ-" + String(all("request").length + 1).padStart(6, "0"),
            user_id: s.owner,
            created_at: nowISO(),
            status: "pending",
            idempotency_key: p.key,
          };
          put("request", result);
          break;
        }
        case "request-status":
          admin(s);
          {
            const r = get("request", p.id);
            assert(
              r &&
                ["pending", "reviewing", "accepted", "declined"].includes(
                  p.status,
                ),
              "Statut invalide.",
            );
            put("request", { ...r, status: p.status });
          }
          break;
        case "feedback-create": {
          const l = limit(["feedback:" + ip], 3, 60000);
          l.fail();
          const record = {
            id: uid(),
            name: cleanText(p.name || "", 150),
            phone: p.phone ? phoneOf(p.phone) : "",
            message: cleanText(p.message, 3000, 10),
            status: "new",
            created_at: nowISO(),
          };
          put("feedback", record);
          result = { ok: true };
          break;
        }
        case "feedback-list":
          admin(s);
          result = all("feedback");
          break;
        case "feedback-status":
          admin(s);
          {
            const r = get("feedback", p.id);
            assert(
              r && ["new", "read", "archived"].includes(p.status),
              "Statut invalide.",
            );
            put("feedback", { ...r, status: p.status });
          }
          break;
        default:
          assert(false, "Service introuvable.", 404);
      }
      reply(res, result);
      return true;
    } catch (e) {
      reply(
        res,
        {
          error:
            e.status === 500
              ? hosting
                ? "Erreur du stockage en ligne."
                : "Erreur du stockage local."
              : e.message || "Opération impossible.",
        },
        e.status || 400,
      );
      return true;
    }
  }
  return {
    handle,
    hasChanges: () => db.prepare("SELECT total_changes() AS n").get().n > 0,
    close: () => {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.close();
    },
    dataDir,
  };
}
function safeUrl(value) {
  if (/^\/api\/local\/file\?id=[a-f0-9-]{36}$/.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
function validateSlides(slides, height) {
  assert(
    Array.isArray(slides) &&
      slides.length <= 12 &&
      Number.isInteger(height) &&
      height >= 260 &&
      height <= 760,
    "Le diaporama accepte 12 images et une hauteur de 260 à 760 px.",
  );
  for (const h of slides) {
    cleanText(h.title, 200, 1);
    cleanText(h.body || "", 1500);
    assert(
      h.scale === undefined ||
        (Number.isFinite(h.scale) && h.scale >= 0.5 && h.scale <= 2),
      "Zoom invalide.",
    );
    assert(
      !h.image || h.image.startsWith("/assets/") || safeUrl(h.image),
      "Image invalide.",
    );
  }
}
module.exports = { createLocalStore, phoneOf };
