import { validatedFile } from "./fileFormats";
import { createClient } from "@supabase/supabase-js";
import type {
  Catalog,
  CartItem,
  Customer,
  Family,
  Order,
  OrderStatus,
  Product,
  ProductImage,
  RequestRecord,
  Settings,
  CustomerAccess,
} from "./types";
import { defaultSettings } from "./catalog";
import { localMode, localCall, localUpload, imageLimitMo } from "./localApi";
export { localMode, localCall } from "./localApi";
import { canBuy, cartTotals, validateProduct, safeWebUrl } from "./domain";

const url = import.meta.env.VITE_SUPABASE_URL?.trim(),
  key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const previewMode = __PREVIEW_BUILD__;
export const supabase =
  !previewMode && !localMode
    ? createClient(url!, key!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
let memory: Catalog,
  previewAdmin = false,
  previewMember = false;
const previewReady = __PREVIEW_BUILD__
  ? import("./previewCatalog").then((m) => {
      memory = m.defaultCatalog();
    })
  : Promise.resolve();
const previewMembers: CustomerAccess[] = [];
const previewOrders: Order[] = [],
  previewRequests: RequestRecord[] = [];
const previewRequestKeys = new Map<string, RequestRecord>();

async function readAll<T>(
  table: string,
  select = "*",
  order = "created_at",
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase!
      .from(table)
      .select(select)
      .order(order, { ascending: order === "sort_order" })
      .order("id")
      .range(offset, offset + 999);
    if (error) fail(error);
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

function fail(error: unknown): never {
  const e = error as { code?: string; message?: string };
  if (e.code === "23505")
    throw new Error(
      "La référence ou le code-barres existe déjà. Utilisez une valeur distincte.",
    );
  if (e.code === "23514")
    throw new Error(
      "Une valeur est invalide. Vérifiez les tarifs, la période de remise et les champs obligatoires.",
    );
  if (e.code === "22P02")
    throw new Error(
      "Le format d’une valeur est incorrect. Les quantités doivent être des nombres entiers.",
    );
  if (e.message?.includes("PRICES_CHANGED"))
    throw new Error(
      "Le prix, le colisage ou les frais ont changé. Actualisez le panier et vérifiez le total avant de confirmer à nouveau.",
    );
  if (e.message?.includes("APPROVAL_REQUIRED"))
    throw new Error(
      "Les tarifs et commandes sont réservés aux clients agréés. Connectez-vous à votre compte.",
    );
  if (e.message?.includes("UNAVAILABLE"))
    throw new Error(
      "Un produit ne peut plus être commandé dans la quantité demandée. Actualisez le panier.",
    );
  if (e.message?.includes("RATE_LIMIT"))
    throw new Error(
      "Plusieurs demandes ont été envoyées en peu de temps. Réessayez dans une minute.",
    );
  if (e.message?.includes("FAMILY_NOT_EMPTY"))
    throw new Error(
      "Transférez les produits vers une autre collection avant la suppression.",
    );
  if (e.message?.includes("Invalid login credentials"))
    throw new Error("Adresse e-mail ou mot de passe incorrect.");
  if (e.code === "42501" || e.message?.includes("ADMIN_REQUIRED"))
    throw new Error("Vous ne disposez pas des droits nécessaires.");
  if (
    e.message?.includes("Failed to fetch") ||
    e.message?.includes("fetch failed")
  )
    throw new Error(
      "Connexion interrompue. Vérifiez votre réseau et réessayez avec le même panier.",
    );
  throw new Error(
    e.message || "Opération impossible. Vérifiez la connexion et réessayez.",
  );
}
async function ensureCustomer() {
  if (!supabase)
    throw new Error("Cet aperçu n’est pas connecté à une base de données.");
  const { data, error } = await supabase.auth.getSession();
  if (error) fail(error);
  if (data.session) return data.session.user.id;
  const result = await supabase.auth.signInAnonymously();
  if (result.error)
    throw new Error(
      "Impossible de créer une session sécurisée. Vérifiez la configuration des connexions anonymes dans Supabase.",
    );
  return result.data.user!.id;
}
export async function loadCatalog(): Promise<Catalog> {
  if (localMode) return localCall<Catalog>("catalog");
  if (previewMode) {
    await previewReady;
    const c = structuredClone(memory);
    if (
      !previewAdmin &&
      !(previewMember && previewMembers.some((m) => m.status === "approved")) &&
      c.settings.price_visibility === "approved"
    )
      c.products = c.products.map((p) => ({
        ...p,
        price_hidden: true,
        unit_price_cents: 0,
        discount_price_cents: null,
        discount_start: null,
        discount_end: null,
        source_metadata: undefined,
      }));
    return c;
  }
  const results = await Promise.all([
    readCatalogProducts(),
    readAll<Family>("families", "*", "sort_order"),
    supabase!.from("store_settings").select("*").eq("id", true).single(),
    supabase!.rpc("catalog_sales"),
  ]);
  for (const r of results.slice(2)) if ("error" in r && r.error) fail(r.error);
  const sales: Record<string, number> = {};
  for (const s of results[3].data || [])
    sales[s.product_id] = Number(s.cartons);
  return {
    products: results[0],
    families: results[1],
    settings: { ...defaultSettings, ...results[2].data } as Settings,
    sales,
  };
}
async function readCatalogProducts(): Promise<Product[]> {
  const products: Product[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase!.rpc("get_catalog_products", {
      p_offset: offset,
      p_limit: 500,
    });
    if (error) fail(error);
    products.push(...(data as Product[]));
    if (data.length < 500) return products;
  }
}
export function watchCatalog(callback: () => void): () => void {
  if (localMode) {
    const timer = window.setInterval(callback, 30000);
    return () => window.clearInterval(timer);
  }
  if (!supabase) return () => {};
  const c = supabase
    .channel("catalog-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      callback,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "families" },
      callback,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "store_settings" },
      callback,
    )
    .subscribe();
  const timer = window.setInterval(callback, 30000); // Reliable fallback if Realtime is not enabled.
  return () => {
    void supabase.removeChannel(c);
    window.clearInterval(timer);
  };
}
export async function isAdmin(): Promise<boolean> {
  if (localMode) return (await localCall("status")).admin;
  if (previewMode) return previewAdmin;
  const { data: session } = await supabase!.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await supabase!.rpc("is_admin");
  if (error) return false;
  return data === true;
}
export async function login(email: string, password: string) {
  if (localMode) return localCall("admin-login", { password });
  if (!supabase)
    throw new Error(
      "Utilisez le bouton de gestion en aperçu. La connexion réelle nécessite la configuration de Supabase.",
    );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(error);
  if (!(await isAdmin())) {
    await supabase.auth.signOut();
    throw new Error("Ce compte ne possède pas les droits administrateur.");
  }
}
export function enablePreviewAdmin() {
  previewAdmin = true;
}
export async function logout() {
  if (localMode) return localCall("logout", {});
  previewAdmin = false;
  previewMember = false;
  if (supabase) {
    const { error: revokeError } = await supabase.rpc("lock_customer");
    if (revokeError) fail(revokeError);
    const { error } = await supabase.auth.signOut();
    if (error) fail(error);
  }
}
export async function resetPassword(email: string) {
  if (!supabase)
    throw new Error(
      "La récupération du mot de passe sera disponible après configuration du service de connexion.",
    );
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) fail(error);
}
export async function updatePassword(password: string) {
  if (!supabase)
    throw new Error("Le service de connexion n’est pas configuré.");
  if (password.length < 12)
    throw new Error("Utilisez un mot de passe de 12 caractères au minimum.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error);
}
export async function customerSession() {
  if (localMode)
    return (await localCall("status")).session as {
      email: string;
      personal: boolean;
      guest: boolean;
      access: CustomerAccess | null;
    };
  if (previewMode)
    return {
      email: previewMember ? "client.apercu@example.invalid" : "",
      personal: previewMember,
      guest: false,
      access: previewMembers.find((m) => m.user_id === "preview") || null,
    };
  const { data, error } = await supabase!.auth.getSession();
  if (error) fail(error);
  const user = data.session?.user;
  if (!user) return { email: "", personal: false, guest: false, access: null };
  const result = await supabase!.rpc("customer_code_session");
  if (result.error) fail(result.error);
  return {
    email: "",
    personal: !!result.data,
    guest: !result.data,
    access: result.data as CustomerAccess | null,
  };
}
export async function customerLogin(phone: string, pin: string) {
  if (localMode) return localCall("client-login", { phone, pin });
  if (!supabase)
    throw new Error(
      "Ouvrez la version locale avec RUN.BAT pour utiliser les codes clients enregistrés.",
    );
  await ensureCustomer();
  const r = await supabase.rpc("unlock_customer", {
    p_phone: phone,
    p_pin: pin,
  });
  if (r.error) fail(r.error);
  if (!r.data?.ok)
    throw new Error(r.data?.error || "Téléphone ou code incorrect.");
}
export async function createCustomerAccount(email: string, password: string) {
  if (!supabase)
    throw new Error(
      "La création de compte nécessite la connexion du service sécurisé.",
    );
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.is_anonymous) {
    const { error } = await supabase.auth.updateUser(
      { email },
      {
        emailRedirectTo:
          window.location.origin + window.location.pathname + "?setup=password",
      },
    );
    if (error) fail(error);
    return "verify-first";
  } else {
    if (password.length < 12)
      throw new Error(
        "Utilisez au moins 12 caractères pour votre mot de passe.",
      );
    if (data.session) throw new Error("Un compte est déjà connecté.");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) fail(error);
    return "created";
  }
}
export async function requestCustomerAccess(name: string, phone: string) {
  if (previewMode) {
    if (!previewMember) throw new Error("Ouvrez la simulation client.");
    if (!previewMembers.length)
      previewMembers.push({
        user_id: "preview",
        name,
        phone,
        email: "client.apercu@example.invalid",
        status: "pending",
        created_at: new Date().toISOString(),
      });
    return;
  }
  const { error } = await supabase!.rpc("request_customer_access", {
    p_name: name,
    p_phone: phone,
  });
  if (error) fail(error);
}
export function simulateCustomer() {
  if (previewMode) {
    previewAdmin = false;
    previewMember = true;
  }
}
export async function listCustomerAccess(): Promise<CustomerAccess[]> {
  if (localMode) return localCall<CustomerAccess[]>("codes-list", {});
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    return structuredClone(previewMembers);
  }
  const { data, error } = await supabase!.rpc("list_customer_codes");
  if (error) fail(error);
  return data as CustomerAccess[];
}
export async function setCustomerAccess(
  id: string,
  status: CustomerAccess["status"],
) {
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    const c = previewMembers.find((m) => m.user_id === id);
    if (c) c.status = status;
    return;
  }
  const { error } = await supabase!.rpc("set_customer_access", {
    p_user_id: id,
    p_status: status,
  });
  if (error) fail(error);
}
export async function uploadCompanyCatalog(file: File): Promise<string> {
  if (localMode) return localUpload(file, true);
  if (file.type !== "application/pdf" || file.size > 15 * 1024 * 1024)
    throw new Error("Choisissez un PDF de 15 Mo au maximum.");
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== "%PDF-")
    throw new Error("Le fichier ne contient pas un document PDF valide.");
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    return URL.createObjectURL(file);
  }
  const path = crypto.randomUUID() + ".pdf";
  const { error } = await supabase!.storage
    .from("company-catalogs")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) fail(error);
  return supabase!.storage.from("company-catalogs").getPublicUrl(path).data
    .publicUrl;
}
export async function saveProduct(product: Product) {
  if (localMode) return localCall("product-save", product);
  const error = validateProduct(product);
  if (error) throw new Error(error);
  if (previewMode) {
    if (!previewAdmin)
      throw new Error("Ouvrez d’abord le tableau de bord en aperçu.");
    if (
      memory.products.some(
        (p) =>
          p.id !== product.id &&
          (p.code.toLowerCase() === product.code.toLowerCase() ||
            (!!product.barcode && p.barcode === product.barcode)),
      )
    )
      throw new Error("Cette référence ou ce code-barres est déjà utilisé.");
    const index = memory.products.findIndex((p) => p.id === product.id);
    if (index < 0) memory.products.push(structuredClone(product));
    else memory.products[index] = structuredClone(product);
    return;
  }
  const { demo, price_hidden, ...safe } = product;
  const { error: e } = await supabase!.from("products").upsert(safe);
  if (e) fail(e);
}
export async function removeProduct(id: string) {
  if (localMode) return localCall("product-delete", { id });
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    memory.products = memory.products.filter((p) => p.id !== id);
    return;
  }
  const { error } = await supabase!.from("products").delete().eq("id", id);
  if (error) fail(error);
}
export async function saveFamily(family: Family) {
  if (localMode) return localCall("family-save", family);
  if (!family.name.trim())
    throw new Error("Le nom de la collection est obligatoire.");
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    const i = memory.families.findIndex((f) => f.id === family.id);
    if (i < 0) memory.families.push({ ...family });
    else memory.families[i] = { ...family };
    return;
  }
  const { error } = await supabase!.from("families").upsert(family);
  if (error) fail(error);
}
export async function deleteFamily(id: string, target: string | null) {
  if (localMode) return localCall("family-delete", { id, target });
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    if (
      memory.products.some((p) => p.family_id === id) &&
      (!target || target === id)
    )
      throw new Error(
        "Transférez les produits vers une autre collection avant la suppression.",
      );
    if (target && !memory.families.some((f) => f.id === target))
      throw new Error("La collection de destination est introuvable.");
    memory.products.forEach((p) => {
      if (p.family_id === id) p.family_id = target!;
    });
    memory.families = memory.families.filter((f) => f.id !== id);
    return;
  }
  const { error } = await supabase!.rpc("delete_family", {
    p_family_id: id,
    p_target_id: target,
  });
  if (error) fail(error);
}
export async function reorderFamilies(ids: string[]) {
  if (localMode) return localCall("family-reorder", { ids });
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    memory.families.forEach((f) => {
      const i = ids.indexOf(f.id);
      if (i >= 0) f.sort_order = i;
    });
    return;
  }
  const { error } = await supabase!.rpc("reorder_families", { p_ids: ids });
  if (error) fail(error);
}
export async function saveSettings(settings: Settings) {
  if (localMode) return localCall("settings-save", settings);
  for (const value of [
    settings.website_url,
    settings.facebook_url,
    settings.catalog_pdf_url,
  ]) {
    if (
      value &&
      !safeWebUrl(value) &&
      !(previewMode && value.startsWith("blob:"))
    )
      throw new Error(
        "Utilisez un lien HTTPS valide, sans identifiant ni mot de passe.",
      );
  }
  if (
    settings.seasons.length > 20 ||
    settings.seasons.some(
      (s) =>
        !s.title.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(s.starts_on) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(s.ends_on) ||
        s.starts_on > s.ends_on,
    )
  )
    throw new Error(
      "Vérifiez le nom et les dates de chaque sélection saisonnière.",
    );
  if (
    !/^[A-Z]{3}$/.test(settings.currency) ||
    !Number.isInteger(settings.shipping_cents) ||
    settings.shipping_cents < 0
  )
    throw new Error("Vérifiez la devise et les frais de livraison.");
  try {
    new Intl.DateTimeFormat("ar", { timeZone: settings.timezone }).format();
  } catch {
    throw new Error("Le fuseau horaire est invalide.");
  }
  if (
    !/^#[0-9a-f]{6}$/i.test(settings.primary_color) ||
    !/^#[0-9a-f]{6}$/i.test(settings.accent_color)
  )
    throw new Error("La couleur doit être un code hexadécimal valide.");
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    memory.settings = structuredClone(settings);
    return;
  }
  const { error } = await supabase!.from("store_settings").upsert(settings);
  if (error) fail(error);
}
export async function placeOrder(
  cart: CartItem[],
  products: Product[],
  customer: Customer,
  settings: Settings,
  idempotencyKey: string,
): Promise<Order> {
  if (localMode)
    return localCall<Order>("order-create", {
      cart,
      customer,
      key: idempotencyKey,
      expected: cartTotals(cart, products, settings.shipping_cents).lines,
      currency: settings.currency,
      shipping: settings.shipping_cents,
    });
  if (!cart.length) throw new Error("Le panier est vide.");
  for (const item of cart) {
    const p = products.find((p) => p.id === item.product_id);
    if (
      !p ||
      !canBuy(p) ||
      (previewMode &&
        !memory.families.some((f) => f.id === p.family_id && f.visible))
    )
      throw new Error("Un produit est indisponible. Vérifiez le panier.");
  }
  const totals = cartTotals(cart, products, settings.shipping_cents);
  if (previewMode) {
    const found = previewOrders.find(
      (o) => o.idempotency_key === idempotencyKey,
    );
    if (found) return found;
    const order: Order = {
      id: crypto.randomUUID(),
      reference: `PREVIEW-${String(previewOrders.length + 1).padStart(4, "0")}`,
      user_id: "preview",
      created_at: new Date().toISOString(),
      status: "new",
      customer: { ...customer },
      items: totals.lines,
      subtotal_cents: totals.subtotal,
      discount_cents: totals.discount,
      shipping_cents: totals.shipping,
      total_cents: totals.total,
      currency: settings.currency,
      company_snapshot: {
        company_name: settings.company_name,
        logo_url: settings.logo_url,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        tax_note: settings.tax_note,
        timezone: settings.timezone,
      },
      idempotency_key: idempotencyKey,
      preview: true,
    };
    previewOrders.unshift(order);
    return structuredClone(order);
  }
  await ensureCustomer();
  const { data, error } = await supabase!.rpc("create_order", {
    p_lines: totals.lines.map((i) => ({
      product_id: i.product_id,
      cartons: i.cartons,
      expected_unit_price_cents: i.unit_price_cents,
      expected_pack_size: i.pack_size,
    })),
    p_customer: customer,
    p_idempotency_key: idempotencyKey,
    p_expected_shipping_cents: settings.shipping_cents,
    p_expected_currency: settings.currency,
  });
  if (error) fail(error);
  return data as Order;
}
export async function listOrders(admin = false): Promise<Order[]> {
  if (localMode) return localCall<Order[]>("orders-list", { admin });
  if (previewMode) return structuredClone(previewOrders);
  if (!admin) {
    const { data } = await supabase!.auth.getSession();
    if (!data.session) return [];
  }
  return readAll<Order>("orders", "*,items:order_items(*)");
}
export async function changeOrderStatus(id: string, status: OrderStatus) {
  if (localMode) return localCall("order-status", { id, status });
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    const o = previewOrders.find((o) => o.id === id);
    if (o) o.status = status;
    return;
  }
  const { error } = await supabase!.rpc("set_order_status", {
    p_order_id: id,
    p_status: status,
  });
  if (error) fail(error);
}
export async function listRequests(): Promise<RequestRecord[]> {
  if (localMode) return localCall<RequestRecord[]>("requests-list", {});
  if (previewMode) return structuredClone(previewRequests);
  return readAll<RequestRecord>("customer_requests");
}
export async function submitRequest(
  request: Omit<
    RequestRecord,
    "id" | "reference" | "user_id" | "created_at" | "status"
  >,
  requestKey: string,
) {
  if (localMode)
    return localCall<RequestRecord>("request-create", {
      request,
      key: requestKey,
    });
  if (previewMode) {
    const previous = previewRequestKeys.get(requestKey);
    if (previous) return structuredClone(previous);
    const r: RequestRecord = {
      ...request,
      id: crypto.randomUUID(),
      reference: `PREVIEW-REQ-${previewRequests.length + 1}`,
      user_id: "preview",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    previewRequests.unshift(r);
    previewRequestKeys.set(requestKey, r);
    return r;
  }
  await ensureCustomer();
  const { data, error } = await supabase!.rpc("create_customer_request", {
    p_kind: request.kind,
    p_product_id: request.product_id,
    p_cartons: request.cartons,
    p_customer: request.customer,
    p_details: request.details,
    p_idempotency_key: requestKey,
  });
  if (error) fail(error);
  return data as RequestRecord;
}
export async function changeRequestStatus(
  id: string,
  status: RequestRecord["status"],
) {
  if (localMode) return localCall("request-status", { id, status });
  if (previewMode) {
    if (!previewAdmin) throw new Error("Accès non autorisé.");
    const r = previewRequests.find((r) => r.id === id);
    if (r) r.status = status;
    return;
  }
  const { error } = await supabase!
    .from("customer_requests")
    .update({ status })
    .eq("id", id);
  if (error) fail(error);
}
export async function uploadProductImage(file: File): Promise<ProductImage> {
  file = await validatedFile(file, imageLimitMo);
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    if (typeof createImageBitmap !== "function") throw new Error("fallback");
    bitmap = await createImageBitmap(file);
  } catch {
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      bitmap = image;
    } catch {
      throw new Error(
        "Impossible de lire cette image. Vérifiez qu’elle s’ouvre dans votre téléphone.",
      );
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  const canvas = document.createElement("canvas"),
    ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();
  const optimized = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Impossible de préparer cette image.")),
      "image/webp",
      0.86,
    ),
  );
  if (localMode) {
    const original_url = await localUpload(file, true),
      url = await localUpload(optimized, true);
    return { url, original_url, scale: 1, x: 0, y: 0 };
  }
  if (previewMode) {
    const original = URL.createObjectURL(file);
    return {
      url: URL.createObjectURL(optimized),
      original_url: original,
      scale: 1,
      x: 0,
      y: 0,
    };
  }
  const id = crypto.randomUUID(),
    ext =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";
  const originalPath = `${id}/original.${ext}`,
    displayPath = `${id}/display.${optimized.type === "image/png" ? "png" : "webp"}`;
  const original = await supabase!.storage
    .from("product-images")
    .upload(originalPath, file, { upsert: false, contentType: file.type });
  if (original.error) fail(original.error);
  const display = await supabase!.storage
    .from("product-images")
    .upload(displayPath, optimized, {
      upsert: false,
      contentType: optimized.type,
    });
  if (display.error) {
    await supabase!.storage.from("product-images").remove([originalPath]);
    fail(display.error);
  }
  return {
    url: supabase!.storage.from("product-images").getPublicUrl(displayPath).data
      .publicUrl,
    original_url: supabase!.storage
      .from("product-images")
      .getPublicUrl(originalPath).data.publicUrl,
    scale: 1,
    x: 0,
    y: 0,
  };
}
export async function uploadReference(file: File): Promise<string> {
  file = await validatedFile(file, imageLimitMo, true);
  if (localMode) return localUpload(file, false);
  if (previewMode) return URL.createObjectURL(file);
  const uid = await ensureCustomer();
  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase!.storage
    .from("request-attachments")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) fail(error);
  return path;
}
export async function referenceLink(path: string) {
  if (localMode) return path;
  if (previewMode) return path;
  const { data, error } = await supabase!.storage
    .from("request-attachments")
    .createSignedUrl(path, 300);
  if (error) fail(error);
  return data.signedUrl;
}
export async function clearPreview() {
  if (__PREVIEW_BUILD__)
    memory = (await import("./previewCatalog")).defaultCatalog();
  else return;
  previewMember = false;
  previewMembers.length = 0;
  previewOrders.length = 0;
  previewRequests.length = 0;
  previewRequestKeys.clear();
}

