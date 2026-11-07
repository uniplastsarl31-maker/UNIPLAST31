export const localMode = __LOCAL_BUILD__;
export const netlifyMode = __NETLIFY_BUILD__;
export const imageLimitMo = netlifyMode ? 4 : 5;
export const pdfLimitMo = 20;
export const videoLimitMo = 20;
const unavailable = () =>
  new Error(
    netlifyMode
      ? "Le service du magasin est momentanément indisponible. Réessayez dans quelques instants."
      : "Le service local est indisponible. Ouvrez le programme avec RUN.BAT.",
  );

async function parseResponse(response: Response) {
  let value;
  try {
    value = await response.json();
  } catch {
    throw unavailable();
  }
  if (!response.ok)
    throw Object.assign(new Error(value?.error || "Opération impossible."), {
      status: response.status,
    });
  return value;
}
export async function localCall<T = any>(
  name: string,
  payload?: unknown,
): Promise<T> {
  let response;
  try {
    response = await fetch(
      "/api/local/" + name,
      payload === undefined
        ? { credentials: "same-origin", cache: "no-store" }
        : {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
    );
  } catch {
    throw unavailable();
  }
  return (await parseResponse(response)) as T;
}
export async function localUpload(
  file: Blob,
  isPublic: boolean,
): Promise<string> {
  if (isPublic && (!file.type || file.type === "application/octet-stream")) {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...head.slice(start, end));
    const inferred =
      ascii(0, 5) === "%PDF-"
        ? "application/pdf"
        : ascii(4, 8) === "ftyp"
          ? "video/mp4"
          : head[0] === 0x1a &&
              head[1] === 0x45 &&
              head[2] === 0xdf &&
              head[3] === 0xa3
            ? "video/webm"
            : "";
    if (inferred) file = new Blob([file], { type: inferred });
  }
  if (
    isPublic &&
    ["application/pdf", "video/mp4", "video/webm"].includes(file.type)
  )
    return uploadLargePublicFile(file);
  const max =
    file.type === "application/pdf" && isPublic ? pdfLimitMo : imageLimitMo;
  if (file.size > max * 1024 * 1024)
    throw new Error(`La taille du fichier ne doit pas dépasser ${max} Mo.`);
  let response;
  try {
    response = await fetch(
      "/api/local/upload?public=" + (isPublic ? "1" : "0"),
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": file.type },
        body: file,
      },
    );
  } catch {
    throw unavailable();
  }
  return parseResponse(response);
}

// Each binary request stays below Netlify's per-request limit. The server commits
// immutable parts and publishes the file only after all parts have arrived.
async function uploadLargePublicFile(file: Blob): Promise<string> {
  const max = file.type === "application/pdf" ? pdfLimitMo : videoLimitMo;
  if (!file.size || file.size > max * 1024 * 1024)
    throw new Error(`Le fichier doit contenir de 1 octet à ${max} Mo.`);
  const request = async (name: string, payload: unknown, binary = false) => {
    let error: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("/api/local/" + name, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": binary
              ? "application/octet-stream"
              : "application/json",
          },
          body: binary ? (payload as Blob) : JSON.stringify(payload),
        });
        return await parseResponse(response);
      } catch (e) {
        error = e;
        const status = (e as Error & { status?: number }).status;
        if (status && ![408, 502, 503, 504].includes(status)) throw e;
        if (attempt < 2)
          await new Promise((resolve) =>
            window.setTimeout(resolve, 150 * (attempt + 1)),
          );
      }
    }
    throw error || unavailable();
  };
  const transfer = await request("upload-start", {
    mime: file.type,
    size: file.size,
    key: crypto.randomUUID(),
  });
  if (transfer.url) return transfer.url;
  if (
    !Number.isInteger(transfer.chunk_bytes) ||
    transfer.chunk_bytes < 1 ||
    transfer.chunk_bytes > 2 * 1024 * 1024
  )
    throw unavailable();
  const received = new Set<number>(transfer.received || []);
  for (
    let offset = 0, index = 0;
    offset < file.size;
    offset += transfer.chunk_bytes, index++
  ) {
    if (!received.has(index))
      await request(
        `upload-part?id=${encodeURIComponent(transfer.id)}&index=${index}`,
        file.slice(offset, offset + transfer.chunk_bytes),
        true,
      );
  }
  return request("upload-finish", { id: transfer.id });
}
