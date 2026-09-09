import sanitizeHtml from "sanitize-html";

/**
 * Render-time sanitization for admin-authored rich text (PRD §9.4 — "sanitized
 * with a strict allow-list … at render time, not just at save") and for
 * JSON-LD payloads (audit 2026-09-09 H-2: six `dangerouslySetInnerHTML` sites
 * rendered raw and no sanitizer existed anywhere in the repo).
 *
 * The allow-list mirrors the editorial shapes the admin editor produces:
 * typography, links, lists, tables, images. Everything else — scripts,
 * embeds, event handlers, javascript: URLs — is stripped.
 */

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "em", "b", "i", "u", "s", "br", "hr",
    "a",
    "img",
    "blockquote", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "td", "th",
    "span", "small", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "name", "title", "rel"],
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    span: ["class"],
  },
  // Links open safely; `javascript:`/`vbscript:` schemes are dropped by the
  // allowedSchemes policy below, and relative anchors are kept for in-page nav.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
  // `data:` images are the blur-placeholder pattern from PRD §10.5.
  allowProtocolRelative: false,
};

/** Sanitize admin-authored rich text to the §9.4 allow-list. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}

/**
 * JSON.stringify with `<`, `>`, `&`, U+2028/U+2029 escaped so the payload is
 * safe to embed inside a `<script type="application/ld+json">` element — a
 * literal `</script>` inside a title/description would otherwise close the
 * tag and inject markup (the classic JSON-LD breakout).
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
