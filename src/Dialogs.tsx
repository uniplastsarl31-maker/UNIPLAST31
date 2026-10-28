import { LocalAdminLogin } from "./ClientAccess";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  ScanLine,
  ShoppingBag,
} from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { Modal, Field, ProductPhoto, Quantity, Spinner } from "./ui";
import { navigate, useStore } from "./store";
import { money, priceOf, findBarcodeProduct } from "./domain";
import * as api from "./api";

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const { checkAdmin, notify, refresh } = useStore();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [reset, setReset] = useState(false),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (reset) {
        await api.resetPassword(email);
        setSent(true);
      } else {
        await api.login(email, password);
        await checkAdmin();
        onClose();
        navigate("/admin");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const preview = async () => {
    api.enablePreviewAdmin();
    await checkAdmin();
    await refresh();
    onClose();
    navigate("/admin");
  };
  return (
    <Modal
      title={reset ? "Réinitialiser le mot de passe" : "Espace de gestion"}
      onClose={onClose}
    >
      <span className="dialog-large-icon">
        <LockKeyhole size={28} />
      </span>
      {api.localMode ? (
        <LocalAdminLogin
          onDone={() => {
            void (async () => {
              await checkAdmin();
              await refresh();
              onClose();
              navigate("/admin");
            })();
          }}
        />
      ) : api.previewMode ? (
        <>
          <h3>Explorez votre tableau de bord.</h3>
          <p className="dialog-copy">
            Le catalogue importé est déjà renseigné. Vous pouvez tester la
            gestion des produits, familles et commandes dans cette session.
          </p>
          <div className="notice amber">
            <Info size={18} />
            <span>
              Connexion réelle non configurée. Les modifications d’aperçu sont
              en mémoire et disparaissent au rechargement. Aucun mot de passe
              fictif n’est utilisé.
            </span>
          </div>
          <button
            className="btn btn-primary full-width"
            onClick={() => void preview()}
          >
            Ouvrir le tableau de bord d’aperçu <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <p className="dialog-copy">
            {reset
              ? "Saisissez l’adresse de votre compte administrateur."
              : "Connectez-vous avec votre compte administrateur UNIPLAST."}
          </p>
          <Field label="Adresse e-mail">
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {!reset && (
            <Field label="Mot de passe">
              <div className="password-input">
                <input
                  required
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={
                    visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className="notice success">
              Si ce compte existe, un lien de récupération a été envoyé.
            </p>
          )}
          <button className="btn btn-primary full-width" disabled={busy}>
            {busy ? <Spinner /> : <LockKeyhole size={16} />}{" "}
            {reset ? "Envoyer le lien" : "Se connecter"}
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setReset(!reset);
              setError("");
            }}
          >
            {reset ? "Retour à la connexion" : "Mot de passe oublié ?"}
          </button>
        </form>
      )}
    </Modal>
  );
}
export function PasswordRecovery() {
  const { notify } = useStore();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      notify("Les mots de passe ne correspondent pas.", true);
      return;
    }
    setBusy(true);
    try {
      await api.updatePassword(password);
      setDone(true);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="container page">
      <section className="panel recovery-panel">
        <h1>Nouveau mot de passe</h1>
        {done ? (
          <p>
            Votre mot de passe a été mis à jour.{" "}
            <a href="#/client-agree">Ouvrir mon compte</a>
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <Field label="Nouveau mot de passe (12 caractères minimum)">
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmez le mot de passe">
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner /> : "Enregistrer le mot de passe"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
export function ScannerDialog({ onClose }: { onClose: () => void }) {
  const { catalog, openProduct } = useStore();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false),
    [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [torch, setTorch] = useState(false),
    [hasTorch, setHasTorch] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null);
  const disposed = useRef(false),
    found = useRef(false),
    generation = useRef(0);
  const stop = () => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
    setScanning(false);
    setTorch(false);
    setHasTorch(false);
  };
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      generation.current++;
      controls.current?.stop();
      (video.current?.srcObject as MediaStream | null)
        ?.getTracks()
        .forEach((t) => t.stop());
    };
  }, []);
  const match = (value: string) => {
    if (disposed.current) return;
    const product = findBarcodeProduct(catalog?.products || [], value);
    stop();
    setManual(value);
    if (product) {
      onClose();
      openProduct(product.id);
    } else
      setMessage(
        `Code lu : ${value}. Aucun produit correspondant. Vous pouvez réessayer ou saisir la référence dans la recherche.`,
      );
  };
  const start = async (deviceId?: string) => {
    if (starting) return;
    stop();
    setMessage("");
    found.current = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "La caméra nécessite HTTPS et un navigateur compatible. Vous pouvez lire une photo du code ou saisir ses chiffres.",
      );
      return;
    }
    const attempt = generation.current;
    setStarting(true);
    try {
      const { barcodeReader, cameraConstraints } = await import("./barcode");
      if (disposed.current || attempt !== generation.current) return;
      const reader = barcodeReader();
      const c = await reader.decodeFromConstraints(
        cameraConstraints(deviceId),
        video.current!,
        (result, _error, scan) => {
          if (
            result &&
            !found.current &&
            !disposed.current &&
            attempt === generation.current
          ) {
            found.current = true;
            scan.stop();
            match(result.getText());
          }
        },
      );
      if (disposed.current || found.current || attempt !== generation.current) {
        c.stop();
        return;
      }
      controls.current = c;
      setScanning(true);
      setHasTorch(!!c.switchTorch);
      const stream = video.current?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
          focusMode?: string[];
        };
        if (caps?.focusMode?.includes("continuous"))
          void track
            .applyConstraints({
              advanced: [
                { focusMode: "continuous" } as MediaTrackConstraintSet,
              ],
            })
            .catch(() => {});
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!disposed.current)
        setCameras(devices.filter((d) => d.kind === "videoinput"));
    } catch (error) {
      if (disposed.current || attempt !== generation.current) return;
      stop();
      const name = (error as Error).name;
      setMessage(
        name === "NotAllowedError"
          ? "Caméra refusée. Autorisez la caméra dans les réglages du site, ou utilisez une photo du code."
          : name === "NotReadableError"
            ? "La caméra est utilisée par une autre application. Fermez-la puis réessayez."
            : "Impossible de démarrer cette caméra. Essayez une photo du code ou la saisie manuelle.",
      );
    } finally {
      if (!disposed.current) setStarting(false);
    }
  };
  const photo = async (file: File) => {
    stop();
    setStarting(true);
    setMessage("");
    const attempt = generation.current;
    try {
      const { barcodeFromPhoto } = await import("./barcode");
      const code = await barcodeFromPhoto(file);
      if (!disposed.current && attempt === generation.current) match(code);
    } catch (e) {
      if (!disposed.current && attempt === generation.current)
        setMessage((e as Error).message);
    } finally {
      if (!disposed.current) setStarting(false);
    }
  };
  return (
    <Modal title="Scanner un code-barres" onClose={onClose}>
      <p className="dialog-copy">
        Cadrez le code entier avec la caméra arrière. Gardez une distance de 15
        à 25 cm, puis rapprochez doucement.
      </p>
      <div className={`scanner-window ${scanning ? "scanning" : ""}`}>
        <video ref={video} muted playsInline autoPlay />
        {!scanning && (
          <div>
            <ScanLine size={45} strokeWidth={1} />
            <span>Code-barres net, bien éclairé et sans reflet</span>
          </div>
        )}
        {scanning && <span className="scanner-target" />}
      </div>
      <button
        className="btn btn-outline full-width"
        disabled={starting}
        onClick={() => (scanning ? stop() : void start())}
      >
        {starting ? <Spinner /> : <Camera size={18} />}
        {starting
          ? "Lecture en cours…"
          : scanning
            ? "Arrêter la caméra"
            : "Activer la caméra arrière"}
      </button>
      {scanning && (
        <div className="scanner-tools">
          {cameras.length > 1 && (
            <select
              aria-label="Choisir une caméra"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) void start(e.target.value);
              }}
            >
              <option value="" disabled>
                Changer de caméra
              </option>
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Caméra ${i + 1}`}
                </option>
              ))}
            </select>
          )}
          {hasTorch && (
            <button
              className="btn btn-outline"
              onClick={() => {
                void controls.current
                  ?.switchTorch?.(!torch)
                  .then(() => setTorch(!torch))
                  .catch(() =>
                    setMessage(
                      "L’éclairage n’est pas disponible sur cette caméra.",
                    ),
                  );
              }}
            >
              {torch ? "Éteindre" : "Éclairer"}
            </button>
          )}
        </div>
      )}
      <label
        className={`btn btn-outline full-width scanner-photo ${starting ? "disabled" : ""}`}
      >
        <Camera size={18} /> Lire une photo du code
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={starting}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void photo(file);
            e.target.value = "";
          }}
        />
      </label>
      <div className="or-divider">
        <span>ou saisissez les chiffres</span>
      </div>
      <form
        className="manual-barcode"
        onSubmit={(e) => {
          e.preventDefault();
          match(manual);
        }}
      >
        <input
          aria-label="Code-barres"
          inputMode="numeric"
          required
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Ex. 6134338000013"
        />
        <button
          className="btn btn-primary"
          aria-label="Rechercher le code-barres"
        >
          <ArrowRight size={18} />
        </button>
      </form>
      {message && (
        <p className="notice amber" role="status">
          {message}
        </p>
      )}
      <small className="muted-copy">
        La lecture reste sur votre téléphone. La caméra s’arrête après lecture
        ou fermeture.
      </small>
    </Modal>
  );
}
export function CartDialogs() {
  const {
    quantityProduct: p,
    closeQuantity,
    addCart,
    added,
    dismissAdded,
    catalog,
    now,
  } = useStore();
  const [n, setN] = useState(1);
  useEffect(() => setN(1), [p?.id]);
  if (p)
    return (
      <Modal title="Choisir la quantité" onClose={closeQuantity}>
        <div className="quantity-product">
          <ProductPhoto image={p.images[0]} name={p.name} />
          <div>
            <span className="product-code">{p.code}</span>
            <h3>{p.name}</h3>
            <p>
              {p.pack_size} unités / {p.pack_label}
            </p>
          </div>
        </div>
        <Field label={"Nombre de " + p.pack_label + "s"}>
          <Quantity value={n} onChange={setN} max={p.stock_cartons ?? 10000} />
        </Field>
        <dl className="quantity-breakdown">
          <div>
            <dt>Prix de l’unité</dt>
            <dd>{money(priceOf(p, now), catalog!.settings.currency)}</dd>
          </div>
          <div>
            <dt>Prix du {p.pack_label}</dt>
            <dd>
              {money(priceOf(p, now) * p.pack_size, catalog!.settings.currency)}
            </dd>
          </div>
          <div>
            <dt>Total d’unités</dt>
            <dd>{n * p.pack_size}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {money(
                priceOf(p, now) * p.pack_size * n,
                catalog!.settings.currency,
              )}
            </dd>
          </div>
        </dl>
        <button
          className="btn btn-primary full-width"
          onClick={() => addCart(p, n)}
        >
          <ShoppingBag size={17} />
          Ajouter au panier
        </button>
      </Modal>
    );
  if (added)
    return (
      <Modal title="Produit ajouté au panier" onClose={dismissAdded}>
        <span className="dialog-large-icon success-icon">
          <Check size={30} />
        </span>
        <h3 className="text-center">Votre sélection prend forme.</h3>
        <p className="dialog-copy text-center">{added.name}</p>
        <div className="dialog-action-stack">
          <button
            className="btn btn-primary"
            onClick={() => {
              dismissAdded();
              navigate("/panier");
            }}
          >
            Voir le bon de commande <ArrowRight size={17} />
          </button>
          <button className="btn btn-outline" onClick={dismissAdded}>
            Continuer mes achats
          </button>
        </div>
      </Modal>
    );
  return null;
}
