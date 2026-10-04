# Validation Report: Tailwind CSS v3 vs v4 Configuration Claims

## Executive Summary

The provided text is **substantially accurate** when measured against official Tailwind CSS documentation, the v4.0 announcement, and the upgrade guide. Tailwind CSS v4.0, released January 22, 2025, eliminates the requirement for `tailwind.config.js` or `tailwind.config.ts` in new projects and replaces it with a CSS-first model centered on `@theme`, `@plugin`, `@utility`, and automatic content detection. The framework was rebuilt around a new high-performance engine previewed as **Oxide**, integrating Rust-based processing and Lightning CSS. Backward compatibility is maintained via the `@config` directive, but with explicit unsupported options.

## 1. Legacy Status of tailwind.config.ts / .js

**Claim:** The file is officially considered a legacy approach from v3 and is no longer required by default in v4.

**Validation: CONFIRMED.**

Official documentation and migration references consistently state that configuration now lives in CSS, not JavaScript:

> One of the biggest changes in Tailwind CSS v4.0 is the shift from configuring your project in JavaScript to configuring it in CSS. Instead of a `tailwind.config.js` file, you can configure all of your customizations directly in the CSS file where you import Tailwind [[1]](http://tailwindcss.com/blog/tailwindcss-v4)

> With the improvements we've made to this process for v4.0, Tailwind feels more light-weight than ever: ... Zero configuration — you can start using the framework without configuring anything, not even the paths to your template files. [[1]](http://tailwindcss.com/blog/tailwindcss-v4)

> In Tailwind v4, CSS-first configuration using the `@theme` directive is ... recommended. A legacy `tailwind.config.js` file remains supported via the `@config` directive for backward compatibility [[2]](https://github.com/chachajona/osticket2.0/blob/HEAD/.agents/skills/tailwindcss-development/SKILL.md)

Secondary summaries reflect the same: "No more `tailwind.config.js` required. Configuration lives in CSS" and "The `tailwind.config.js` file is gone" [[3]](https://fireup.pro/news/tailwind-css-v4-0-released-lightning-fast-builds-advanced-features-and-simplified-setup). Installation guides note "No `tailwind.config.js`, no PostCSS configuration file, and no `content` array setup required" [[4]](https://github.com/capitaltg/vero/blob/HEAD/docs/tailwind-v4-migration.md).

The claim that the file is "entirely missing by default in new installations" is accurate for the standard v4 initializer, which only creates a CSS entry with `@import "tailwindcss"`.

## 2. CSS-First Paradigm and Oxide Rust Engine

**Claims:** 
- v4 introduces a radical CSS-first configuration paradigm
- Completely rebuilt with new Rust-based engine (Oxide) shifting configuration into native CSS directives

**Validation: CONFIRMED, with nuance on Rust.**

**CSS-first:**

The v4.0 blog lists as headline features:

> CSS-first configuration — a reimagined developer experience where you customize and extend the framework directly in CSS instead of a JavaScript configuration file. [[1]](http://tailwindcss.com/blog/tailwindcss-v4)

> Tailwind CSS v4 represents a paradigm shift in how we configure and use the framework. Gone are the JavaScript config files — everything is now CSS-first. [[5]](https://github.com/wabtechs/wabtechs-platform/blob/HEAD/src/content/blog/tailwind-css-v4-migration.mdx)

> CSS-First Configuration: No more `tailwind.config.js`. All configuration is now done directly in your CSS file using the new `@theme` directive. [[6]](https://github.com/ecorkran/ai-project-guide/blob/HEAD/tool-guides/tailwindcss/guide.tailwindcss.v4.md)

**Oxide / Rust:**

Multiple authoritative sources confirm the engine rewrite:

> v4 ships a ground-up rewrite of the framework. The new engine — previewed under the name **Oxide** at Tailwind Connect — moves the expensive, parallelizable work into Rust while keeping the core in TypeScript so plugins still work. Its only dependency is Lightning CSS. [[7]](https://github.com/zhenxiao-yu/m4rkyu.com/blob/HEAD/drafts/dev-to/tailwind-css-v4-the-changes-that-actually-matter.md)

> Tailwind CSS v4.0 [shipped on January 22, 2025] and underwent a foundational rewrite: **Oxide engine.** The core was rewritten from JavaScript to Rust, integrating Lightning CSS for vendor prefixing and syntax transforms. [[8]](https://github.com/sujeet-pro/sujeet.pro/blob/HEAD/content/articles/css-architecture-strategies/README.md)

> The new high-performance engine — where full builds are up to 5x faster, and incremental builds are over 100x faster — and measured in microseconds. [[1]](http://tailwindcss.com/blog/tailwindcss-v4)

Official benchmarks cited: Full build 378ms → 100ms (3.78x), incremental rebuild with no new CSS 35ms → 192µs (182x) [[1]](http://tailwindcss.com/blog/tailwindcss-v4) [[9]](https://github.com/impertio-studio/tailwindcss-claude-skill-package/blob/HEAD/skills/source/tailwind-core/tailwind-core-v3-vs-v4/SKILL.md)

The original text correctly captures that configuration shifts into native CSS directives, enabled by the new engine.

## 3. The Shift: v3 vs v4 Mapping

The table provided in the source text accurately maps legacy locations to modern directives. Each row validates independently.

### 3.1 Theme Customization

**v3:** Nested JavaScript `theme` object in `tailwind.config.ts`
**v4:** Native `@theme` directive using CSS variables

Validation: Theme variables are defined via `@theme` directive [[10]](https://tailwindcss.com/docs/theme). Official example:

```css
@import "tailwindcss";
@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 120rem;
  --color-avocado-500: oklch(0.84 0.18 117.33);
}
``` [[11]](https://tailwindcss.com/docs/functions-and-directives)

Docs state: "Theme variables are special CSS variables defined using the `@theme` directive that influence which utility classes exist in your project." [[10]](https://tailwindcss.com/docs/theme)

### 3.2 Content Scanning

**v3:** Manually configured via `content: [...]`
**v4:** Completely automated

Validation: 

> Automatic content detection — all of your template files are discovered automatically, with no configuration required. [[1]](http://tailwindcss.com/blog/tailwindcss-v4)

> Tailwind will scan every file in your project for class names, except in the following cases: Files that are in your `.gitignore` file, Files in the `node_modules` directory, Binary files... [[12]](https://tailwindcss.com/docs/detecting-classes-in-source-files)

> The `content` array is gone. Tailwind v4 uses your Vite (or PostCSS) config to detect which files to scan. [[13]](https://github.com/caazurita/portfolio-project/blob/HEAD/content/blog/tailwind-css-v4-guide.md)

> Automatic Content Detection ... Remember spending time configuring the `content` array in your config? That's gone. [[14]](https://github.com/levananhduc/web-app-match-cv/blob/HEAD/client/.claude/skills/standard-tailwind/SKILL.md)

### 3.3 Plugins

**v3:** `plugins: [...]` array via `require()`
**v4:** `@plugin` directive

Validation:

> Use the `@plugin` directive to load a legacy JavaScript-based plugin: `@plugin "@tailwindcss/typography";` [[11]](https://tailwindcss.com/docs/functions-and-directives)

> Tailwind v4 supports official plugins using the `@plugin` directive in CSS. Quick Example: `@import 'tailwindcss'; @plugin '@tailwindcss/typography'; @plugin '@tailwindcss/forms';` [[15]](https://github.com/sjmontano/operaprima/blob/HEAD/.agents/skills/tailwind-v4-shadcn/SKILL.md)

Migration table: `require("@tailwindcss/typography")` → `@plugin "@tailwindcss/typography";` [[16]](https://github.com/impertio-studio/tailwindcss-claude-skill-package/blob/HEAD/skills/source/tailwind-impl/tailwind-impl-plugins-official/SKILL.md)

### 3.4 Custom Core Utilities

**v3:** JavaScript plugin APIs or manual `@layer` rules
**v4:** Native `@utility` directive

Validation:

> Use the `@utility` directive to add custom utilities to your project that work with variants like `hover`, `focus` and `lg`: `@utility tab-4 { tab-size: 4; }` [[11]](https://tailwindcss.com/docs/functions-and-directives)

This is confirmed across multiple guides as the v4 replacement for custom plugin APIs [[11]](https://tailwindcss.com/docs/functions-and-directives).

## 4. Example Configuration Syntax

The example provided in the source text:

```css
@import "tailwindcss";
@theme {
  --color-brand-primary: #4f46e5;
  --font-display: "Inter", sans-serif;
  --breakpoint-3xl: 1920px;
}
@plugin "@tailwindcss/typography";
@utility flex-center { display: flex; align-items: center; justify-content: center; }
```

Is syntactically valid per official docs. The directives match documented usage for `@theme` [[10]](https://tailwindcss.com/docs/theme), `@plugin` [[11]](https://tailwindcss.com/docs/functions-and-directives), and `@utility` [[11]](https://tailwindcss.com/docs/functions-and-directives). Color naming `--color-brand-primary` follows the `--color-*` namespace convention that generates `bg-brand-primary`, etc. Breakpoint naming follows `--breakpoint-*`.

## 5. Backward Compatibility via @config and Unsupported Options

**Claims:**
- Not 100% deprecated, can link old config via `@config`
- Example: `@config "../tailwind.config.ts"`
- Several legacy options like `corePlugins`, `safelist`, `separator` are outright unsupported

**Validation: CONFIRMED.**

Official compatibility section:

> Use the `@config` directive to load a legacy JavaScript-based configuration file: `@config "../../tailwind.config.js";` [[11]](https://tailwindcss.com/docs/functions-and-directives)

> The `corePlugins`, `safelist`, and `separator` options from the JavaScript-based config are not supported in v4.0. To safelist utilities in v4 use `@source inline()`. [[11]](https://tailwindcss.com/docs/functions-and-directives)

> JavaScript config files are still supported for backward compatibility, but they are no longer detected automatically in v4. If you still need to use a JavaScript config file, you can load it explicitly using the `@config` directive [[17]](https://github.com/upamune/radicaster/blob/HEAD/.claude/skills/tailwind/docs/tailwindcss.com/docs/upgrade-guide.md)

Community discussion with Tailwind collaborators confirms:

> If your project still needs a traditional config file, don't worry. Tailwind hasn't removed support for it entirely. You can manually create tailwind.config.js and link it in your CSS file like this: `@config "./tailwind.config.js";` The corePlugins, safelist, and separator options from the JavaScript-based config are not supported in v4.0. [[18]](https://github.com/tailwindlabs/tailwindcss/discussions/17168)

Additional corroboration: "Avoid `corePlugins`, `safelist`, and `separator` - these JS config options aren't supported in v4." [[19]](https://github.com/majiayu000/claude-skill-registry/blob/HEAD/skills/other/other/angular-tailwind-setup/SKILL.md)

For TypeScript configs, the same path works: `@config "../../tailwind.config.ts";` is documented as supported [[20]](https://github.com/borderlesscodinghub/career-forge-v2/blob/HEAD/docs/wayfinder/tailwind-4-next-14.md).

## 6. Assessment of Source Quality in Original Text

The original text cited YouTube, StackOverflow, LinkedIn posts, and Medium articles. While directionally correct, those are low-authority secondary sources. This validation prioritizes:

- Official Tailwind CSS blog v4.0 announcement
- Official docs: `functions-and-directives`, `detecting-classes-in-source-files`, `theme`, `upgrade-guide`
- GitHub discussion from Tailwind Labs collaborators

These provide primary evidence for every row in the comparison table.

## Conclusion

The core assertions hold:

1. `tailwind.config.js/ts` is legacy and not required by default in v4 [[1]](http://tailwindcss.com/blog/tailwindcss-v4) [[3]](https://fireup.pro/news/tailwind-css-v4-0-released-lightning-fast-builds-advanced-features-and-simplified-setup)
2. v4 is CSS-first with a new Oxide engine built on Rust and Lightning CSS [[7]](https://github.com/zhenxiao-yu/m4rkyu.com/blob/HEAD/drafts/dev-to/tailwind-css-v4-the-changes-that-actually-matter.md) [[8]](https://github.com/sujeet-pro/sujeet.pro/blob/HEAD/content/articles/css-architecture-strategies/README.md) [[1]](http://tailwindcss.com/blog/tailwindcss-v4)
3. Theme → `@theme` [[10]](https://tailwindcss.com/docs/theme), content scanning → automatic [[12]](https://tailwindcss.com/docs/detecting-classes-in-source-files), plugins → `@plugin` [[11]](https://tailwindcss.com/docs/functions-and-directives), utilities → `@utility` [[11]](https://tailwindcss.com/docs/functions-and-directives)
4. Backward compatibility via `@config` exists but drops `corePlugins`, `safelist`, `separator` [[11]](https://tailwindcss.com/docs/functions-and-directives) [[18]](https://github.com/tailwindlabs/tailwindcss/discussions/17168)

Minor nuance: The engine is described as Rust-based Oxide integrating Lightning CSS; it is not exclusively Rust but a hybrid Rust/TypeScript architecture, with Lightning CSS as its only dependency. The CSS-first paradigm does not mean JS config is forbidden, only opt-in.

## Sources
[1] Tailwind CSS — [Tailwind CSS v4.0](http://tailwindcss.com/blog/tailwindcss-v4)
[2] GitHub — [tailwindcss-development SKILL.md](https://github.com/chachajona/osticket2.0/blob/HEAD/.agents/skills/tailwindcss-development/SKILL.md)
[3] FireUp — [Tailwind CSS v4.0 - what's new and how to upgrade](https://fireup.pro/news/tailwind-css-v4-0-released-lightning-fast-builds-advanced-features-and-simplified-setup)
[4] GitHub — [tailwind-v4-migration.md](https://github.com/capitaltg/vero/blob/HEAD/docs/tailwind-v4-migration.md)
[5] GitHub — [tailwind-css-v4-migration.mdx](https://github.com/wabtechs/wabtechs-platform/blob/HEAD/src/content/blog/tailwind-css-v4-migration.mdx)
[6] GitHub — [guide.tailwindcss.v4.md](https://github.com/ecorkran/ai-project-guide/blob/HEAD/tool-guides/tailwindcss/guide.tailwindcss.v4.md)
[7] GitHub — [tailwind-css-v4-the-changes-that-actually-matter.md](https://github.com/zhenxiao-yu/m4rkyu.com/blob/HEAD/drafts/dev-to/tailwind-css-v4-the-changes-that-actually-matter.md)
[8] GitHub — [css-architecture-strategies README](https://github.com/sujeet-pro/sujeet.pro/blob/HEAD/content/articles/css-architecture-strategies/README.md)
[9] GitHub — [tailwind-core-v3-vs-v4 SKILL.md](https://github.com/impertio-studio/tailwindcss-claude-skill-package/blob/HEAD/skills/source/tailwind-core/tailwind-core-v3-vs-v4/SKILL.md)
[10] Tailwind CSS — [Theme variables](https://tailwindcss.com/docs/theme)
[11] Tailwind CSS — [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
[12] Tailwind CSS — [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
[13] GitHub — [tailwind-css-v4-guide.md](https://github.com/caazurita/portfolio-project/blob/HEAD/content/blog/tailwind-css-v4-guide.md)
[14] GitHub — [standard-tailwind SKILL.md](https://github.com/levananhduc/web-app-match-cv/blob/HEAD/client/.claude/skills/standard-tailwind/SKILL.md)
[15] GitHub — [tailwind-v4-shadcn SKILL.md](https://github.com/sjmontano/operaprima/blob/HEAD/.agents/skills/tailwind-v4-shadcn/SKILL.md)
[16] GitHub — [tailwind-impl-plugins-official SKILL.md](https://github.com/impertio-studio/tailwindcss-claude-skill-package/blob/HEAD/skills/source/tailwind-impl/tailwind-impl-plugins-official/SKILL.md)
[17] GitHub — [upgrade-guide.md mirror](https://github.com/upamune/radicaster/blob/HEAD/.claude/skills/tailwind/docs/tailwindcss.com/docs/upgrade-guide.md)
[18] GitHub — [Discussion #17168 - tailwind config file has been removed in v4](https://github.com/tailwindlabs/tailwindcss/discussions/17168)
[19] GitHub — [angular-tailwind-setup SKILL.md](https://github.com/majiayu000/claude-skill-registry/blob/HEAD/skills/other/other/angular-tailwind-setup/SKILL.md)
[20] GitHub — [tailwind-4-next-14.md](https://github.com/borderlesscodinghub/career-forge-v2/blob/HEAD/docs/wayfinder/tailwind-4-next-14.md)

---

The provided text provides a highly accurate and comprehensive overview of the architectural changes introduced in Tailwind CSS v4. Every core claim regarding the new "CSS-first" paradigm, the Oxide engine, and the new directives has been successfully validated against official documentation and community resources.

#### 1. Removal of `tailwind.config.ts` and the "CSS-First" Paradigm
The claim that `tailwind.config.ts` (and `.js`) is a legacy approach no longer required by default in Tailwind CSS v4 is entirely correct. Tailwind v4 explicitly favors a CSS-first approach, meaning the framework no longer auto-generates a JavaScript configuration file [[50]]. Instead, the framework introduces a reimagined developer experience where you customize and extend the framework directly in CSS [[8]]. This radical shift is powered by Oxide, which is a new high-performance engine built in Rust [[11]].

#### 2. The Shift: Tailwind v3 vs. Tailwind v4
The comparison table provided in your text accurately maps legacy v3 features to their modern v4 counterparts. Instead of a nested JavaScript theme object, v4 utilizes special CSS variables defined using the new `@theme` directive [[13]]. You can now customize your color palette, typography, and breakpoints directly in your CSS [[18]]. The manual content array from v3 has been replaced by automatic content detection in v4 [[77]]. This means all of your standard template files are automatically scanned without requiring manual path mapping [[57]]. For edge cases where files aren't picked up automatically, developers can use the `@source` directive to explicitly specify source files [[69]]. Official and third-party plugins are no longer passed into a JavaScript array. Instead, they are loaded inline using the dedicated `@plugin` directive [[25]]. Manual JavaScript plugin APIs have been superseded by the native `@utility` directive [[26]]. This directive allows you to add custom utilities to your project that work seamlessly with variants like hover and focus [[31]].

#### 3. Modern Configuration via Global CSS
The example provided in the text accurately reflects the modern Tailwind v4 setup. Developers now import the framework and define their entire design system elegantly within a global CSS file [[16]]. By chaining these new CSS blocks, the stylesheet becomes the single source of truth for the design system [[14]].

#### 4. Backward Compatibility and the `@config` Directive
The assertion that legacy configuration files are not entirely deprecated is also verified. If you are migrating a massive project and still need to use a JavaScript config file, you can explicitly load it using the `@config` directive [[37]]. This allows teams to incrementally move over their themes and custom configurations without completely rewriting complex code immediately [[32]].

#### 5. Unsupported Legacy Options
Your text correctly warns that certain legacy config options are outright unsupported in v4 when using the `@config` bridge. Specifically, the `corePlugins`, `safelist`, and `separator` options from the JavaScript-based config are strictly not supported in v4.0 [[42]]. For example, the old safelist feature has been replaced, and you must now use `@source inline()` to safelist utilities in v4 [[70]].

#### Conclusion
The text you provided is a meticulously researched and factually sound summary of Tailwind CSS v4's migration path. The quotes and links provided align perfectly with the official documentation and verified community discussions.

---

## Appendix — Project Trap Log (bugs found in THIS codebase)

Three engine-level v3→v4 differences were found and fixed during the build (see
`AGENTS.md` gotchas + `Project_Architecture_Document.md` ADR-004/005 and §4.4):

1. **Bare-HSL transparent theme** — under `@theme inline`, `--background: 0 0% 100%`
   (a bare triplet) silently resolves to *transparent*; theme vars must be full
   `hsl(…)` color values.
2. **oklch palette drift** — v4's default palette drifts 1–3 sRGB units per channel
   from the v3 hexes; the v3-era palette is pinned in `@theme` for byte-identical
   computed colors.
3. **in-oklab gradient interpolation** — v4 interpolates `bg-gradient-to-*` in oklab;
   the hero gradient ships the sRGB-equivalent arbitrary `bg-[linear-gradient(…)]`
   form to keep the computed gradient identical.

**4. The space-y/space-x selector rewrite (session 9)** — the newest find, and the
first one that changes *layout* rather than color:

- **v3 (the reference app's compiled CSS):**
  `.space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: calc(.25rem * …) }`
  — the margin lands on subsequent siblings and the selector's specificity (0,2,0)
  **overrides a child's own `.mt-3`** (0,1,0).
- **v4 (this codebase):**
  `:where(.space-y-1 > :not(:last-child)) { margin-block-end: calc(var(--spacing) * …) }`
  — the margin moves to margin-bottom-of-all-but-last-children and the `:where()`
  wrapper contributes **zero specificity**, so a child's `.mt-3` **wins**.

Consequences for a v3→v4 port with byte-identical class attributes: (a) the
margin-side swap is visually equivalent *when no child carries explicit margin
utilities* (a computed-margin walk of every `space-*` container on every route
confirmed this app has exactly one violation), but (b) any `space-y-*` container
with an explicit `mt-*`/`mb-*` child renders **different gaps and a different total
height**. The one case: the mobile nav panel's Dashboard CTA (`block mt-3`) — the
reference's v3 engine overrides the `mt-3` to a 4px space-y gap (405px panel),
while v4's engine resurrects it into a 12px gap (413px panel). Fix: ship the CTA
without the `mt-3` (an engine-variance class-form fix, the same precedent as trap 3),
pinned by the session-9 e2e specs (`tests/e2e/mobile-navigation.spec.ts`).

---

## Appendix: Project Trap Log — Trap 5: The Shadow-Scale Shift (session 12)

**Found by**: the session-12 computed box-shadow + border-radius sweep (walk every
visible element per route, bucket the computed `boxShadow`/`borderRadius`, diff live
vs clone). Class-set diffs are structurally blind to this trap — the class strings
are byte-identical; only the token VALUE changed between engines.

- **v3 (the reference app's compiled CSS):**
  `.shadow-sm { --tw-shadow: 0 1px 2px 0 #0000000d; … }`
- **v4 (this codebase, pre-fix):**
  `.shadow-xs { --tw-shadow: 0 1px 2px 0 var(--tw-shadow-color, #0000000d); … }`
  `.shadow-sm { --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a); … }`

v4 inserted `shadow-xs` at v3's `shadow-sm` position and moved `shadow-sm` up to
v3's bare-`shadow` geometry — so every byte-identical `shadow-sm` class renders ONE
NOTCH heavier on v4. Measured live vs clone: the white navbar rendered
`rgba(0,0,0,0.05) 0px 1px 2px 0px` on the live vs
`rgba(0,0,0,0.1) 0px 1px 3px 0px, rgba(0,0,0,0.1) 0px 1px 2px -1px` on the clone —
a visibly heavier drop shadow under the fixed navbar on EVERY white-nav route. The
same shift hit 21 `shadow-sm` usages (Navbar, LoginForm, the hero secondary CTA,
ContactForm, NewsletterForm, AIAssistantChat, CourseCatalog, MyCourses, ui/card,
ui/select, ui/input, ui/button variants) plus every `hover:shadow-sm` (the
380-per-course lesson rows, the Google button hover). The bare `shadow` and
md/lg/xl/2xl levels are UNCHANGED in v4 (verified computed-identical).

Fix: the token pin in `src/app/globals.css` `@theme inline` (the ADR-005
palette-pin precedent — pin the token, keep every class byte-identical; one line
fixes all usages):

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
```

Pinned by the session-12 e2e specs (computed box-shadow assertions on the white
navbar, the login Sign in button, the hero secondary CTA and the lesson-row hover —
v4's empty `rgba(0, 0, 0, 0) 0px 0px 0px 0px` composition slots stripped — plus
GUARD specs proving shadow-lg/2xl were never shifted).

**Related session-12 methodology findings** (documented in AGENTS.md gotchas 31–32):
(a) v4 wraps every `hover:` variant in `@media (hover: hover)` — touch-emulating
headless browsers (the agent-browser daemon) produce FALSE hover-parity failures;
probe hovers in Playwright. (b) v4 renders `translate-y-*`/`scale-*`/`rotate-*`
through the standalone CSS properties, not `transform: matrix(...)` — computed-style
assertions must read the right property per stack. (c) Next 16's dev-origin
protection silently blocks dev chunks for the `127.0.0.1` origin (unhydrated page,
native form GET fallbacks) — `allowedDevOrigins: ["127.0.0.1"]` in next.config.ts
restores both origins.

---

## Appendix: Project Trap Log — Trap 6: The Radius-Scale Shift (session 7)

**Found by**: the session-7 computed-radius map (scan every element per route,
bucket `class → computed borderRadius`, diff live vs clone). Same blindness class
as trap 5 — the class strings are byte-identical (`rounded-xl`, `rounded-lg`), only
the token VALUE differs between engines.

- **The live reference (v3 + base44's custom config):** `rounded-lg` AND
  `rounded-xl` BOTH compute **12px** (measured on the streak day cells, the mobile
  menu items, the Course-Lessons rows, the p_ panel's icon tiles, the login inputs
  — 17 DOM instances across /demo, /courses, /login, the mobile menu).
- **v4 (this codebase, pre-fix):** `rounded-xl` = `0.875rem` = **14px** (the engine
  default), `rounded-lg` = `0.5rem` = **8px**. The codebase had even PINNED the
  wrong value (`--radius-xl: 0.875rem /* 12px/14px form controls */`) — the "14px"
  half of that comment was a misdiagnosis: the reference's 14px surfaces (the quiz
  option grid, the Next-Question button) are `rounded-[14px]` ARBITRARY classes on
  BOTH sides, never `rounded-xl`.

Consequences: 41 usages rendered +2px (xl) or −4px (lg) off the reference — the
mobile menu items, the p_ tiles, the streak cells, the lesson rows, the login
form controls, the Nori send button. Visually subtle (a 2px radius delta), which
is exactly why six sessions of class-string parity never caught it: **computed
styles are the ground truth, class strings are the approximation.**

Fix: pin BOTH tokens in `globals.css` `@theme` (the ADR-005 token-pin precedent):

```css
--radius-lg: 0.75rem; /* 12px — p_ icon tiles, hub menu tiles, chat send */
--radius-xl: 0.75rem; /* 12px — menu items, streak cells, lesson rows, form controls */
```

Pinned by the session-7 e2e specs (computed border-radius assertions on the
Course-Lessons rows, the p_ All-Courses tile, and the mobile menu items —
`tests/e2e/session7-parity.spec.ts` + `mobile-navigation.spec.ts`).

---

## Appendix: Project Trap Log — Trap 7: The Blur-Scale Shift (session 7)

**Found by**: the same computed-style sweep, on `backdrop-filter`. The
shadow-scale shift (trap 5) has a sibling: v4 renamed `blur` → `blur-sm` and
`blur-sm` → `blur-xs`, moving every named blur level up one notch.

- **The live reference (v3):** the login card's `backdrop-blur-sm` computes
  **blur(4px)**.
- **v4 (this codebase, pre-fix):** `backdrop-blur-sm` computes **blur(8px)** —
  2× the reference, softening the card's frosted-glass edge over the gradient.

Fix: pin the token (the `--shadow-sm` precedent, one line):

```css
--blur-sm: 4px;
```

Pinned by the session-7 e2e spec (`auth.spec.ts`: the login card must compute
`backdrop-filter: blur(4px)` + `border-radius: 16px`). No other blur consumer
exists in the codebase, so the pin is collision-free.

**Session-7 methodology corollary (recorded for future audits):** the app-wide
base `font-weight` is ALSO a computed-style-only signal — the live's `body`
computes **300** (font-light is the app default, inherited by every weight-less
text node: mode-card descriptions, category tags, "N/6 lessons completed"),
while the clone shipped `body { font-weight: 400 }`. A leaf-text font-weight
HISTOGRAM per route (bucket every visible text node by computed weight, diff the
distributions) is the cheapest audit that surfaces this class of drift; it also
surfaced the Course-Lessons icon-column drift (six 600-weight "✓" text nodes on
the clone that have no counterpart on the live).

---

## Appendix: Project Trap Log — Trap 8: The Alpha-Color Serialization Shift (session 8)

**Found by**: the computed-style color histogram (the session-7 doctrine,
extended to text/overlay colors). Tailwind v4 generates alpha-modified
colors via `color-mix(in oklab, …)`; v3 emitted plain `rgba()` — the
COMPUTED serialization differs even when the rendered color is identical.

- **The live reference (v3):** `text-black/40` computes
  `rgba(0, 0, 0, 0.4)`; the challenge modal's overlay computes
  `rgba(0, 0, 0, 0.5)`.
- **v4 (this codebase, pre-fix):** the SAME class strings compute
  `oklab(0 0 0 / 0.4)` and `oklab(0 0 0 / 0.5)` — invisible on screen for
  achromatic alpha, but a computed-value mismatch the histogram doctrine
  flags (and the e2e `toHaveCSS` pins catch immediately).

**Scope**: achromatic alpha (black/white + opacity) renders identically in
both engines — this app uses ZERO chromatic alpha classes (audited), so the
drift is serialization-only. The risk family: a CHROMATIC alpha
(`bg-purple/50`) WOULD mix in oklab (perceptual) on v4 vs sRGB (linear) on
v3 — a real visual difference. Audit for chromatic alpha before porting.

Fix: pinned surfaces normalize via inline `rgba()` (the session-7
later-lesson-icon precedent):

```tsx
style={{ color: "rgba(0, 0, 0, 0.4)" }}        // streak weekday letters
style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }} // challenge modal overlay
```

Pinned by `tests/e2e/session8-parity.spec.ts` (the letters compute
`rgba(0, 0, 0, 0.4)`; the overlay computes `rgba(0, 0, 0, 0.5)` with
`backdrop-filter: none`). Unpinned surfaces may keep the utility classes —
the rendering is identical.
