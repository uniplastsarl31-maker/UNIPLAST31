"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canBuy = exports.discountPercent = exports.priceOf = exports.REQUEST_LABELS = exports.ORDER_LABELS = void 0;
exports.normalizeSearch = normalizeSearch;
exports.activeDiscount = activeDiscount;
exports.assertQuantity = assertQuantity;
exports.orderLine = orderLine;
exports.activeSeasons = activeSeasons;
exports.safeWebUrl = safeWebUrl;
exports.cartTotals = cartTotals;
exports.money = money;
exports.timeRemaining = timeRemaining;
exports.validateProduct = validateProduct;
exports.salesStats = salesStats;
exports.rankProducts = rankProducts;
exports.ORDER_LABELS = {
    new: "Nouvelle",
    confirmed: "Confirmée",
    preparing: "En préparation",
    delivered: "Livrée",
    cancelled: "Annulée",
};
exports.REQUEST_LABELS = {
    pending: "À examiner",
    reviewing: "En cours d’examen",
    accepted: "Acceptée",
    declined: "Déclinée",
};
function normalizeSearch(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[٠-٩]/g, (s) => String(s.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (s) => String(s.charCodeAt(0) - 1776))
        .toLowerCase()
        .trim();
}
function activeDiscount(product, now = Date.now()) {
    if (product.price_hidden)
        return (!!product.public_discount_percent &&
            !!product.discount_start &&
            !!product.discount_end &&
            Date.parse(product.discount_start) <= now &&
            now < Date.parse(product.discount_end));
    return (product.discount_price_cents !== null &&
        product.discount_price_cents >= 0 &&
        product.discount_price_cents < product.unit_price_cents &&
        !!product.discount_start &&
        !!product.discount_end &&
        Date.parse(product.discount_start) <= now &&
        now < Date.parse(product.discount_end));
}
const priceOf = (p, now = Date.now()) => p.price_hidden
    ? 0
    : activeDiscount(p, now)
        ? p.discount_price_cents
        : p.unit_price_cents;
exports.priceOf = priceOf;
const discountPercent = (p, now = Date.now()) => p.price_hidden
    ? activeDiscount(p, now)
        ? p.public_discount_percent || 0
        : 0
    : p.unit_price_cents > 0 && activeDiscount(p, now)
        ? Math.round((100 * (p.unit_price_cents - (0, exports.priceOf)(p, now))) / p.unit_price_cents)
        : 0;
exports.discountPercent = discountPercent;
const canBuy = (p) => !p.price_hidden &&
    p.available &&
    p.availability_confirmed &&
    !p.price_on_request &&
    !p.upcoming &&
    (p.stock_cartons === null || p.stock_cartons > 0);
