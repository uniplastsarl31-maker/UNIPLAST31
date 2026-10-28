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
import { money, priceOf } from "./domain";
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
  const { catalog } = useStore();
  const [manual, setManual] = useState(""),
    [scanning, setScanning] = useState(false),
    [message, setMessage] = useState(""),
    [starting, setStarting] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    disposed = useRef(false),
    found = useRef(false);
  const stop = () => {
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
    setScanning(false);
  };
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      controls.current?.stop();
      const stream = video.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const match = (value: string) => {
    const code = value
        .trim()
        .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)),
      p = catalog?.products.find((p) => p.barcode === code);
    stop();
    if (p) {
      onClose();
      navigate("/produit/" + p.id);
    } else
      setMessage(
        "Aucun produit ne correspond à ce code-barres. Vérifiez la saisie ou recherchez par référence.",
      );
  };
  const start = async () => {
    if (starting || scanning) return;
    setMessage("");
    if (!window.isSecureContext) {
      setMessage(
        "La caméra nécessite une connexion HTTPS. Utilisez la saisie manuelle.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "La caméra n’est pas disponible dans ce navigateur. Utilisez la saisie manuelle.",
      );
      return;
    }
    setStarting(true);
    found.current = false;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (disposed.current) return;
      const reader = new BrowserMultiFormatReader();
      setScanning(true);
      const c = await reader.decodeFromVideoDevice(
        undefined,
        video.current!,
        (result) => {
          if (result && !found.current) {
            found.current = true;
            match(result.getText());
          }
        },
      );
      controls.current = c;
      if (disposed.current || found.current) c.stop();
    } catch (e) {
      stop();
      setMessage(
        (e as Error).name === "NotAllowedError"
          ? "L’accès à la caméra a été refusé. Vous pouvez saisir le code manuellement."
          : "Impossible de démarrer la caméra. Vérifiez les autorisations et utilisez la saisie manuelle si nécessaire.",
      );
    } finally {
      if (!disposed.current) setStarting(false);
    }
  };
  return (
    <Modal title="Scanner un code-barres" onClose={onClose}>
      <p className="dialog-copy">
        Retrouvez directement un produit avec le code-barres enregistré dans le
        catalogue.
      </p>
      <div className={`scanner-window ${scanning ? "scanning" : ""}`}>
        <video ref={video} muted playsInline />
        {!scanning && (
          <div>
            <ScanLine size={45} strokeWidth={1} />
            <span>Placez le code-barres face à la caméra</span>
          </div>
        )}
        {scanning && <span className="scanner-target" />}
      </div>
      <button
        className="btn btn-outline full-width"
        disabled={starting}
        onClick={() => (scanning ? stop() : void start())}
      >
        {starting ? <Spinner /> : <Camera size={18} />}{" "}
        {starting
          ? "Accès à la caméra…"
          : scanning
            ? "Arrêter la caméra"
            : "Activer la caméra"}
      </button>
      <div className="or-divider">
        <span>ou saisissez le code</span>
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
        L’autorisation est demandée à l’activation uniquement. La caméra
        s’arrête après lecture ou fermeture.
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
