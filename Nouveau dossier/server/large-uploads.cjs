"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { once } = require("node:events");
const CHUNK_BYTES = 2 * 1024 * 1024;
const PDF_BYTES = 20 * 1024 * 1024;
const VIDEO_BYTES = 20 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const uploadUrl = (id) => "/api/local/file?id=" + id;

function createLargeUploads({
  get,
  put,
  all,
  db,
  dataDir,
  readUpload,
  body,
  reply,
  assert,
  admin,
  uid,
  nowISO,
}) {
  const jsonBody = async (req) => {
    assert(
      String(req.headers["content-type"] || "").startsWith("application/json"),
      "Format JSON requis.",
      415,
    );
    try {
      return JSON.parse((await body(req, 16384)).toString("utf8"));
    } catch (error) {
      if (error.status) throw error;
      assert(false, "Requête JSON invalide.");
    }
  };
  const ownSession = (id, s) => {
    assert(typeof id === "string" && UUID.test(id), "Transfert invalide.");
    const session = get("large-upload", id);
    assert(
      session && session.owner === s.owner,
      "Transfert inaccessible.",
      404,
    );
    assert(
      session.completed_id || Date.parse(session.expires_at) > Date.now(),
      "Ce transfert a expiré. Sélectionnez à nouveau le fichier.",
      410,
    );
    return session;
  };
  async function handle(req, address, s, res) {
    const name = address.pathname.split("/").pop();
    if (!["upload-start", "upload-part", "upload-finish"].includes(name))
      return false;
    assert(req.method === "POST", "Méthode non autorisée.", 405);
    admin(s);
    if (name === "upload-start") {
      const p = await jsonBody(req);
      assert(
        p && ["application/pdf", "video/mp4", "video/webm"].includes(p.mime),
        "Choisissez un PDF, MP4 ou WebM.",
      );
      const maximum = p.mime === "application/pdf" ? PDF_BYTES : VIDEO_BYTES;
      assert(
        Number.isSafeInteger(p.size) && p.size > 0 && p.size <= maximum,
        `Le fichier ne doit pas dépasser ${maximum / 1024 / 1024} Mo.`,
      );
      assert(
        typeof p.key === "string" && UUID.test(p.key),
        "Clé de transfert invalide.",
      );
      const previous = all("large-upload").find(
        (u) => u.owner === s.owner && u.key === p.key,
      );
      if (previous) {
        assert(
          previous.mime === p.mime && previous.size === p.size,
          "Cette clé appartient à un autre fichier.",
          409,
        );
        ownSession(previous.id, s);
        reply(res, {
          id: previous.id,
          chunk_bytes: CHUNK_BYTES,
          received: previous.parts
            .map((part, i) => (part ? i : -1))
            .filter((i) => i >= 0),
          url: previous.completed_id ? uploadUrl(previous.completed_id) : null,
        });
        return true;
      }
      assert(
        all("large-upload").filter(
          (u) =>
            u.owner === s.owner &&
            !u.completed_id &&
            Date.parse(u.expires_at) > Date.now(),
        ).length < 6,
        "Trop de transferts en cours. Terminez un fichier avant d’en ajouter un autre.",
        429,
      );
      const session = {
        id: uid(),
        key: p.key,
        owner: s.owner,
        mime: p.mime,
        size: p.size,
        parts: Array(Math.ceil(p.size / CHUNK_BYTES)).fill(null),
        created_at: nowISO(),
        expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
      };
      put("large-upload", session);
      reply(res, {
        id: session.id,
        chunk_bytes: CHUNK_BYTES,
        received: [],
        url: null,
      });
      return true;
    }
    if (name === "upload-part") {
      let session = ownSession(address.searchParams.get("id"), s);
      assert(!session.completed_id, "Le fichier est déjà terminé.", 409);
      const indexText = address.searchParams.get("index");
      assert(
        typeof indexText === "string" && /^\d+$/.test(indexText),
        "Numéro de partie invalide.",
      );
      const index = Number(indexText);
      assert(
        Number.isInteger(index) && index >= 0 && index < session.parts.length,
        "Numéro de partie invalide.",
      );
      const bytes = await body(req, CHUNK_BYTES);
      // Native RUN.BAT requests share one SQLite connection. Re-read after the
      // asynchronous body read so parallel parts cannot overwrite one another.
      session = ownSession(session.id, s);
      assert(!session.completed_id, "Le fichier est déjà terminé.", 409);
      const expected = Math.min(
        CHUNK_BYTES,
        session.size - index * CHUNK_BYTES,
      );
      assert(bytes.length === expected, "Partie de fichier incomplète.");
      const digest = sha256(bytes),
        old = session.parts[index];
      if (old) {
        assert(
          old.sha256 === digest && old.size === bytes.length,
          "Cette partie a déjà été envoyée avec un contenu différent.",
          409,
        );
        reply(res, { index, received: true });
        return true;
      }
      const id = uid();
      fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
      fs.writeFileSync(path.join(dataDir, "uploads", id), bytes, {
        flag: "wx",
      });
      // Chunks have no public uploads row. Only their final, validated manifest is readable.
      session.parts[index] = { id, size: bytes.length, sha256: digest };
      put("large-upload", session);
      reply(res, { index, received: true });
      return true;
    }
    const p = await jsonBody(req);
    let session = ownSession(p?.id, s);
    if (session.completed_id) {
      reply(res, uploadUrl(session.completed_id));
      return true;
    }
    assert(
      session.parts.length > 0 &&
        session.parts.every(Boolean) &&
        session.parts.reduce((sum, part) => sum + part.size, 0) ===
          session.size,
      "Le transfert n’est pas complet.",
    );
    const first = await readUpload(session.parts[0].id);
    session = ownSession(session.id, s);
    if (session.completed_id) {
      reply(res, uploadUrl(session.completed_id));
      return true;
    }
    assert(
      first &&
        first.length === session.parts[0].size &&
        sha256(first) === session.parts[0].sha256,
      "La première partie est inaccessible. Réessayez le transfert.",
    );
    const valid =
      (session.mime === "application/pdf" &&
        first.subarray(0, 5).toString() === "%PDF-") ||
      (session.mime === "video/mp4" &&
        first.length >= 12 &&
        first.subarray(4, 8).toString() === "ftyp") ||
      (session.mime === "video/webm" &&
        first.length >= 4 &&
        first.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));
    assert(
      valid,
      "Le contenu ne correspond pas au format PDF, MP4 ou WebM annoncé.",
    );
    const id = uid();
    put("large-file", {
      id,
      mime: session.mime,
      size: session.size,
      parts: session.parts,
      created_at: nowISO(),
    });
    db.prepare("INSERT INTO uploads VALUES(?,?,?,?)").run(
      id,
      session.mime,
      s.owner,
      1,
    );
    session.completed_id = id;
    put("large-upload", session);
    reply(res, uploadUrl(id));
    return true;
  }
  async function readFile(file, range, res) {
    const manifest = get("large-file", file.id);
    if (!manifest) return false;
    let start = 0,
      end = manifest.size - 1,
      partial = false;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(range));
      assert(
        match && (match[1] || match[2]),
        "Plage de lecture invalide.",
        416,
      );
      if (!match[1]) {
        const suffix = Number(match[2]);
        assert(
          Number.isSafeInteger(suffix) && suffix > 0,
          "Plage de lecture invalide.",
          416,
        );
        start = Math.max(0, manifest.size - suffix);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Number(match[2]);
      }
      assert(
        Number.isSafeInteger(start) &&
          Number.isSafeInteger(end) &&
          start >= 0 &&
          start < manifest.size &&
          end >= start,
        "Plage de lecture invalide.",
        416,
      );
      end = Math.min(end, manifest.size - 1, start + CHUNK_BYTES - 1);
      partial = true;
    }
    const headers = {
      "Content-Type": file.mime,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": file.public
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition":
        file.mime === "application/pdf"
          ? 'inline; filename="catalogue.pdf"'
          : "inline",
      ...(partial
        ? { "Content-Range": `bytes ${start}-${end}/${manifest.size}` }
        : {}),
    };
    const chunks = async function* () {
      let position = 0;
      for (const part of manifest.parts) {
        const partEnd = position + part.size - 1;
        if (partEnd >= start && position <= end) {
          const bytes = await readUpload(part.id);
          if (
            !bytes ||
            bytes.length !== part.size ||
            sha256(bytes) !== part.sha256
          )
            throw new Error("Une partie du fichier est inaccessible.");
          yield bytes.subarray(
            Math.max(0, start - position),
            Math.min(part.size, end - position + 1),
          );
        }
        position += part.size;
        if (position > end) break;
      }
    };
    res.writeHead(partial ? 206 : 200, headers);
    if (typeof res.stream === "function") res.stream(chunks());
    else {
      try {
        for await (const chunk of chunks())
          if (!res.write(chunk)) await once(res, "drain");
        res.end();
      } catch (error) {
        res.destroy(error);
      }
    }
    return true;
  }
  return { handle, readFile };
}
module.exports = { createLargeUploads, CHUNK_BYTES, PDF_BYTES, VIDEO_BYTES };
