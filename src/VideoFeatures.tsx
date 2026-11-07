import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Play, Plus, Trash2, Youtube } from "lucide-react";
import type { Settings, SiteVideo } from "./types";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import * as api from "./api";
import { localUpload, videoLimitMo } from "./localApi";
import {
  DEFAULT_TAGLINE,
  mediaFileUrl,
  youtubeChannelUrl,
  youtubeVideoId,
} from "./media";

const VIDEO_LIMIT = videoLimitMo * 1024 * 1024;
async function checkedVideo(file: File): Promise<File> {
  if (!file.size || file.size > VIDEO_LIMIT)
    throw new Error(`Une vidéo doit faire au maximum ${videoLimitMo} Mo.`);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mp4 =
    bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  const webm =
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;
  if (!mp4 && !webm)
    throw new Error("Choisissez une véritable vidéo MP4 ou WebM.");
  return new File([file], file.name, {
    type: mp4 ? "video/mp4" : "video/webm",
  });
}

export function MediaSettings({
  s,
  onChange,
}: {
  s: Settings;
  onChange: (s: Settings) => void;
}) {
  const { notify } = useStore(),
    [busy, setBusy] = useState("");
  const latest = useRef(s),
    changer = useRef(onChange);
  latest.current = s;
  changer.current = onChange;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    changer.current({ ...latest.current, [key]: value });
  const update = (id: string, patch: Partial<SiteVideo>) =>
    set(
      "videos",
      (latest.current.videos || []).map((v) =>
        v.id === id ? { ...v, ...patch } : v,
      ),
    );
  async function upload(id: string, file: File, poster = false) {
    setBusy(id);
    try {
      if (poster)
        update(id, { poster_url: (await api.uploadProductImage(file)).url });
      else {
        const video = await checkedVideo(file);
        update(id, { url: await localUpload(video, true) });
      }
      notify(
        poster
          ? "Image prête. Enregistrez les réglages."
          : "Vidéo prête. Enregistrez les réglages pour la publier.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  function move(index: number, direction: number) {
    const list = [...(s.videos || [])],
      other = index + direction;
    if (other < 0 || other >= list.length) return;
    [list[index], list[other]] = [list[other], list[index]];
    set("videos", list);
  }
  return (
    <section className="panel media-settings">
      <h2>
        <Youtube size={22} /> Signature, YouTube et vidéos
      </h2>
      <div className="form-grid">
        <Field label="Phrase en haut du site">
          <input
            maxLength={200}
            value={s.topbar_tagline ?? DEFAULT_TAGLINE}
            onChange={(e) => set("topbar_tagline", e.target.value)}
          />
        </Field>
        <Field label="Chaîne ou page YouTube de l’entreprise">
          <input
            type="url"
            maxLength={500}
            value={s.youtube_url || ""}
            placeholder="https://www.youtube.com/@votre-chaine"
            onChange={(e) => set("youtube_url", e.target.value)}
          />
        </Field>
      </div>
      <p className="muted-copy">
        Le lien YouTube apparaît dans les contacts du site. La phrase du bandeau
        reste modifiable ici.
      </p>
      <label className="feature-toggle">
        <input
          type="checkbox"
          checked={s.videos_enabled === true}
          onChange={(e) => set("videos_enabled", e.target.checked)}
        />
        <span>
          <b>Afficher la rubrique vidéo sur l’accueil</b>
          <small>
            Préparez vos vidéos puis activez cette rubrique. La lecture démarre
            à la demande du visiteur.
          </small>
        </span>
      </label>
      <Field label="Titre de la rubrique vidéo">
        <input
          maxLength={150}
          value={s.videos_title || "UNIPLAST en vidéo"}
          onChange={(e) => set("videos_title", e.target.value)}
        />
      </Field>
      <p className="muted-copy">
        Les petits clips d’environ 10 secondes conviennent bien. Fichiers MP4 ou
        WebM, {videoLimitMo} Mo maximum. Vous pouvez aussi utiliser un lien
        YouTube, y compris un Short.
      </p>
      {(s.videos || []).map((v, index, all) => (
        <details className="media-edit-row" key={v.id} open={all.length === 1}>
          <summary>
            {index + 1}. {v.title || "Nouvelle vidéo"}
          </summary>
          <div className="media-edit-content">
            <div className="feature-actions">
              <button
                type="button"
                className="btn btn-outline"
                aria-label={"Monter la vidéo " + (index + 1)}
                disabled={index === 0 || !!busy}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                aria-label={"Descendre la vidéo " + (index + 1)}
                disabled={index === all.length - 1 || !!busy}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="btn btn-outline danger"
                disabled={!!busy}
                onClick={() =>
                  set(
                    "videos",
                    all.filter((x) => x.id !== v.id),
                  )
                }
              >
                <Trash2 size={16} />
                Retirer cette vidéo
              </button>
            </div>
            <Field label="Titre de la vidéo">
              <input
                required
                maxLength={150}
                value={v.title}
                onChange={(e) => update(v.id, { title: e.target.value })}
              />
            </Field>
            <Field label="Source de la vidéo">
              <select
                value={v.source}
                onChange={(e) =>
                  update(v.id, {
                    source: e.target.value as SiteVideo["source"],
                    url: "",
                    visible: false,
                  })
                }
              >
                <option value="youtube">Lien YouTube / Short</option>
                <option value="upload">Importer une vidéo MP4 / WebM</option>
              </select>
            </Field>
            {v.source === "youtube" ? (
              <Field label="Lien de cette vidéo YouTube">
                <input
                  type="url"
                  maxLength={500}
                  value={v.url}
                  placeholder="https://www.youtube.com/shorts/…"
                  onChange={(e) => update(v.id, { url: e.target.value })}
                />
              </Field>
            ) : (
              <>
                <Field
                  label={`Fichier vidéo (MP4 / WebM, ${videoLimitMo} Mo maximum)`}
                >
                  <input
                    type="file"
                    accept="video/mp4,video/webm,.mp4,.webm"
                    disabled={!!busy || api.previewMode}
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void upload(v.id, e.target.files[0]);
                    }}
                  />
                </Field>
                {api.previewMode && (
                  <p className="muted-copy">
                    Le téléversement vidéo est disponible dans le magasin
                    connecté.
                  </p>
                )}
              </>
            )}
            {busy === v.id && (
              <p>
                <Spinner /> Envoi du fichier… Gardez cette page ouverte.
              </p>
            )}
            {v.source === "upload" && mediaFileUrl(v.url) && (
              <video
                className="media-upload-preview"
                controls
                playsInline
                preload="metadata"
                src={v.url}
              />
            )}
            {v.source === "youtube" && youtubeVideoId(v.url) && (
              <p className="media-valid-link">✓ Vidéo YouTube reconnue</p>
            )}
            <Field label="Image d’affiche (facultative)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!!busy}
                onChange={(e) => {
                  if (e.target.files?.[0])
                    void upload(v.id, e.target.files[0], true);
                }}
              />
            </Field>
            {v.poster_url && (
              <div className="media-poster-edit">
                <img src={v.poster_url} alt="Affiche de la vidéo" />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => update(v.id, { poster_url: "" })}
                >
                  Retirer l’affiche
                </button>
              </div>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={v.visible}
                onChange={(e) => update(v.id, { visible: e.target.checked })}
              />
              Afficher cette vidéo
            </label>
          </div>
        </details>
      ))}
      <button
        type="button"
        className="btn btn-outline"
        disabled={!!busy || (s.videos?.length || 0) >= 12}
        onClick={() =>
          set("videos", [
            ...(s.videos || []),
            {
              id: crypto.randomUUID(),
              title: "Nouvelle vidéo",
              source: "youtube",
              url: "",
              poster_url: "",
              visible: false,
            },
          ])
        }
      >
        <Plus size={17} />
        Ajouter une vidéo
      </button>
      <p className="muted-copy">
        Terminez par « Enregistrer les réglages ». Retirer une vidéo de cette
        liste ne supprime pas les photos des produits ni les commandes.
      </p>
    </section>
  );
}

function VideoCard({ item: v }: { item: SiteVideo }) {
  const [opened, setOpened] = useState(false),
    youtube = youtubeVideoId(v.url),
    poster = mediaFileUrl(v.poster_url);
  return (
    <article className="store-video-card">
      <div className="store-video-frame">
        {v.source === "upload" ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={mediaFileUrl(v.url)}
            poster={poster || undefined}
            aria-label={v.title}
          />
        ) : opened && youtube ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtube}?rel=0`}
            title={v.title}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="youtube-load-button"
            onClick={() => setOpened(true)}
            aria-label={"Charger la vidéo : " + v.title}
          >
            {poster && <img src={poster} alt="" loading="lazy" />}
            <span className="video-play-icon">
              <Play size={27} fill="currentColor" />
            </span>
            <span>Voir la vidéo</span>
          </button>
        )}
      </div>
      <h3>{v.title}</h3>
      {v.source === "youtube" && youtube && (
        <a
          className="text-link"
          href={`https://www.youtube.com/watch?v=${youtube}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir sur YouTube ↗
        </a>
      )}
    </article>
  );
}
export function VideoSection() {
  const { catalog } = useStore();
  if (!catalog?.settings.videos_enabled) return null;
  const s = catalog.settings,
    videos = (s.videos || []).filter(
      (v) =>
        v.visible &&
        (v.source === "youtube" ? youtubeVideoId(v.url) : mediaFileUrl(v.url)),
    );
  if (!videos.length) return null;
  const channel = youtubeChannelUrl(s.youtube_url || "");
  return (
    <section className="store-video-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LES IDÉES PRENNENT VIE</span>
          <h2>{s.videos_title || "UNIPLAST en vidéo"}</h2>
        </div>
        {channel && (
          <a
            className="text-link"
            href={channel}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Youtube size={19} />
            Notre chaîne YouTube ↗
          </a>
        )}
      </div>
      <div className="store-video-grid">
        {videos.map((v) => (
          <VideoCard key={v.id} item={v} />
        ))}
      </div>
    </section>
  );
}
