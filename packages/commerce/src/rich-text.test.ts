import { describe, expect, it } from "vitest";
import { safeJsonLd, sanitizeRichText } from "./rich-text";

/**
 * Contract (PRD §9.4 + audit 2026-09-09 H-2): admin-authored rich text is
 * sanitized at RENDER time with a strict allow-list; JSON-LD payloads cannot
 * break out of their <script type="application/ld+json"> tag.
 */

describe("sanitizeRichText", () => {
  it("keeps allowed structural typography intact", () => {
    const html = '<h2>Care</h2><p>Oak <strong>frame</strong>, <em>oiled</em>.</p><ul><li>Item</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps safe links and images with their attributes", () => {
    const html =
      '<p><a href="https://example.com/a" rel="noopener noreferrer">doc</a></p>' +
      '<img src="/products/x.svg" alt="A chair">';
    const out = sanitizeRichText(html);
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('src="/products/x.svg"');
    expect(out).toContain('alt="A chair"');
  });

  it("strips script and style tags entirely, including their content", () => {
    const out = sanitizeRichText('<p>ok</p><script>alert(1)</script><style>.x{}</style>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).not.toContain("style");
    expect(out).toContain("<p>ok</p>");
  });

  it("strips iframe/embed/object", () => {
    const out = sanitizeRichText('<iframe src="https://evil.example"></iframe><p>ok</p>');
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("evil.example");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizeRichText('<p onmouseover="steal()">hover</p><img src="/a.svg" onerror="x()" alt="a">');
    expect(out).not.toContain("onmouseover");
    expect(out).not.toContain("onerror");
    expect(out).toContain("hover");
  });

  it("neutralizes javascript: URLs", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">bad</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("bad");
  });

  it("drops disallowed attributes like target without a rel pair", () => {
    const out = sanitizeRichText('<a href="https://example.com" target="_blank" onclick="x()">l</a>');
    expect(out).not.toContain("onclick");
  });

  it("returns an empty string for empty/null/undefined input", () => {
    expect(sanitizeRichText("")).toBe("");
    const n = null as string | null;
    const u = undefined as string | undefined;
    expect(sanitizeRichText(n)).toBe("");
    expect(sanitizeRichText(u)).toBe("");
  });

  it("plain text passes through unchanged", () => {
    expect(sanitizeRichText("Handcrafted in Aalborg")).toBe("Handcrafted in Aalborg");
  });
});

describe("safeJsonLd", () => {
  it("escapes < so a payload cannot break out of the ld+json script tag", () => {
    const payload = { title: 'Evil</script><script>alert(1)</script><script>', price: 1299 };
    const json = safeJsonLd(payload);
    expect(json).not.toContain("</script>");
    // Round-trips to the same data (the escape is JSON-legal).
    expect(JSON.parse(json)).toEqual(payload);
  });

  it("escapes newline characters that would be invalid inside a script element", () => {
    const json = safeJsonLd({ title: "line1\nline2\u2028line3" });
    expect(JSON.parse(json)).toEqual({ title: "line1\nline2\u2028line3" });
    expect(json).not.toContain("\n");
    expect(json).not.toContain("\u2028");
  });
});
