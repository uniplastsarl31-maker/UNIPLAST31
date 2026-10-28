export const localMode = __LOCAL_BUILD__;
export const netlifyMode = __NETLIFY_BUILD__;
export const imageLimitMo = netlifyMode ? 4 : 5;
export const pdfLimitMo = netlifyMode ? 4 : 15;
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
  if (!response.ok) throw new Error(value?.error || "Opération impossible.");
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
