import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAGLINE,
  mediaFileUrl,
  validateMediaSettings,
  youtubeChannelUrl,
  youtubeVideoId,
} from "../src/media.ts";
import type { SiteVideo } from "../src/types.ts";
const id = "dQw4w9WgXcQ";
const video: SiteVideo = {
  id: "5b883acc-6323-40b9-afc3-60a98a9f2bb3",
  source: "youtube",
  title: "Vidéo de test",
  url: "https://www.youtube.com/shorts/" + id,
  poster_url: "",
  visible: true,
};
test("YouTube embeds accept only validated HTTPS video IDs, including shorts", () => {
  assert.equal(DEFAULT_TAGLINE, "La maîtrise de la plasturgie");
  for (const value of [
    "https://youtu.be/" + id,
    "https://www.youtube.com/watch?v=" + id,
    "https://m.youtube.com/shorts/" + id,
    "https://youtube.com/embed/" + id,
  ])
    assert.equal(youtubeVideoId(value), id);
  for (const value of [
    "javascript:alert(1)",
    "https://youtube.com.evil.example/watch?v=" + id,
    "https://user:secret@youtube.com/watch?v=" + id,
    "http://youtube.com/watch?v=" + id,
    "https://youtube.com/watch?v=invalid",
    "https://example.com/" + id,
  ])
    assert.equal(youtubeVideoId(value), null);
  assert.equal(
    youtubeChannelUrl("https://www.youtube.com/@uniplast"),
    "https://www.youtube.com/@uniplast",
  );
});
test("new media settings are optional and cannot embed arbitrary frames or remote uploaded files", () => {
  assert.equal(validateMediaSettings({}), null);
  assert.equal(validateMediaSettings({ videos: [video] }), null);
  assert(
    validateMediaSettings({
      videos: [{ ...video, url: "https://example.com/embed/video" }],
    }),
  );
  assert(
    validateMediaSettings({
      videos: [
        { ...video, source: "upload", url: "https://example.com/movie.mp4" },
      ],
    }),
  );
  assert.equal(
    mediaFileUrl("/api/local/file?id=5b883acc-6323-40b9-afc3-60a98a9f2bb3"),
    "/api/local/file?id=5b883acc-6323-40b9-afc3-60a98a9f2bb3",
  );
  assert.equal(mediaFileUrl("/assets/../secrets"), "");
  assert(validateMediaSettings({ videos: [video, video] }));
  assert.equal(
    validateMediaSettings({ videos: [{ ...video, url: "", visible: false }] }),
    null,
  );
  assert(
    validateMediaSettings({ videos: [{ ...video, url: "", visible: true }] }),
  );
});
