"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TAGLINE = void 0;
exports.youtubeVideoId = youtubeVideoId;
exports.youtubeChannelUrl = youtubeChannelUrl;
exports.mediaFileUrl = mediaFileUrl;
exports.validateMediaSettings = validateMediaSettings;
exports.DEFAULT_TAGLINE = "La maîtrise de la plasturgie";
function youtubeUrl(value) {
    try {
        const u = new URL(value);
        return u.protocol === "https:" &&
            !u.username &&
            !u.password &&
            [
                "youtube.com",
                "www.youtube.com",
                "m.youtube.com",
                "youtu.be",
                "www.youtu.be",
            ].includes(u.hostname.toLowerCase())
            ? u
            : null;
    }
    catch {
        return null;
    }
}
function youtubeVideoId(value) {
    const u = youtubeUrl(value);
    if (!u)
        return null;
    const pieces = u.pathname.split("/").filter(Boolean);
    const id = u.hostname.endsWith("youtu.be")
        ? pieces[0]
        : u.pathname === "/watch"
            ? u.searchParams.get("v")
            : ["shorts", "embed", "live"].includes(pieces[0])
                ? pieces[1]
                : null;
    return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}
function youtubeChannelUrl(value) {
    const u = youtubeUrl(value);
    return u ? u.href : "";
}
function mediaFileUrl(value) {
    return /^\/api\/local\/file\?id=[a-f0-9-]{36}$/.test(value) ||
        (/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes(".."))
        ? value
        : "";
}
function validateMediaSettings(s) {
    if (s.topbar_tagline !== undefined &&
        (typeof s.topbar_tagline !== "string" || s.topbar_tagline.length > 200))
        return "La signature doit contenir au maximum 200 caractères.";
    if (s.youtube_url !== undefined &&
        (typeof s.youtube_url !== "string" ||
            s.youtube_url.length > 500 ||
            (s.youtube_url && !youtubeChannelUrl(s.youtube_url))))
        return "Utilisez un lien YouTube HTTPS valide.";
    if (s.videos_enabled !== undefined && typeof s.videos_enabled !== "boolean")
        return "Option vidéo invalide.";
    if (s.videos_title !== undefined &&
        (typeof s.videos_title !== "string" || s.videos_title.length > 150))
        return "Le titre de la rubrique vidéo est trop long.";
    if (s.videos === undefined)
        return null;
    if (!Array.isArray(s.videos) ||
        s.videos.length > 12 ||
        new Set(s.videos.map((v) => v?.id)).size !== s.videos.length)
        return "12 vidéos maximum, sans identifiant répété.";
    for (const v of s.videos) {
        if (!v ||
            typeof v.id !== "string" ||
            !/^[a-f0-9-]{36}$/i.test(v.id) ||
            typeof v.title !== "string" ||
            !v.title.trim() ||
            v.title.length > 150 ||
            typeof v.visible !== "boolean" ||
            !["youtube", "upload"].includes(v.source) ||
            typeof v.url !== "string" ||
            v.url.length > 500 ||
            typeof v.poster_url !== "string")
            return "Vérifiez le titre et la source de chaque vidéo.";
        if (v.url &&
            (v.source === "youtube" ? !youtubeVideoId(v.url) : !mediaFileUrl(v.url)))
            return "Une vidéo doit utiliser un lien YouTube reconnu ou un fichier du magasin.";
        if (v.visible && !v.url)
            return "Ajoutez le lien ou le fichier avant d’afficher une vidéo.";
        if (v.poster_url && !mediaFileUrl(v.poster_url))
            return "L’affiche vidéo doit être une image du magasin.";
    }
    return null;
}
