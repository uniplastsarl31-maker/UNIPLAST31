import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { localCall } from "./localApi";
import { previewMode } from "./api";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import {
  createCatalogWorkbook,
  parseCatalogWorkbook,
  WORKBOOK_COLUMNS,
  type CatalogExport,
  type TransferMode,
} from "./catalogWorkbook";

interface Status {
  configured: boolean;
  unlocked: boolean;
}
interface Plan {
  plan_id: string;
  changes: {
    id: string;
    code: string;
    name: string;
    fields: { field: string; before: unknown; after: unknown }[];
  }[];
  skipped: { code: string; reason: string }[];
  conflicts: { code: string; field: string }[];
  count: number;
}
function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function readable(field: string, value: unknown): string {
  if (value == null || value === "") return "Vide";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number" && field.includes("price_cents"))
    return (
      (value / 100).toLocaleString("fr-DZ", { maximumFractionDigits: 2 }) +
      " DA"
    );
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function CatalogTransfer() {
  const { notify, refresh } = useStore();
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [changeCode, setChangeCode] = useState(false),
    [mode, setMode] = useState<TransferMode>("weights"),
    [plan, setPlan] = useState<Plan | null>(null),
    [backup, setBackup] = useState(""),
    [message, setMessage] = useState("");
  const syncStatus = async () =>
    setStatus(await localCall<Status>("transfer-status"));
  useEffect(() => {
    if (!previewMode)
      void syncStatus().catch((e) => notify((e as Error).message, true));
  }, []);
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      notify((e as Error).message, true);
      void syncStatus().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const unlock = (e: FormEvent) => {
    e.preventDefault();
    void action(async () => {
      await localCall("transfer-unlock", { code });
      setCode("");
      await syncStatus();
      notify("Mise à jour déverrouillée pour cette session.");
    });
  };
  const saveCode = (e: FormEvent) => {
    e.preventDefault();
    void action(async () => {
      if (next !== confirmation)
        throw new Error("Les deux codes ne correspondent pas.");
      await localCall("transfer-code", {
        ...(status?.configured ? { current } : {}),
        next,
      });
      setCurrent("");
      setNext("");
      setConfirmation("");
      setChangeCode(false);
      setPlan(null);
      await syncStatus();
      notify("Code de mise à jour enregistré.");
    });
  };
  const exportFile = () =>
    void action(async () => {
      const data = await localCall<CatalogExport>("transfer-export", {}),
        bytes = await createCatalogWorkbook(data);
      download(
        bytes,
        "UNIPLAST-Catalogue-" + data.created_at.slice(0, 10) + ".xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      setMessage(
        "Le fichier contient les données actuelles du magasin. Modifiez les cellules blanches, puis rechargez-le ci-dessous.",
      );
    });
  async function importFile(file: File) {
    if (!/\.xlsx$/i.test(file.name))
      throw new Error("Choisissez le fichier .xlsx exporté depuis ce site.");
    setPlan(null);
    setMessage("");
    const parsed = await parseCatalogWorkbook(await file.arrayBuffer(), mode);
    setPlan(await localCall<Plan>("transfer-preview", { ...parsed, mode }));
  }
  const apply = () =>
    void action(async () => {
      if (!plan || plan.conflicts.length || !plan.changes.length) return;
      const result = await localCall<{ updated: number; backup_id: string }>(
        "transfer-apply",
        { plan_id: plan.plan_id },
      );
      setBackup(result.backup_id);
      setPlan(null);
      setMessage(
        `${result.updated} produit(s) mis à jour. Les photos et les autres données ont été conservées.`,
      );
      await refresh();
      notify("Mise à jour appliquée et sauvegarde conservée.");
    });
  const backupFile = () =>
    void action(async () => {
      const result = await localCall(
        "transfer-backup?id=" + encodeURIComponent(backup),
      );
      download(
        JSON.stringify(result, null, 2),
        "UNIPLAST-Sauvegarde-" + backup + ".json",
        "application/json",
      );
    });
  const restore = () =>
    void action(async () => {
      const result = await localCall<{ restored?: number; updated?: number }>(
        "transfer-restore",
        { backup_id: backup },
      );
      setMessage(
        `${result.restored ?? result.updated ?? "Les"} produit(s) restauré(s) depuis la sauvegarde.`,
      );
      setBackup("");
      setPlan(null);
      await refresh();
      notify("Restauration terminée.");
    });
  const lines =
    plan?.changes.flatMap((p) =>
      p.fields.map((f) => ({ ...f, code: p.code, name: p.name })),
    ) || [];
  return (
    <section className="panel catalog-transfer-panel">
      <h2>
        <FileSpreadsheet size={23} />
        Mise à jour par Excel
      </h2>
      <p>
        Exportez le catalogue actuel, modifiez votre fichier Excel, puis
        vérifiez les changements avant de les appliquer. Les photos restent
        conservées dans le magasin.
      </p>
      {previewMode ? (
        <p className="notice amber">
          Cette fonction utilise les données réelles du magasin connecté. Elle
          n’est pas active dans l’aperçu.
        </p>
      ) : !status ? (
        <p>
          <Spinner /> Chargement de la protection…
        </p>
      ) : (
        <>
          <div className="transfer-protection">
            <ShieldCheck size={21} />
            <span>
              {status.unlocked
                ? "Accès aux mises à jour déverrouillé"
                : status.configured
                  ? "Code supplémentaire requis"
                  : "Définissez votre code de mise à jour"}
            </span>
          </div>
          {(!status.configured || changeCode) && (
            <form
              className="transfer-code-form"
              onSubmit={saveCode}
              autoComplete="off"
            >
              <p className="muted-copy">
                Ce code protège l’export et l’import, en plus de votre connexion
                administrateur. Il reste modifiable ici.
              </p>
              {status.configured && (
                <Field label="Code de mise à jour actuel">
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="off"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </Field>
              )}
              <div className="form-grid">
                <Field label="Nouveau code de mise à jour (8 caractères minimum)">
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                  />
                </Field>
                <Field label="Confirmer le code de mise à jour">
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </Field>
              </div>
              <div className="feature-actions">
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? <Spinner /> : <LockKeyhole size={17} />}Enregistrer le
                  code
                </button>
                {status.configured && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setChangeCode(false)}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          )}
          {status.configured && !status.unlocked && !changeCode && (
            <form
              className="transfer-unlock-form"
              onSubmit={unlock}
              autoComplete="off"
            >
              <Field label="Code de mise à jour">
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner /> : <LockKeyhole size={17} />}Déverrouiller
                les mises à jour
              </button>
            </form>
          )}
          {status.configured && !changeCode && (
            <button
              type="button"
              className="text-link transfer-change-code"
              onClick={() => setChangeCode(true)}
            >
              Changer le code de mise à jour
            </button>
          )}
          {status.unlocked && !changeCode && (
            <>
              <div className="transfer-steps">
                <div>
                  <b>1</b>
                  <span>Exporter les données actuelles</span>
                </div>
                <div>
                  <b>2</b>
                  <span>Modifier votre Excel</span>
                </div>
                <div>
                  <b>3</b>
                  <span>Vérifier puis appliquer</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={exportFile}
              >
                <Download size={18} />
                Télécharger le catalogue actuel en Excel
              </button>
              <div className="transfer-import">
                <Field label="Informations à mettre à jour">
                  <select
                    disabled={busy}
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as TransferMode);
                      setPlan(null);
                    }}
                  >
                    <option value="weights">
                      Poids uniquement — photos et autres champs conservés
                    </option>
                    <option value="all">
                      Les colonnes modifiées du fichier
                    </option>
                  </select>
                </Field>
                <p className="muted-copy">
                  Les colonnes grises d’identification et de photos sont
                  informatives. Les prix sont en DA et les poids en grammes.
                  Aucun nouveau produit n’est créé et aucun produit absent du
                  fichier n’est supprimé.
                </p>
                <label
                  className={"transfer-file-button " + (busy ? "is-busy" : "")}
                >
                  <Upload size={20} />
                  <span>
                    <b>Charger mon fichier Excel modifié</b>
                    <small>
                      .xlsx · 3 Mo · 5 000 produits maximum · sans formule
                    </small>
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={busy}
                    onChange={(e) => {
                      const input = e.currentTarget,
                        file = input.files?.[0];
                      if (file)
                        void action(() => importFile(file)).finally(() => {
                          input.value = "";
                        });
                    }}
                  />
                </label>
              </div>
              <div className="transfer-weights">
                <h3>Poids du document fourni</h3>
                <p>
                  Le poids PDF est prioritaire. Le poids Excel est utilisé s’il
                  manque. Les références inconnues et les poids absents sont
                  ignorés.
                </p>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      setPlan(null);
                      setPlan(
                        await localCall<Plan>("transfer-weights-preview", {}),
                      );
                    })
                  }
                >
                  <RefreshCw size={17} />
                  Préparer les poids PDF / Excel du document
                </button>
              </div>
              {busy && (
                <p className="transfer-working">
                  <Spinner /> Traitement en cours…
                </p>
              )}
              {message && (
                <p className="notice transfer-result">
                  <Check size={19} />
                  {message}
                </p>
              )}
              {plan && (
                <section className="transfer-review">
                  <h3>Vérifier les modifications proposées</h3>
                  <div className="transfer-counts">
                    <span>
                      <b>{plan.changes.length}</b> produits modifiés
                    </span>
                    <span>
                      <b>{plan.skipped.length}</b> lignes ignorées
                    </span>
                    <span>
                      <b>{plan.conflicts.length}</b> conflits
                    </span>
                  </div>
                  {!!plan.conflicts.length && (
                    <p className="notice amber">
                      Des données ont changé depuis l’export. Exportez une
                      nouvelle copie et recommencez pour préserver les dernières
                      modifications.
                    </p>
                  )}
                  {!!lines.length && (
                    <div className="transfer-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Référence / produit</th>
                            <th>Information</th>
                            <th>Avant</th>
                            <th>Après</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.slice(0, 300).map((line, i) => (
                            <tr key={i}>
                              <td>
                                <b>{line.code}</b>
                                <small>{line.name}</small>
                              </td>
                              <td>
                                {WORKBOOK_COLUMNS.find(
                                  (c) => c.field === line.field,
                                )?.label || line.field}
                              </td>
                              <td>{readable(line.field, line.before)}</td>
                              <td>{readable(line.field, line.after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {lines.length > 300 && (
                    <p className="muted-copy">
                      Les 300 premières modifications sont présentées. Le
                      rapport contient la liste complète.
                    </p>
                  )}
                  {!!plan.skipped.length && (
                    <details>
                      <summary>Lignes ignorées ({plan.skipped.length})</summary>
                      {plan.skipped.slice(0, 100).map((item, i) => (
                        <p key={i}>
                          <b>{item.code || "Sans référence"}</b> — {item.reason}
                        </p>
                      ))}
                    </details>
                  )}
                  {!!plan.conflicts.length && (
                    <details>
                      <summary>Conflits ({plan.conflicts.length})</summary>
                      {plan.conflicts.slice(0, 100).map((item, i) => (
                        <p key={i}>
                          {item.code} — {item.field}
                        </p>
                      ))}
                    </details>
                  )}
                  {!plan.changes.length && !plan.conflicts.length && (
                    <p className="notice">Aucune modification à appliquer.</p>
                  )}
                  <div className="feature-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        busy || !plan.changes.length || !!plan.conflicts.length
                      }
                      onClick={apply}
                    >
                      <Check size={18} />
                      Appliquer ces modifications
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => {
                        setPlan(null);
                        setMessage("");
                      }}
                    >
                      Annuler l’aperçu
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        download(
                          JSON.stringify(plan, null, 2),
                          "UNIPLAST-Rapport-mise-a-jour.json",
                          "application/json",
                        )
                      }
                    >
                      Télécharger le rapport complet
                    </button>
                  </div>
                </section>
              )}
              {backup && (
                <div className="transfer-backup">
                  <h3>Sauvegarde de la mise à jour</h3>
                  <p>
                    Une sauvegarde des valeurs précédentes a été créée
                    automatiquement.
                  </p>
                  <code>{backup}</code>
                  <div className="feature-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={backupFile}
                    >
                      <Download size={16} />
                      Télécharger la sauvegarde
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      onClick={restore}
                    >
                      Annuler cette mise à jour depuis la sauvegarde
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
