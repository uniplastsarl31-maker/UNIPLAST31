import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export function barcodeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
  ]);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 100,
    delayBetweenScanSuccess: 500,
  });
}

export function cameraConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "environment" } }),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
}

export async function barcodeFromPhoto(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choisissez une photo de moins de 20 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const reader = barcodeReader();
    const image = new Image();
    image.src = url;
    await image.decode();
    // The scan engine reads horizontal bars. A phone photo can be rotated.
    const scale = Math.min(
      1,
      2400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.round(image.naturalWidth * scale),
      height = Math.round(image.naturalHeight * scale);
    for (const angle of [0, 90, 180, 270]) {
      const canvas = document.createElement("canvas");
      canvas.width = angle % 180 ? height : width;
      canvas.height = angle % 180 ? width : height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      try {
        return reader.decodeFromCanvas(canvas).getText();
      } catch {
        /* Try the next orientation. */
      }
    }
    throw new Error(
      "Code illisible. Photographiez le code entier, net et bien éclairé, ou saisissez ses chiffres.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
