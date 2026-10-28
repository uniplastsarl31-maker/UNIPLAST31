/** Detect the bytes, including files whose browser MIME type is missing or nonstandard. */
export function detectFileType(bytes: Uint8Array): string | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}
export async function validatedFile(
  file: File,
  maxMo: number,
  allowPdf = false,
): Promise<File> {
  if (file.size > maxMo * 1024 * 1024)
    throw new Error(`Fichier trop volumineux : ${maxMo} Mo maximum.`);
  const type = detectFileType(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  if (!type || (type === "application/pdf" && !allowPdf))
    throw new Error(
      allowPdf
        ? "Choisissez un véritable fichier JPG, PNG, WebP ou PDF."
        : "Choisissez une véritable image JPG, PNG ou WebP. Renommer son extension ne suffit pas.",
    );
  return file.type === type
    ? file
    : new File([file], file.name, { type, lastModified: file.lastModified });
}
