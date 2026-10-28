export const localMode = __LOCAL_BUILD__;
export async function localCall<T = any>(
  name: string,
  payload?: unknown,
): Promise<T> {
  const response = await fetch(
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
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      "Le service local est indisponible. Ouvrez le programme avec RUN.BAT.",
    );
  }
  if (!response.ok) throw new Error(value.error || "Opération impossible.");
  return value as T;
}
export async function localUpload(
  file: Blob,
  isPublic: boolean,
): Promise<string> {
  const response = await fetch(
    "/api/local/upload?public=" + (isPublic ? "1" : "0"),
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type },
      body: file,
    },
  );
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "Impossible de transférer le fichier.");
  return value;
}
