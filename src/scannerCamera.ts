export interface ScannerDecodeControls {
  stop: () => void | Promise<void>;
}

export interface ScannerCameraOptions {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  decode: (
    video: HTMLVideoElement,
    onCode: (value: string) => void,
  ) => Promise<ScannerDecodeControls>;
  onPreview: (stream: MediaStream) => void;
  onCode: (value: string) => void;
  deviceId?: string;
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

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function stopDecoder(controls: ScannerDecodeControls | null) {
  if (!controls) return;
  try {
    void Promise.resolve(controls.stop()).catch(() => {});
  } catch {
    // A failed decoder cleanup must not keep the camera running.
  }
}

function cancelled() {
  return new DOMException("Lecture annulée.", "AbortError");
}

/** Starts permission acquisition synchronously, before loading the decoder. */
export function startScannerCamera(
  video: HTMLVideoElement,
  options: ScannerCameraOptions,
) {
  let active = true,
    found = false,
    stream: MediaStream | null = null,
    controls: ScannerDecodeControls | null = null;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  const stop = () => {
    active = false;
    stopDecoder(controls);
    controls = null;
    stopTracks(stream);
    if (stream && video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
    }
    stream = null;
  };
  const ready = (async () => {
    try {
      const attempts: MediaStreamConstraints[] = [
        cameraConstraints(options.deviceId),
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        { audio: false, video: true },
      ];
      for (let index = 0; index < attempts.length; index++) {
        if (!active) throw cancelled();
        try {
          const acquired = await options.getUserMedia(attempts[index]);
          if (!active) {
            stopTracks(acquired);
            throw cancelled();
          }
          stream = acquired;
          break;
        } catch (error) {
          if (!active) throw cancelled();
          const name = (error as Error)?.name;
          if (
            index === attempts.length - 1 ||
            ![
              "OverconstrainedError",
              "ConstraintNotSatisfiedError",
              "NotFoundError",
              "DevicesNotFoundError",
            ].includes(name)
          )
            throw error;
        }
      }
      if (!active || !stream) throw cancelled();
      video.srcObject = stream;
      options.onPreview(stream);
      // Safari requires an inline, muted video; keep the real play error.
      try {
        await video.play();
      } catch (cause) {
        if (!active) throw cancelled();
        const error = new Error("L’aperçu de la caméra ne démarre pas.", {
          cause,
        });
        error.name = "VideoPlaybackError";
        throw error;
      }
      if (!active) throw cancelled();
      const decoder = await options.decode(video, (value) => {
        if (!active || found) return;
        found = true;
        options.onCode(value);
      });
      if (!active) {
        stopDecoder(decoder);
        return false;
      }
      controls = decoder;
      return true;
    } catch (error) {
      stop();
      throw error;
    }
  })();
  return { ready, stop, getStream: () => stream };
}

export type ScannerCameraCapture = ReturnType<typeof startScannerCamera>;

export function scannerCameraMessage(error: unknown) {
  const name = (error as Error | null)?.name;
  if (name === "VideoPlaybackError")
    return "La caméra est autorisée, mais l’aperçu vidéo ne démarre pas. Fermez ce lecteur puis réessayez dans Chrome ou Safari, ou utilisez une photo du code.";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  )
    return "Caméra non autorisée. Dans Chrome ou Safari, autorisez la caméra pour ce site puis réessayez. Si le site est ouvert dans une autre application, ouvrez son lien directement dans Chrome ou Safari.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "Aucune caméra accessible. Vérifiez qu’une caméra est disponible, ou utilisez une photo du code et la saisie manuelle.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "La caméra est occupée ou inaccessible. Fermez les autres applications qui l’utilisent puis réessayez.";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError")
    return "Cette caméra ne peut pas utiliser le mode demandé. Réessayez ou choisissez une autre caméra.";
  if (name === "AbortError")
    return "La caméra a été interrompue. Appuyez sur Activer la caméra arrière pour réessayer.";
  return "Impossible de démarrer la caméra ou le lecteur. Réessayez dans Chrome ou Safari, ou utilisez une photo du code et la saisie manuelle.";
}