exports.canBuy = canBuy;
function assertQuantity(cartons, product) {
    if (!Number.isInteger(cartons) || cartons < 1 || cartons > 10000)
        throw new Error("Le nombre de cartons doit être un entier compris entre 1 et 10000.");
    if (product &&
        product.stock_cartons !== null &&
        cartons > product.stock_cartons)
        throw new Error(`Stock disponible : ${product.stock_cartons} ${product.pack_label}(s).`);
}
function orderLine(product, cartons, now = Date.now()) {
    if (product.price_hidden)
        throw new Error("Connectez-vous avec un compte agréé pour consulter les tarifs.");
    assertQuantity(cartons);
    const unit = (0, exports.priceOf)(product, now), units = cartons * product.pack_size;
    return {
        product_id: product.id,
        name: product.name,
        code: product.code,
        barcode: product.barcode,
        pack_label: product.pack_label,
        unit_price_cents: unit,
        original_unit_price_cents: product.unit_price_cents,
        pack_size: product.pack_size,
        cartons,
        total_units: units,
        carton_price_cents: unit * product.pack_size,
        discount_cents: (product.unit_price_cents - unit) * units,
        total_cents: unit * units,
    };
}
function activeSeasons(seasons, timezone, now = Date.now()) {
    const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
    return seasons.filter((s) => s.visible && s.starts_on <= day && day <= s.ends_on);
}
function safeWebUrl(value) {
    if (!value)
        return "";
    if (/^\/api\/local\/file\?id=[a-f0-9-]{36}$/.test(value))
        return value;
    try {
        const u = new URL(value);
        return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
    }
    catch {
        return "";
    }
}
function cartTotals(cart, products, shipping = 0, now = Date.now()) {
    const lines = cart.flatMap((item) => {
        const p = products.find((p) => p.id === item.product_id);
        return p ? [orderLine(p, item.cartons, now)] : [];
    });
    const discounted = lines.reduce((s, i) => s + i.total_cents, 0), discount = lines.reduce((s, i) => s + i.discount_cents, 0);
    return {
        lines,
        subtotal: discounted + discount,
        discount,
        shipping: lines.length ? shipping : 0,
        total: discounted + (lines.length ? shipping : 0),
        cartons: lines.reduce((s, i) => s + i.cartons, 0),
        units: lines.reduce((s, i) => s + i.total_units, 0),
    };
}
function money(cents, currency = "DZD") {
    const val = new Intl.NumberFormat("fr-DZ", {
        minimumFractionDigits: cents % 100 ? 2 : 0,
        maximumFractionDigits: 2,
    }).format(cents / 100);
    return `${val} ${currency === "DZD" ? "DA" : currency}`;
}
function timeRemaining(end, now = Date.now()) {
    if (!end)
        return "";
    const diff = Date.parse(end) - now;
    if (diff <= 0)
        return "Offre terminée";
    const days = Math.floor(diff / 86400000), hours = Math.floor(diff / 3600000) % 24, mins = Math.floor(diff / 60000) % 60;
    return days > 0 ? `${days} j ${hours} h` : `${hours} h ${mins} min`;
}
function validateProduct(p) {
    if (!p.name.trim() || !p.code.trim() || !p.family_id)
        return "Le nom, la référence et la collection sont obligatoires.";
    if (p.name.length > 150 ||
        p.code.length > 80 ||
        (p.barcode && p.barcode.length > 80))
        return "Le nom, la référence ou le code-barres dépasse la longueur autorisée.";
    if (!Number.isSafeInteger(p.unit_price_cents) ||
        p.unit_price_cents < 0 ||
        p.unit_price_cents > 100000000)
        return "Saisissez un prix valide inférieur ou égal à un million.";
    if (!Number.isInteger(p.pack_size) || p.pack_size < 1 || p.pack_size > 10000)
        return "Le colisage doit être un entier compris entre 1 et 10000.";
    if (p.stock_cartons !== null &&
        (!Number.isInteger(p.stock_cartons) || p.stock_cartons < 0))
        return "Le stock doit être un nombre entier de cartons positif ou nul.";
    if (p.discount_price_cents !== null) {
        if (p.price_on_request)
            return "Renseignez un tarif avant de configurer une promotion.";
        if (!Number.isInteger(p.discount_price_cents) ||
            p.discount_price_cents < 0 ||
            p.discount_price_cents >= p.unit_price_cents)
            return "Le prix remisé doit être positif ou nul et inférieur au prix initial.";
        if (!p.discount_start ||
            !p.discount_end ||
            !Number.isFinite(Date.parse(p.discount_start)) ||
            !Number.isFinite(Date.parse(p.discount_end)) ||
            Date.parse(p.discount_start) >= Date.parse(p.discount_end))
            return "Définissez une période de promotion valide.";
    }
    if (p.images.length > 10)
        return "10 images maximum par produit.";
    return null;
}
function salesStats(orders, since = 0) {
    const included = orders.filter((o) => !o.preview &&
        ["confirmed", "preparing", "delivered"].includes(o.status) &&
        Date.parse(o.created_at) >= since);
    const revenue = included.reduce((s, o) => s + o.total_cents, 0), units = included
        .flatMap((o) => o.items)
        .reduce((s, i) => s + i.total_units, 0), cartons = included
        .flatMap((o) => o.items)
        .reduce((s, i) => s + i.cartons, 0);
    const products = {};
    included.forEach((o) => o.items.forEach((i) => {
        const p = (products[i.product_id] ??= {
            name: i.name,
            cartons: 0,
            units: 0,
            revenue: 0,
        });
        p.cartons += i.cartons;
        p.units += i.total_units;
        p.revenue += i.total_cents;
    }));
    return {
        revenue,
        count: included.length,
        average: included.length ? Math.round(revenue / included.length) : 0,
        units,
        cartons,
        products: Object.entries(products).sort((a, b) => b[1].cartons - a[1].cartons),
    };
}
/** Transparent ranking: manual pins/order, availability, completed sales, then expiring offers. */
function rankProducts(products, sales, now = Date.now()) {
    const score = (p) => (p.pinned ? 1e9 : 0) +
        ((0, exports.canBuy)(p) ? 1e7 : 0) +
        (sales[p.id] || 0) * 1000 +
        (activeDiscount(p, now)
            ? Math.max(0, 300 - (Date.parse(p.discount_end) - now) / 3600000)
            : 0) -
        p.sort_order;
    return [...products].sort((a, b) => score(b) - score(a));
}