export async function saveCustomerCode(input: {
  id?: string;
  name: string;
  phone: string;
  pin: string;
  enabled: boolean;
}) {
  if (localMode) return localCall("codes-save", input);
  if (!supabase)
    throw new Error(
      "Les codes persistants sont disponibles dans la version RUN.BAT.",
    );
  const { data, error } = await supabase.rpc("save_customer_code", {
    p_id: input.id || null,
    p_name: input.name,
    p_phone: input.phone,
    p_pin: input.pin || null,
    p_enabled: input.enabled,
  });
  if (error) fail(error);
  return data;
}
export async function changeAdminPassword(current: string, password: string) {
  if (localMode) return localCall("admin-password", { current, password });
  return updatePassword(password);
}
export interface Feedback {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
}
export async function sendFeedback(input: {
  name: string;
  phone: string;
  message: string;
}) {
  if (localMode) return localCall("feedback-create", input);
  if (!supabase)
    throw new Error(
      "Ouvrez la version RUN.BAT pour transmettre votre suggestion.",
    );
  const { error } = await supabase.rpc("submit_feedback", {
    p_name: input.name,
    p_phone: input.phone,
    p_message: input.message,
  });
  if (error) fail(error);
}
export async function listFeedback(): Promise<Feedback[]> {
  if (localMode) return localCall("feedback-list", {});
  if (!supabase) return [];
  return readAll<Feedback>(
    "customer_feedback",
    "id,name,phone,message,status,created_at",
  );
}
export async function setFeedbackStatus(
  id: string,
  status: Feedback["status"],
) {
  if (localMode) return localCall("feedback-status", { id, status });
  if (!supabase) throw new Error("Le service de stockage est indisponible.");
  const { error } = await supabase
    .from("customer_feedback")
    .update({ status })
    .eq("id", id);
  if (error) fail(error);
}
