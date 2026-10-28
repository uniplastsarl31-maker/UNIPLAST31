import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import localStore from "./local-store.cjs";
import seed from "./generated/seed.json" with { type: "json" };

const DATABASE_KEY = "store.sqlite";
const MAX_BODY = 4 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const json = (status, value, extra = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });

async function readBody(request) {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}

function responseCollector() {
  return {
    statusCode: 200,
    headers: new Headers(),
    data: null,
    setHeader(name, value) {
      this.headers.set(name, String(value));
    },
    writeHead(status, headers) {
      this.statusCode = status;
      for (const [key, value] of Object.entries(headers))
        this.setHeader(key, value);
    },
    end(data) {
      this.data = data;
    },
    response() {
      return new Response(this.data, {
        status: this.statusCode,
        headers: this.headers,
      });
    },
  };
}

// Every invocation reads durable state. /tmp is only a disposable working copy.
// An ETag compare-and-swap commits the whole SQLite transaction, including stock,
// sessions and failed-login counters. A losing invocation retries from fresh state.
export function createNetlifyHandler({
  getStores,
  origins,
  setupKey,
  maxAttempts = 8,
  allowHttpForTests = false,
}) {
  const allowedOrigins = origins.filter((o) => {
    try {
      return (
        new URL(o).origin === o &&
        (o.startsWith("https://") ||
          (allowHttpForTests && o.startsWith("http://127.0.0.1:")))
      );
    } catch {
      return false;
    }
  });
  return async function handler(request, context = {}) {
    const url = new URL(request.url);
    if (!allowedOrigins.includes(url.origin))
      return json(403, { error: "Hôte refusé." });
    if (!url.pathname.startsWith("/api/local/"))
      return json(404, { error: "Service introuvable." });
    if (
      request.headers.has("origin") &&
      !allowedOrigins.includes(request.headers.get("origin"))
    )
      return json(403, { error: "Origine refusée." });
    if (!["GET", "POST"].includes(request.method))
      return json(
        405,
        { error: "Méthode non autorisée." },
        { Allow: "GET, POST" },
      );
    if (
      request.headers.has("sec-fetch-site") &&
      !["same-origin", "none"].includes(request.headers.get("sec-fetch-site"))
    )
      return json(403, { error: "Origine refusée." });
    const payload = await readBody(request);
    if (payload === null)
      return json(413, {
        error: "La taille du fichier ne doit pas dépasser 4 Mo.",
      });
    try {
      const stores = getStores(context);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const saved = await stores.state.getWithMetadata(DATABASE_KEY, {
          type: "arrayBuffer",
          consistency: "strong",
        });
        if (saved && !saved.etag) throw new Error("MissingDatabaseETag");
        if (request.method === "GET" && url.pathname === "/api/local/health")
          return json(200, {
            ok: true,
            storage: "netlify-blobs",
            initialized: !!saved,
          });
        const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "uniplast-netlify-"),
        );
        let store;
        const createdFiles = [];
        try {
          if (saved)
            fs.writeFileSync(
              path.join(directory, DATABASE_KEY),
              Buffer.from(saved.data),
            );
          store = localStore.createLocalStore({
            dataDir: directory,
            seedData: seed,
            hosting: {
              origins: allowedOrigins,
              setupKey,
              clientIp: context.ip || "unknown",
            },
            readUpload: async (id) => {
              if (!UUID.test(id)) return null;
              try {
                const data = await stores.files.get(id, {
                  type: "arrayBuffer",
                  consistency: "strong",
                });
                return data === null ? null : Buffer.from(data);
              } catch {
                const error = new Error("Stockage indisponible.");
                error.status = 500;
                throw error;
              }
            },
          });
          const req = Readable.from(payload.length ? [payload] : []);
          req.url = url.pathname + url.search;
          req.method = request.method;
          req.headers = {
            ...Object.fromEntries(request.headers),
            host: url.host,
          };
          req.socket = { remoteAddress: context.ip || "unknown" };
          const res = responseCollector();
          await store.handle(req, res);
          const changed = store.hasChanges();
          store.close();
          store = null;
          if (!changed) return res.response();
          const uploadDir = path.join(directory, "uploads");
          if (fs.existsSync(uploadDir)) {
            for (const id of fs.readdirSync(uploadDir)) {
              if (!UUID.test(id)) throw new Error("InvalidUploadID");
              const result = await stores.files.set(
                id,
                new Blob([fs.readFileSync(path.join(uploadDir, id))]),
                { onlyIfNew: true },
              );
              if (!result.modified) throw new Error("UploadIDCollision");
              createdFiles.push(id);
            }
          }
          const result = await stores.state.set(
            DATABASE_KEY,
            new Blob([fs.readFileSync(path.join(directory, DATABASE_KEY))]),
            saved ? { onlyIfMatch: saved.etag } : { onlyIfNew: true },
          );
          if (result.modified) return res.response();
          // A definite conflict cannot have committed references to these UUIDs.
          // On an unknown write outcome, leave the bytes intact for a retry.
          for (const id of createdFiles) await stores.files.delete(id);
        } finally {
          if (store) store.close();
          if (
            path.dirname(directory) === path.resolve(os.tmpdir()) &&
            path.basename(directory).startsWith("uniplast-netlify-")
          )
            fs.rmSync(directory, { recursive: true, force: true });
        }
        if (attempt + 1 < maxAttempts)
          await new Promise((r) =>
            setTimeout(
              r,
              Math.min(15 * 2 ** attempt, 200) + Math.random() * 25,
            ),
          );
      }
      return json(
        503,
        {
          error:
            "Le magasin est très sollicité. Réessayez dans quelques secondes.",
        },
        { "Retry-After": "2" },
      );
    } catch (error) {
      console.error("UNIPLAST storage unavailable", {
        requestId: context.requestId,
        code: error.code || error.name,
      });
      return json(
        503,
        {
          error:
            "Le service du magasin est momentanément indisponible. Réessayez dans quelques instants.",
        },
        { "Retry-After": "5" },
      );
    }
  };
}
