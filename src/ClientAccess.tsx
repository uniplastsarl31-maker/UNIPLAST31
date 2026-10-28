import { useEffect, useState, type FormEvent } from "react";
import {
  KeyRound,
  Phone,
  ShieldCheck,
  Copy,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import * as api from "./api";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import type { CustomerAccess } from "./types";

const numeric = (s: string) =>
  s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
function randomPin() {
  const a = new Uint32Array(1);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= 4294000000);
  return String(a[0] % 1000000).padStart(6, "0");
}
export function CustomerAccount() {
  const { catalog, refresh, checkAdmin } = useStore();
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof api.customerSession>
  > | null>(null);
  const [phone, setPhone] = useState(""),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void api
      .customerSession()
      .then(setSession)
      .catch((e) => setError(e.message));
  }, [catalog]);
  async function action(login: boolean) {
    setBusy(true);
    setError("");
    try {
      if (login) await api.customerLogin(phone, pin);
      else await api.logout();
      setPin("");
      setSession(await api.customerSession());
      await checkAdmin();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container page access-page">
      <div className="access-layout">
        <section className="access-story">
          <span className="eyebrow">VOTRE ACCÈS PROFESSIONNEL</span>
          <h1>
            Vos tarifs.
            <br />
            En toute simplicité.
          </h1>
          <p>
            Un téléphone, un code. Retrouvez les prix et préparez vos commandes
            UNIPLAST.
          </p>
          <div className="access-step">
            <span>01</span>
            <p>Recevez votre code de 6 chiffres auprès de notre équipe.</p>
          </div>
          <div className="access-step">
            <span>02</span>
            <p>
              Entrez votre téléphone et votre code pour afficher vos tarifs.
            </p>
          </div>
          <div className="access-step">
            <span>03</span>
            <p>
              Votre accès reste mémorisé sur cet appareil. Déconnectez-vous sur
              un appareil partagé.
            </p>
          </div>
        </section>
        <section className="panel access-card">
          <ShieldCheck size={38} />
          <h2>
            {session?.personal
              ? "Bienvenue, " + session.access?.name
              : "Accès client"}
          </h2>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {session?.personal ? (
            <>
              <p className="notice success">
                Votre accès aux tarifs est actif.
              </p>
              <p>{session.access?.phone}</p>
              <a className="btn btn-primary full-width" href="#/catalogue">
                Voir le catalogue et les prix
              </a>
              <a className="text-link" href="#/mes-commandes">
                Mes commandes et mes documents →
              </a>
              <button
                className="btn btn-outline full-width"
                disabled={busy}
                onClick={() => void action(false)}
              >
                Me déconnecter
              </button>
            </>
          ) : (
            <form
              className="feature-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(true);
              }}
            >
              <p>
                Aucune inscription. Utilisez les coordonnées et le code reçus
                d’UNIPLAST.
              </p>
              <Field label="Numéro de téléphone">
                <div className="access-input">
                  <Phone size={20} />
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="0550 00 00 00"
                    maxLength={25}
                    value={phone}
                    onChange={(e) => setPhone(numeric(e.target.value))}
                  />
                </div>
              </Field>
              <Field label="Code d’accès à 6 chiffres">
                <div className="access-input">
                  <KeyRound size={20} />
                  <input
                    required
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    autoComplete="current-password"
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) =>
                      setPin(
                        numeric(e.target.value).replace(/\D/g, "").slice(0, 6),
                      )
                    }
                  />
                </div>
              </Field>
              <button className="btn btn-primary full-width" disabled={busy}>
                {busy ? <Spinner /> : <KeyRound size={18} />}Afficher les prix
              </button>
              <p className="muted-copy">
                Code oublié ? Contactez UNIPLAST pour recevoir un nouveau code.
              </p>
              {catalog?.settings.phone && (
                <a className="text-link" href={"tel:" + catalog.settings.phone}>
                  Appeler UNIPLAST · {catalog.settings.phone}
                </a>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
export function CustomerAccessManager() {
  const { notify, refresh } = useStore();
  const [rows, setRows] = useState<CustomerAccess[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const empty = {
    id: undefined as string | undefined,
    name: "",
    phone: "",
    pin: "",
    enabled: true,
  };
  const [edit, setEdit] = useState(empty),
    [share, setShare] = useState<{ phone: string; message: string } | null>(
      null,
    );
  async function load() {
    try {
      setRows(await api.listCustomerAccess());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveCustomerCode(edit);
      if (edit.pin)
        setShare({
          phone: edit.phone,
          message: `UNIPLAST — votre accès client\nTéléphone : ${edit.phone}\nCode : ${edit.pin}\nOuvrez « Client agréé » dans la boutique. Gardez ce code confidentiel.`,
        });
      else setShare(null);
      setEdit({ ...empty });
      await load();
      await refresh();
      notify("Accès client enregistré.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TÉLÉPHONE + CODE</span>
          <h2>Les accès de vos clients</h2>
        </div>
        <button className="btn btn-outline" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      <p>
        Ajoutez le téléphone et un code de 6 chiffres. Le client consulte les
        tarifs sans créer de compte. Les codes enregistrés ne sont jamais
        affichés dans la liste.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <form className="feature-form code-editor" onSubmit={(e) => void save(e)}>
        <h3>{edit.id ? "Modifier l’accès" : "Ajouter un client"}</h3>
        <div className="form-grid">
          <Field label="Nom / entreprise">
            <input
              required
              minLength={2}
              maxLength={150}
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label="Téléphone du client">
            <input
              required
              type="tel"
              maxLength={25}
              value={edit.phone}
              onChange={(e) =>
                setEdit({ ...edit, phone: numeric(e.target.value) })
              }
            />
          </Field>
          <Field
            label={
              edit.id ? "Nouveau code (vide = conserver)" : "Code de 6 chiffres"
            }
          >
            <div className="access-input">
              <input
                required={!edit.id}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="off"
                value={edit.pin}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    pin: numeric(e.target.value).replace(/\D/g, "").slice(0, 6),
                  })
                }
              />
              <button
                className="icon-btn"
                type="button"
                aria-label="Générer un code de 6 chiffres"
                onClick={() => setEdit({ ...edit, pin: randomPin() })}
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={edit.enabled}
              onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })}
            />
            Accès aux prix activé
          </label>
        </div>
        <div className="feature-actions">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <ShieldCheck size={18} />}Enregistrer l’accès
          </button>
          {edit.id && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setEdit({ ...empty })}
            >
              Annuler
            </button>
          )}
        </div>
      </form>
      {share && (
        <div className="share-code notice">
          <h3>Envoyer le code au client</h3>
          <p className="preserve-lines">{share.message}</p>
          <div className="feature-actions">
            <button
              className="btn btn-outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(share.message)
                  .then(() => notify("Message copié."))
                  .catch(() =>
                    notify("Sélectionnez et copiez le message affiché.", true),
                  )
              }
            >
              <Copy size={17} />
              Copier le message
            </button>
            {typeof navigator.share === "function" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  void navigator.share({ text: share.message }).catch(() => {})
                }
              >
                <MessageCircle size={17} />
                Partager · Viber / WhatsApp
              </button>
            )}
            <a
              className="btn btn-outline"
              href={"viber://forward?text=" + encodeURIComponent(share.message)}
            >
              Ouvrir Viber
            </a>
            <button className="text-link" onClick={() => setShare(null)}>
              Masquer le code
            </button>
          </div>
          <small>
            Le code apparaît ici uniquement après sa saisie. Choisissez
            vous-même le destinataire dans Viber.
          </small>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Téléphone</th>
              <th>Accès</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.user_id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>
                  <span
                    className={
                      "badge " +
                      (c.status === "approved" ? "available" : "unavailable")
                    }
                  >
                    {c.status === "approved" ? "Activé" : "Désactivé"}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setEdit({
                        id: c.user_id,
                        name: c.name,
                        phone: c.phone,
                        pin: "",
                        enabled: c.status === "approved",
                      });
                      setShare(null);
                    }}
                  >
                    Modifier / changer le code
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="notice">
            Aucun accès client. Ajoutez le premier ci-dessus.
          </p>
        )}
      </div>
    </section>
  );
}
export function LocalAdminLogin({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<{
      setup_required: boolean;
      setup_token?: string;
      setup_key_required?: boolean;
      setup_available?: boolean;
    } | null>(null),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [setupKey, setSetupKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void api
      .localCall("status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (status?.setup_required) {
        if (password !== confirm)
          throw new Error("Les mots de passe ne correspondent pas.");
        await api.localCall("setup", {
          token: status.setup_token,
          setup_key: setupKey,
          password,
        });
      } else await api.login("", password);
      setPassword("");
      setConfirm("");
      setSetupKey("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="feature-form" onSubmit={(e) => void submit(e)}>
      <h3>
        {status?.setup_required
          ? "Créer votre accès de gestion"
          : "Connexion du responsable"}
      </h3>
      <p>
        {status?.setup_required
          ? "Au premier démarrage, choisissez le mot de passe de l’administration. Il est distinct des codes clients."
          : "Saisissez votre mot de passe pour gérer le magasin."}
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {status?.setup_required && status.setup_available === false && (
        <p className="notice">
          Le propriétaire doit autoriser l’installation dans les réglages de
          l’hébergement avant de créer son accès.
        </p>
      )}
      {status?.setup_key_required && (
        <Field label="Clé d’installation du propriétaire">
          <input
            required
            type="password"
            autoComplete="off"
            minLength={24}
            maxLength={256}
            value={setupKey}
            onChange={(e) => setSetupKey(e.target.value)}
          />
          <small>
            Utilisez la clé privée définie lors de la mise en ligne. Elle sert
            uniquement à la première installation.
          </small>
        </Field>
      )}
      <Field
        label={
          status?.setup_required
            ? "Mot de passe administrateur (12 caractères minimum)"
            : "Mot de passe administrateur"
        }
      >
        <input
          required
          autoComplete={
            status?.setup_required ? "new-password" : "current-password"
          }
          type="password"
          minLength={status?.setup_required ? 12 : 1}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {status?.setup_required && (
        <Field label="Confirmer le mot de passe">
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      )}
      <button
        className="btn btn-primary full-width"
        disabled={
          busy ||
          !status ||
          (status.setup_required && status.setup_available === false)
        }
      >
        {busy ? <Spinner /> : <ShieldCheck size={18} />}{" "}
        {status?.setup_required ? "Créer et ouvrir la gestion" : "Se connecter"}
      </button>
    </form>
  );
}
export function AdminPasswordSettings() {
  const { notify } = useStore();
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (password !== confirm || password.length < 12) {
      notify("Confirmez un mot de passe de 12 caractères au minimum.", true);
      return;
    }
    setBusy(true);
    try {
      await api.changeAdminPassword(current, password);
      setCurrent("");
      setPassword("");
      setConfirm("");
      notify("Mot de passe administrateur modifié.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel admin-password-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {api.localMode && (
        <input
          hidden
          type="text"
          name="username"
          autoComplete="username"
          readOnly
          value="responsable"
        />
      )}
      <h2>Mot de passe du responsable</h2>
      <p>
        Ce mot de passe donne accès à la gestion. Les codes à 6 chiffres sont
        réservés aux clients.
      </p>
      <div className="form-grid">
        {api.localMode && (
          <Field label="Mot de passe actuel">
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
        )}
        <Field label="Nouveau mot de passe (12 caractères minimum)">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            maxLength={128}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="submit"
        className="btn btn-outline"
        disabled={busy || !password || !confirm || (api.localMode && !current)}
      >
        Changer le mot de passe
      </button>
    </form>
  );
}
