import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startScannerCamera,
  scannerCameraMessage,
} from "../src/scannerCamera.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function fixture() {
  const order: string[] = [],
    attributes = new Map<string, string>();
  let stops = 0,
    pauses = 0;
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stops++;
        },
      },
    ],
  } as unknown as MediaStream;
  const video = {
    muted: false,
    autoplay: false,
    playsInline: false,
    srcObject: null as MediaStream | null,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    pause: () => {
      pauses++;
    },
    play: async () => {
      order.push("play");
    },
  } as unknown as HTMLVideoElement;
  return {
    video,
    stream,
    order,
    attributes,
    stops: () => stops,
    pauses: () => pauses,
  };
}

test("camera permission starts immediately, inline muted preview precedes bundled decoding, results deduplicate", async () => {
  const f = fixture(),
    permission = deferred<MediaStream>();
  let requests = 0,
    decoded = 0,
    decoderStops = 0;
  let result: (value: string) => void = () => {};
  const codes: string[] = [];
  const camera = startScannerCamera(f.video, {
    getUserMedia: () => {
      requests++;
      return permission.promise;
    },
    onPreview: () => f.order.push("preview"),
    decode: async (_video, callback) => {
      decoded++;
      f.order.push("decode");
      result = callback;
      return {
        stop: () => {
          decoderStops++;
        },
      };
    },
    onCode: (value) => codes.push(value),
  });
  assert.equal(requests, 1);
  assert.equal(decoded, 0);
  assert.equal(f.video.muted, true);
  assert.equal(f.video.playsInline, true);
  assert.equal(f.video.autoplay, true);
  assert.ok(f.attributes.has("playsinline"));
  permission.resolve(f.stream);
  assert.equal(await camera.ready, true);
  assert.deepEqual(f.order, ["preview", "play", "decode"]);
  result("06134338000013");
  result("06134338000013");
  assert.deepEqual(codes, ["06134338000013"]);
  camera.stop();
  camera.stop();
  assert.equal(decoderStops, 1);
  assert.equal(f.stops(), 1);
  assert.equal(f.pauses(), 1);
  assert.equal(f.video.srcObject, null);
});

test("stale selected camera and unsupported constraints relax to rear preference then generic video", async () => {
  const f = fixture(),
    constraints: MediaStreamConstraints[] = [];
  const camera = startScannerCamera(f.video, {
    deviceId: "old-camera-id",
    getUserMedia: async (value) => {
      constraints.push(value);
      if (constraints.length < 3)
        throw new DOMException(
          "No matching camera",
          constraints.length === 1 ? "NotFoundError" : "OverconstrainedError",
        );
      return f.stream;
    },
    onPreview: () => {},
    onCode: () => {},
    decode: async () => ({ stop: () => {} }),
  });
  assert.equal(await camera.ready, true);
  assert.deepEqual((constraints[0].video as MediaTrackConstraints).deviceId, {
    exact: "old-camera-id",
  });
  assert.deepEqual((constraints[1].video as MediaTrackConstraints).facingMode, {
    ideal: "environment",
  });
  assert.equal(constraints[2].video, true);
  assert.ok(constraints.every((value) => value.audio === false));
  camera.stop();
});

test("permission denial is not retried and produces actionable French Chrome/Safari guidance", async () => {
  const f = fixture();
  let requests = 0;
  const error = new DOMException("Denied", "NotAllowedError");
  const camera = startScannerCamera(f.video, {
    getUserMedia: async () => {
      requests++;
      throw error;
    },
    onPreview: () => assert.fail("No preview without permission"),
    decode: async () => {
      throw new Error("Decoder must not load");
    },
    onCode: () => {},
  });
  await assert.rejects(camera.ready, (actual) => actual === error);
  assert.equal(requests, 1);
  assert.match(scannerCameraMessage(error), /Chrome ou Safari/);
  assert.match(scannerCameraMessage(error), /autorisez la caméra/);
});

test("closing while permission is pending releases late tracks without touching a replacement preview", async () => {
  const f = fixture(),
    permission = deferred<MediaStream>();
  let decodes = 0;
  const camera = startScannerCamera(f.video, {
    getUserMedia: () => permission.promise,
    onPreview: () => assert.fail("Closed preview must not attach"),
    decode: async () => {
      decodes++;
      return { stop: () => {} };
    },
    onCode: () => {},
  });
  camera.stop();
  const replacement = {} as MediaStream;
  f.video.srcObject = replacement;
  permission.resolve(f.stream);
  await assert.rejects(camera.ready, { name: "AbortError" });
  assert.equal(f.stops(), 1);
  assert.equal(decodes, 0);
  assert.equal(f.video.srcObject, replacement);
});

test("cancel during decoder loading stops the preview and any late decoder, ignores late results", async () => {
  const f = fixture(),
    decoder = deferred<{ stop: () => void }>();
  let decoderStops = 0,
    codes = 0;
  let result: (value: string) => void = () => {};
  const camera = startScannerCamera(f.video, {
    getUserMedia: async () => f.stream,
    onPreview: () => {},
    decode: async (_video, callback) => {
      result = callback;
      return decoder.promise;
    },
    onCode: () => {
      codes++;
    },
  });
  await flush();
  camera.stop();
  assert.equal(f.stops(), 1);
  result("6134338000013");
  decoder.resolve({
    stop: () => {
      decoderStops++;
    },
  });
  assert.equal(await camera.ready, false);
  assert.equal(decoderStops, 1);
  assert.equal(codes, 0);
  assert.equal(f.video.srcObject, null);
});

test("playback rejection preserves its cause, releases camera and never starts decoding", async () => {
  const f = fixture(),
    cause = new DOMException("Playback blocked", "NotAllowedError");
  f.video.play = async () => {
    throw cause;
  };
  const camera = startScannerCamera(f.video, {
    getUserMedia: async () => f.stream,
    onPreview: () => {},
    onCode: () => {},
    decode: async () => {
      throw new Error("Decoder must not start");
    },
  });
  await assert.rejects(camera.ready, (actual: unknown) => {
    assert.ok(actual instanceof Error);
    assert.equal(actual.name, "VideoPlaybackError");
    assert.equal(actual.cause, cause);
    assert.match(scannerCameraMessage(actual), /aperçu vidéo/);
    return true;
  });
  assert.equal(f.stops(), 1);
  assert.equal(f.video.srcObject, null);
});
