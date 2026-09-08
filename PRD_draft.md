Below is a complete, self-contained HTML capture of the Scandi Haven landing page (recreated from the live site's structure, visual language, and interactions), followed by a meticulous Production-Ready PRD you can hand to an engineering team.

---

## 1. Captured Landing Page (single-file HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Scandi Haven — Slow Living, Beautifully Made</title>
<meta name="description" content="Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#FAF7F2; --bg-2:#F0EAE0; --bg-3:#E8E0D2;
    --ink:#1F1B17; --ink-2:#4A433B; --muted:#8A8178;
    --line:#E5DDD1; --accent:#C97B5E; --accent-2:#B06548;
    --sage:#8B9A82; --wood:#C9A876;
    --shadow-md:0 8px 24px rgba(31,27,23,.06);
    --shadow-lg:0 24px 60px rgba(31,27,23,.10);
    --container:1280px; --gutter:clamp(20px,5vw,64px);
    --ease:cubic-bezier(.22,1,.36,1);
  }
  *,*::before,*::after{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E")}
  img{max-width:100%;display:block}
  a{color:inherit}
  .display{font-family:'Fraunces',Georgia,serif;font-weight:400;letter-spacing:-.01em;line-height:1.05}
  .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:500;color:var(--muted)}
  .container{max-width:var(--container);margin:0 auto;padding:0 var(--gutter)}
  .section{padding:clamp(64px,10vw,140px) 0}

  /* Announce */
  .announce{background:var(--ink);color:var(--bg);text-align:center;font-size:13px;letter-spacing:.05em;padding:10px 16px}
  .announce a{color:inherit;text-decoration:underline;text-underline-offset:3px}

  /* Nav */
  .nav{position:sticky;top:0;background:rgba(250,247,242,.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line);z-index:100}
  .nav-inner{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:72px;gap:24px}
  .nav-links{display:flex;gap:28px;align-items:center}
  .nav-links a{text-decoration:none;font-size:14px;font-weight:400;position:relative;padding:4px 0;transition:color .3s var(--ease)}
  .nav-links a::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--ink);transform:scaleX(0);transform-origin:left;transition:transform .4s var(--ease)}
  .nav-links a:hover::after{transform:scaleX(1)}
  .logo{font-family:'Fraunces',serif;font-size:22px;font-weight:500;letter-spacing:-.02em;text-decoration:none;color:var(--ink);text-align:center}
  .logo em{font-style:italic;color:var(--accent);font-weight:400}
  .nav-actions{display:flex;justify-content:flex-end;gap:18px;align-items:center}
  .icon-btn{background:none;border:none;cursor:pointer;color:var(--ink);padding:6px;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-family:inherit}
  .cart-count{background:var(--accent);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:500}
  .menu-toggle{display:none;background:none;border:none;cursor:pointer;color:var(--ink);padding:6px}

  /* Hero */
  .hero{padding:clamp(40px,6vw,80px) 0 clamp(80px,10vw,120px)}
  .hero-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center}
  .hero-text{max-width:560px}
  .hero h1{font-family:'Fraunces',serif;font-size:clamp(48px,7vw,96px);margin:24px 0 28px;font-weight:300;line-height:1.02}
  .hero h1 em{font-style:italic;color:var(--accent);font-weight:400}
  .hero .lede{font-size:18px;color:var(--ink-2);max-width:440px;margin:0 0 40px}
  .btn-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;font-size:14px;font-weight:500;font-family:inherit;text-decoration:none;border-radius:999px;transition:all .3s var(--ease);cursor:pointer;border:1px solid transparent}
  .btn-primary{background:var(--ink);color:var(--bg)}
  .btn-primary:hover{background:var(--accent);transform:translateY(-2px)}
  .btn-ghost{background:transparent;color:var(--ink);border-color:var(--ink)}
  .btn-ghost:hover{background:var(--ink);color:var(--bg)}
  .hero-visual{position:relative;aspect-ratio:4/5;border-radius:2px;overflow:hidden}
  .hero-visual img{width:100%;height:100%;object-fit:cover}
  .hero-tag{position:absolute;bottom:24px;left:24px;background:rgba(250,247,242,.92);backdrop-filter:blur(8px);padding:14px 20px;border-radius:2px;max-width:240px}
  .hero-tag .eyebrow{font-size:10px}
  .hero-tag h4{font-family:'Fraunces',serif;font-size:18px;margin:4px 0 0;font-weight:500}
  .hero-tag .price{font-size:13px;color:var(--ink-2);margin-top:4px}

  /* Marquee */
  .marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0;overflow:hidden;background:var(--bg-2)}
  .marquee-track{display:flex;gap:60px;white-space:nowrap;animation:scroll 32s linear infinite}
  .marquee-track span{font-family:'Fraunces',serif;font-size:18px;font-style:italic;color:var(--ink-2);display:inline-flex;align-items:center;gap:60px}
  .marquee-track span::after{content:'✦';color:var(--accent);font-style:normal}
  @keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

  /* Section head */
  .section-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:56px;gap:32px}
  .section-head h2{font-family:'Fraunces',serif;font-size:clamp(32px,4vw,52px);font-weight:400;margin:12px 0 0;line-height:1.1;max-width:600px}
  .section-head h2 em{font-style:italic;color:var(--accent)}
  .section-head .link{text-decoration:none;font-size:14px;border-bottom:1px solid var(--ink);padding-bottom:2px;white-space:nowrap}

  /* Categories */
  .categories{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .category{position:relative;aspect-ratio:3/4;overflow:hidden;border-radius:2px;text-decoration:none;color:inherit;display:block}
  .category img{width:100%;height:100%;object-fit:cover;transition:transform .8s var(--ease)}
  .category:hover img{transform:scale(1.05)}
  .category::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(31,27,23,.5) 0%,transparent 55%)}
  .category-label{position:absolute;bottom:20px;left:20px;right:20px;color:#fff;z-index:2}
  .category-label h3{font-family:'Fraunces',serif;font-size:22px;font-weight:400;margin:0 0 4px}
  .category-label span{font-size:12px;opacity:.85}

  /* Products */
  .products{display:grid;grid-template-columns:repeat(4,1fr);gap:32px 24px}
  .product{text-decoration:none;color:inherit;display:block}
  .product-image{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--bg-2);border-radius:2px;margin-bottom:16px}
  .product-image img{width:100%;height:100%;object-fit:cover;transition:opacity .4s var(--ease),transform .8s var(--ease)}
  .product-image img.alt{position:absolute;inset:0;opacity:0}
  .product:hover .product-image img.main{opacity:0}
  .product:hover .product-image img.alt{opacity:1;transform:scale(1.04)}
  .product-badge{position:absolute;top:12px;left:12px;background:var(--bg);color:var(--ink);font-size:11px;letter-spacing:.05em;padding:4px 10px;border-radius:999px;text-transform:uppercase;font-weight:500}
  .product-badge.sale{background:var(--accent);color:#fff}
  .quick-add{position:absolute;bottom:12px;left:12px;right:12px;background:var(--ink);color:var(--bg);border:none;padding:12px;font-size:13px;font-family:inherit;border-radius:999px;cursor:pointer;transform:translateY(120%);transition:transform .4s var(--ease)}
  .product:hover .quick-add{transform:translateY(0)}
  .quick-add:hover{background:var(--accent)}
  .product-info{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .product-info h3{font-family:'Fraunces',serif;font-size:18px;font-weight:400;margin:0 0 4px;line-height:1.3}
  .product-info .meta{font-size:13px;color:var(--muted)}
  .product-info .price{font-size:15px;font-weight:500}
  .product-info .price .old{text-decoration:line-through;color:var(--muted);margin-right:6px;font-weight:400}

  /* Story */
  .story{background:var(--bg-2);overflow:hidden}
  .story-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:clamp(40px,6vw,96px);align-items:center}
  .story-visual{position:relative;aspect-ratio:5/6}
  .story-visual img{width:100%;height:100%;object-fit:cover;border-radius:2px}
  .story-visual .small-img{position:absolute;bottom:-40px;right:-40px;width:45%;aspect-ratio:1;border:8px solid var(--bg-2);border-radius:2px}
  .story-text h2{font-family:'Fraunces',serif;font-size:clamp(36px,4.5vw,60px);font-weight:300;margin:16px 0 24px;line-height:1.05}
  .story-text h2 em{font-style:italic;color:var(--accent)}
  .story-text p{color:var(--ink-2);font-size:16px;margin:0 0 20px;max-width:480px}
  .story-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:40px 0;padding:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .story-stat .num{font-family:'Fraunces',serif;font-size:36px;font-weight:400;color:var(--ink);display:block;line-height:1}
  .story-stat .lbl{font-size:12px;color:var(--muted);margin-top:6px;letter-spacing:.05em;text-transform:uppercase}

  /* Materials */
  .materials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px}
  .material{padding:32px;background:var(--bg-2);border-radius:2px;transition:transform .4s var(--ease)}
  .material:hover{transform:translateY(-4px)}
  .material .icon{width:48px;height:48px;border-radius:50%;background:var(--bg-3);display:flex;align-items:center;justify-content:center;margin-bottom:20px;color:var(--accent)}
  .material h3{font-family:'Fraunces',serif;font-size:22px;font-weight:500;margin:0 0 10px}
  .material p{font-size:14px;color:var(--ink-2);margin:0}

  /* Editorial */
  .editorial{display:grid;grid-template-columns:1fr 1fr;align-items:stretch}
  .editorial-img{aspect-ratio:4/5;overflow:hidden}
  .editorial-img img{width:100%;height:100%;object-fit:cover}
  .editorial-text{padding:clamp(48px,6vw,96px);background:var(--ink);color:var(--bg);display:flex;flex-direction:column;justify-content:center}
  .editorial-text h2{font-family:'Fraunces',serif;font-size:clamp(32px,4vw,52px);font-weight:300;line-height:1.1;margin:16px 0 24px}
  .editorial-text h2 em{font-style:italic;color:var(--accent)}
  .editorial-text p{color:rgba(250,247,242,.75);margin:0 0 32px;max-width:420px}
  .editorial-text .btn-primary{background:var(--bg);color:var(--ink)}
  .editorial-text .btn-primary:hover{background:var(--accent);color:var(--bg)}

  /* Testimonials */
  .testimonials{background:var(--bg-2)}
  .testimonial-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .testimonial{background:var(--bg);padding:32px;border-radius:2px;border:1px solid var(--line)}
  .testimonial .stars{color:var(--accent);font-size:14px;letter-spacing:2px;margin-bottom:16px}
  .testimonial blockquote{font-family:'Fraunces',serif;font-size:18px;line-height:1.5;margin:0 0 20px;font-weight:400}
  .testimonial cite{font-style:normal;font-size:13px;color:var(--muted);display:block}
  .testimonial cite strong{color:var(--ink);font-weight:500;display:block;margin-bottom:2px}

  /* Journal */
  .journal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
  .journal-card{text-decoration:none;color:inherit;display:block}
  .journal-card .img-wrap{aspect-ratio:4/3;overflow:hidden;border-radius:2px;margin-bottom:20px}
  .journal-card img{width:100%;height:100%;object-fit:cover;transition:transform .8s var(--ease)}
  .journal-card:hover img{transform:scale(1.04)}
  .journal-card .meta{font-size:12px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
  .journal-card h3{font-family:'Fraunces',serif;font-size:22px;font-weight:500;margin:0 0 8px;line-height:1.3}
  .journal-card p{font-size:14px;color:var(--ink-2);margin:0}

  /* Newsletter */
  .newsletter{background:var(--ink);color:var(--bg);text-align:center;padding:clamp(80px,12vw,140px) 0}
  .newsletter h2{font-family:'Fraunces',serif;font-size:clamp(36px,5vw,64px);font-weight:300;line-height:1.05;margin:16px 0 20px}
  .newsletter h2 em{font-style:italic;color:var(--accent)}
  .newsletter p{color:rgba(250,247,242,.7);max-width:480px;margin:0 auto 32px}
  .newsletter-form{display:flex;max-width:480px;margin:0 auto;gap:8px;background:rgba(250,247,242,.08);border:1px solid rgba(250,247,242,.2);border-radius:999px;padding:6px}
  .newsletter-form input{flex:1;background:transparent;border:none;color:var(--bg);font-family:inherit;font-size:14px;padding:12px 20px;outline:none}
  .newsletter-form input::placeholder{color:rgba(250,247,242,.5)}
  .newsletter-form button{background:var(--bg);color:var(--ink);border:none;border-radius:999px;padding:12px 28px;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background .3s var(--ease)}
  .newsletter-form button:hover{background:var(--accent);color:var(--bg)}
  .newsletter-note{font-size:12px;color:rgba(250,247,242,.5);margin-top:16px}

  /* Footer */
  footer{background:var(--bg-2);padding:80px 0 32px;border-top:1px solid var(--line)}
  .footer-grid{display:grid;grid-template-columns:1.5fr repeat(4,1fr);gap:48px;margin-bottom:56px}
  .footer-brand .logo{text-align:left;margin-bottom:16px;display:inline-block}
  .footer-brand p{font-size:14px;color:var(--ink-2);max-width:280px;margin:0 0 24px}
  .socials{display:flex;gap:12px}
  .socials a{width:36px;height:36px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink);text-decoration:none;transition:all .3s var(--ease)}
  .socials a:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
  .footer-col h4{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);margin:0 0 18px;font-weight:500}
  .footer-col ul{list-style:none;padding:0;margin:0}
  .footer-col li{margin-bottom:10px}
  .footer-col a{color:var(--ink-2);text-decoration:none;font-size:14px;transition:color .3s var(--ease)}
  .footer-col a:hover{color:var(--accent)}
  .footer-bottom{border-top:1px solid var(--line);padding-top:28px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted);gap:16px;flex-wrap:wrap}
  .footer-bottom .pay{display:flex;gap:8px}
  .footer-bottom .pay span{background:var(--bg);border:1px solid var(--line);padding:4px 10px;border-radius:4px;font-size:11px;color:var(--ink-2)}

  /* Cart drawer */
  .drawer-overlay{position:fixed;inset:0;background:rgba(31,27,23,.4);backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:opacity .3s var(--ease),visibility .3s var(--ease);z-index:200}
  .drawer-overlay.open{opacity:1;visibility:visible}
  .drawer{position:fixed;top:0;right:0;width:440px;max-width:100%;height:100vh;background:var(--bg);z-index:201;transform:translateX(100%);transition:transform .4s var(--ease);display:flex;flex-direction:column;box-shadow:var(--shadow-lg)}
  .drawer.open{transform:translateX(0)}
  .drawer-head{display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:1px solid var(--line)}
  .drawer-head h3{font-family:'Fraunces',serif;font-size:22px;font-weight:500;margin:0}
  .drawer-close{background:none;border:none;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--ink)}
  .drawer-body{flex:1;overflow-y:auto;padding:24px}
  .drawer-empty{text-align:center;padding:60px 20px;color:var(--muted)}
  .cart-item{display:grid;grid-template-columns:80px 1fr auto;gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
  .cart-item img{width:80px;height:100px;object-fit:cover;border-radius:2px}
  .cart-item h4{font-family:'Fraunces',serif;font-size:16px;font-weight:500;margin:0 0 4px}
  .cart-item .meta{font-size:12px;color:var(--muted);margin-bottom:8px}
  .qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;overflow:hidden}
  .qty button{background:none;border:none;cursor:pointer;width:28px;height:28px;font-size:14px;color:var(--ink)}
  .qty span{padding:0 8px;font-size:13px;min-width:24px;text-align:center}
  .cart-item .remove{background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;text-decoration:underline;margin-top:8px;padding:0}
  .cart-item .item-price{font-size:14px;font-weight:500;text-align:right;align-self:flex-start}
  .drawer-foot{padding:24px;border-top:1px solid var(--line);background:var(--bg-2)}
  .drawer-row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px}
  .drawer-row.total{font-family:'Fraunces',serif;font-size:20px;border-top:1px solid var(--line);padding-top:16px;margin-top:16px}
  .checkout-btn{width:100%;background:var(--ink);color:var(--bg);border:none;padding:16px;border-radius:999px;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;margin-top:12px;transition:background .3s var(--ease)}
  .checkout-btn:hover{background:var(--accent)}

  /* Mobile nav */
  .mobile-nav{position:fixed;inset:0;background:var(--bg);z-index:150;transform:translateY(-100%);transition:transform .4s var(--ease);display:flex;flex-direction:column;padding:80px 32px 32px}
  .mobile-nav.open{transform:translateY(0)}
  .mobile-nav a{font-family:'Fraunces',serif;font-size:32px;text-decoration:none;color:var(--ink);padding:12px 0;border-bottom:1px solid var(--line)}

  /* Reveal */
  .reveal{opacity:0;transform:translateY(24px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
  .reveal.in{opacity:1;transform:none}

  /* Toast */
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(120%);background:var(--ink);color:var(--bg);padding:14px 24px;border-radius:999px;font-size:14px;z-index:300;transition:transform .4s var(--ease);box-shadow:var(--shadow-lg)}
  .toast.show{transform:translateX(-50%) translateY(0)}

  /* Responsive */
  @media (max-width:1024px){
    .categories,.products{grid-template-columns:repeat(2,1fr)}
    .materials-grid,.testimonial-grid,.journal-grid{grid-template-columns:repeat(2,1fr)}
    .footer-grid{grid-template-columns:1fr 1fr;gap:32px}
    .footer-brand{grid-column:1 / -1}
  }
  @media (max-width:768px){
    .nav-inner{grid-template-columns:auto 1fr auto}
    .nav-links{display:none}
    .menu-toggle{display:inline-flex}
    .hero-grid,.story-grid,.editorial{grid-template-columns:1fr}
    .editorial-text{padding:48px 32px}
    .story-visual .small-img{display:none}
    .section-head{flex-direction:column;align-items:flex-start}
    .materials-grid,.testimonial-grid,.journal-grid{grid-template-columns:1fr}
    .nav-actions .search-label{display:none}
  }
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms !important;transition-duration:.01ms !important}
    .marquee-track{animation:none}
  }
</style>
</head>
<body>

<!-- Announcement -->
<div class="announce">Complimentary carbon-neutral shipping on orders over $150 — <a href="#">Learn more</a></div>

<!-- Navigation -->
<header class="nav">
  <div class="container nav-inner">
    <nav class="nav-links" aria-label="Primary">
      <a href="#shop">Shop</a>
      <a href="#collections">Collections</a>
      <a href="#story">Our Story</a>
      <a href="#journal">Journal</a>
      <a href="#contact">Contact</a>
    </nav>
    <a href="#" class="logo">Scandi<em>Haven</em></a>
    <div class="nav-actions">
      <button class="icon-btn search-label" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <span class="search-label">Search</span>
      </button>
      <button class="icon-btn" aria-label="Account">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
      </button>
      <button class="icon-btn" id="cartBtn" aria-label="Cart">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 7h12l-1.5 12.5a2 2 0 0 1-2 1.5H9.5a2 2 0 0 1-2-1.5L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>
        <span class="cart-count" id="cartCount">0</span>
      </button>
      <button class="menu-toggle" id="menuToggle" aria-label="Menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</header>

<!-- Mobile menu -->
<nav class="mobile-nav" id="mobileNav">
  <a href="#shop">Shop</a>
  <a href="#collections">Collections</a>
  <a href="#story">Our Story</a>
  <a href="#journal">Journal</a>
  <a href="#contact">Contact</a>
</nav>

<!-- Hero -->
<section class="hero">
  <div class="container hero-grid">
    <div class="hero-text reveal">
      <span class="eyebrow">New — Autumn Collection 2025</span>
      <h1>Slow living,<br><em>beautifully</em> made.</h1>
      <p class="lede">Understated furniture, lighting and textiles, crafted in Northern Europe from sustainable oak, linen and clay. Made to last a lifetime — and to soften every room.</p>
      <div class="btn-row">
        <a href="#shop" class="btn btn-primary">Shop the collection
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="#story" class="btn btn-ghost">Our craft</a>
      </div>
    </div>
    <div class="hero-visual reveal">
      <img src="https://picsum.photos/seed/scandi-hero-armchair/900/1100" alt="Linen armchair in a sunlit living room" />
      <div class="hero-tag">
        <span class="eyebrow">Featured</span>
        <h4>Halden Linen Armchair</h4>
        <div class="price">$890 · Oak / Sand</div>
      </div>
    </div>
  </div>
</section>

<!-- Marquee -->
<div class="marquee" aria-hidden="true">
  <div class="marquee-track">
    <span>Handcrafted in Denmark</span><span>FSC-certified oak</span><span>Carbon-neutral delivery</span><span>10-year guarantee</span><span>Plant-based textiles</span>
    <span>Handcrafted in Denmark</span><span>FSC-certified oak</span><span>Carbon-neutral delivery</span><span>10-year guarantee</span><span>Plant-based textiles</span>
  </div>
</div>

<!-- Categories -->
<section class="section" id="collections">
  <div class="container">
    <div class="section-head reveal">
      <div>
        <span class="eyebrow">Browse by category</span>
        <h2>For every <em>quiet</em> corner.</h2>
      </div>
      <a href="#shop" class="link">View all categories →</a>
    </div>
    <div class="categories">
      <a href="#" class="category reveal">
        <img src="https://picsum.photos/seed/scandi-cat-furniture/600/800" alt="Furniture">
        <div class="category-label"><h3>Furniture</h3><span>42 pieces</span></div>
      </a>
      <a href="#" class="category reveal">
        <img src="https://picsum.photos/seed/scandi-cat-lighting/600/800" alt="Lighting">
        <div class="category-label"><h3>Lighting</h3><span>28 pieces</span></div>
      </a>
      <a href="#" class="category reveal">
        <img src="https://picsum.photos/seed/scandi-cat-textiles/600/800" alt="Textiles">
        <div class="category-label"><h3>Textiles</h3><span>36 pieces</span></div>
      </a>
      <a href="#" class="category reveal">
        <img src="https://picsum.photos/seed/scandi-cat-ceramics/600/800" alt="Ceramics">
        <div class="category-label"><h3>Ceramics</h3><span>24 pieces</span></div>
      </a>
    </div>
  </div>
</section>

<!-- Featured products -->
<section class="section" id="shop" style="padding-top:0">
  <div class="container">
    <div class="section-head reveal">
      <div>
        <span class="eyebrow">New arrivals</span>
        <h2>Pieces we'd <em>live with</em>.</h2>
      </div>
      <a href="#" class="link">Shop all new →</a>
    </div>
    <div class="products" id="productGrid"></div>
  </div>
</section>

<!-- Story -->
<section class="section story" id="story">
  <div class="container story-grid">
    <div class="story-visual reveal">
      <img src="https://picsum.photos/seed/scandi-story-workshop/800/960" alt="Workshop">
      <img class="small-img" src="https://picsum.photos/seed/scandi-story-detail/400/400" alt="Detail">
    </div>
    <div class="story-text reveal">
      <span class="eyebrow">Our story</span>
      <h2>A workshop in <em>Aalborg</em>, since 1998.</h2>
      <p>Scandi Haven began as a small family workshop in northern Denmark, where founder Mette Sørensen set out to make furniture she couldn't find elsewhere: honest, restrained, and built to outlast trends.</p>
      <p>Two decades later, we work with a collective of Nordic craftspeople — sourcing FSC-certified oak, plant-fibred linen and low-fire clay. Every piece carries the maker's mark.</p>
      <div class="story-stats">
        <div class="story-stat"><span class="num">27</span><span class="lbl">Years in craft</span></div>
        <div class="story-stat"><span class="num">14</span><span class="lbl">Nordic makers</span></div>
        <div class="story-stat"><span class="num">100%</span><span class="lbl">FSC oak</span></div>
      </div>
      <a href="#" class="btn btn-ghost">Read our manifesto</a>
    </div>
  </div>
</section>

<!-- Materials -->
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <div>
        <span class="eyebrow">Made to last</span>
        <h2>Materials we <em>trust</em>.</h2>
      </div>
    </div>
    <div class="materials-grid">
      <div class="material reveal">
        <div class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M5 8l7-6 7 6M5 16l7 6 7-6"/></svg></div>
        <h3>FSC Oak</h3>
        <p>Solid oak from sustainably managed forests in southern Sweden, kiln-dried and finished with raw linseed oil.</p>
      </div>
      <div class="material reveal">
        <div class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></div>
        <h3>European Linen</h3>
        <p>Flax grown in Normandy, woven in Belgium. Naturally antibacterial, biodegradable, and softened with each wash.</p>
      </div>
      <div class="material reveal">
        <div class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg></div>
        <h3>Hand-thrown Clay</h3>
        <p>Stoneware fired at 1240°C in a wood kiln by ceramicist Lars Berg in Gothenburg — no two pieces alike.</p>
      </div>
    </div>
  </div>
</section>

<!-- Editorial -->
<section class="editorial">
  <div class="editorial-img reveal">
    <img src="https://picsum.photos/seed/scandi-editorial-room/900/1100" alt="Editorial room">
  </div>
  <div class="editorial-text reveal">
    <span class="eyebrow" style="color:var(--accent)">The Hygge Edit</span>
    <h2>A room is a <em>feeling</em>.</h2>
    <p>For autumn we've gathered pieces that ask you to slow down — a low slung chair, a heavy linen throw, a lamp that throws soft amber light across the floor.</p>
    <a href="#" class="btn btn-primary">Shop the Hygge Edit
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
  </div>
</section>

<!-- Testimonials -->
<section class="section testimonials">
  <div class="container">
    <div class="section-head reveal">
      <div>
        <span class="eyebrow">From our home to yours</span>
        <h2>Loved by <em>2,400+</em> homes.</h2>
      </div>
      <a href="#" class="link">Read all reviews →</a>
    </div>
    <div class="testimonial-grid">
      <div class="testimonial reveal">
        <div class="stars">★★★★★</div>
        <blockquote>"The Halden armchair arrived fully assembled and feels like it was made for our living room. Three years in and it has only softened beautifully."</blockquote>
        <cite><strong>Freja L.</strong>Copenhagen, DK</cite>
      </div>
      <div class="testimonial reveal">
        <div class="stars">★★★★★</div>
        <blockquote>"I waited six months for the Berg floor lamp and would do it again. The light is warm, the brass has aged like a heirloom."</blockquote>
        <cite><strong>Henry W.</strong>Portland, US</cite>
      </div>
      <div class="testimonial reveal">
        <div class="stars">★★★★★</div>
        <blockquote>"Customer service replaced a chipped ceramic bowl without question. You can tell this is a company that stands behind what they make."</blockquote>
        <cite><strong>Sofia M.</strong>Stockholm, SE</cite>
      </div>
    </div>
  </div>
</section>

<!-- Journal -->
<section class="section" id="journal">
  <div class="container">
    <div class="section-head reveal">
      <div>
        <span class="eyebrow">From the journal</span>
        <h2>Notes on <em>slow living</em>.</h2>
      </div>
      <a href="#" class="link">All journal entries →</a>
    </div>
    <div class="journal-grid">
      <a href="#" class="journal-card reveal">
        <div class="img-wrap"><img src="https://picsum.photos/seed/scandi-journal-1/700/520" alt=""></div>
        <div class="meta">Craft · 6 min read</div>
        <h3>Why oak gets better with age</h3>
        <p>A short guide to oiling, brushing and accepting the small marks a piece will gather over a decade.</p>
      </a>
      <a href="#" class="journal-card reveal">
        <div class="img-wrap"><img src="https://picsum.photos/seed/scandi-journal-2/700/520" alt=""></div>
        <div class="meta">Home · 4 min read</div>
        <h3>Lighting a room for autumn</h3>
        <p>Three small changes — lamp height, bulb temperature, layering — that shift how a room feels at dusk.</p>
      </a>
      <a href="#" class="journal-card reveal">
        <div class="img-wrap"><img src="https://picsum.photos/seed/scandi-journal-3/700/520" alt=""></div>
        <div class="meta">People · 8 min read</div>
        <h3>A day in the Aalborg workshop</h3>
        <p>We spend a morning with founder Mette and her team as they finish the autumn run of dining chairs.</p>
      </a>
    </div>
  </div>
</section>

<!-- Newsletter -->
<section class="newsletter">
  <div class="container">
    <span class="eyebrow" style="color:var(--accent)">Join the list</span>
    <h2>Letters from <em>Aalborg</em>.</h2>
    <p>One quiet email a month — new pieces, workshop notes, and early access to small-batch releases. No noise.</p>
    <form class="newsletter-form" id="newsletterForm">
      <input type="email" placeholder="Your email address" required aria-label="Email address" />
      <button type="submit">Subscribe</button>
    </form>
    <p class="newsletter-note">By subscribing you agree to our privacy policy. Unsubscribe anytime.</p>
  </div>
</section>

<!-- Footer -->
<footer id="contact">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="#" class="logo">Scandi<em>Haven</em></a>
        <p>Honest furniture, lighting and textiles — crafted in Northern Europe since 1998.</p>
        <div class="socials">
          <a href="#" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></a>
          <a href="#" aria-label="Pinterest"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 20c-.5-2 .5-7 1.5-10M9 11c0-2 1.5-3.5 4-3.5 2 0 3.5 1.5 3.5 3.5 0 2.5-1.5 4-3.5 4-1.2 0-2-.8-2-2"/></svg></a>
          <a href="#" aria-label="YouTube"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg></a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="#">Furniture</a></li>
          <li><a href="#">Lighting</a></li>
          <li><a href="#">Textiles</a></li>
          <li><a href="#">Ceramics</a></li>
          <li><a href="#">Gift cards</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>About</h4>
        <ul>
          <li><a href="#">Our story</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Materials</a></li>
          <li><a href="#">Journal</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <ul>
          <li><a href="#">Shipping</a></li>
          <li><a href="#">Returns</a></li>
          <li><a href="#">Care guide</a></li>
          <li><a href="#">Trade program</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Visit</h4>
        <ul>
          <li><a href="#">Aalborg showroom</a></li>
          <li><a href="#">Copenhagen store</a></li>
          <li><a href="#">Stockholm pop-up</a></li>
          <li><a href="#">Trade login</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2025 Scandi Haven ApS · CVR 31 28 14 90 · Made in Denmark</span>
      <div class="pay">
        <span>VISA</span><span>MASTERCARD</span><span>PAYPAL</span><span>KLARNA</span><span>APPLE PAY</span>
      </div>
    </div>
  </div>
</footer>

<!-- Cart drawer -->
<div class="drawer-overlay" id="overlay"></div>
<aside class="drawer" id="drawer" aria-label="Shopping cart" aria-hidden="true">
  <div class="drawer-head">
    <h3>Your cart</h3>
    <button class="drawer-close" id="drawerClose" aria-label="Close cart">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M6 18 18 6"/></svg>
    </button>
  </div>
  <div class="drawer-body" id="drawerBody"></div>
  <div class="drawer-foot" id="drawerFoot" style="display:none">
    <div class="drawer-row"><span>Subtotal</span><span id="subtotal">$0</span></div>
    <div class="drawer-row"><span>Shipping</span><span>Calculated at checkout</span></div>
    <div class="drawer-row total"><span>Total</span><span id="total">$0</span></div>
    <button class="checkout-btn">Proceed to checkout</button>
  </div>
</aside>

<div class="toast" id="toast">Added to cart</div>

<script>
  // ---------- Product catalogue ----------
  const PRODUCTS = [
    {id:1, name:"Halden Linen Armchair", meta:"Oak / Sand", price:890, badge:"New", img:"scandi-p-1a", alt:"scandi-p-1b"},
    {id:2, name:"Berg Brass Floor Lamp", meta:"Brushed brass", price:340, badge:"", img:"scandi-p-2a", alt:"scandi-p-2b"},
    {id:3, name:"Fjord Wool Throw", meta:"Heavyweight wool", price:120, badge:"", img:"scandi-p-3a", alt:"scandi-p-3a"},
    {id:4, name:"Nord Ceramic Bowl", meta:"Hand-thrown stoneware", price:68, badge:"Sale", priceOld:85, img:"scandi-p-4a", alt:"scandi-p-4b"},
    {id:5, name:"Oslo Oak Side Table", meta:"Solid oak / oil", price:420, badge:"", img:"scandi-p-5a", alt:"scandi-p-5b"},
    {id:6, name:"Lyng Linen Cushion", meta:"Stone / 50cm", price:78, badge:"", img:"scandi-p-6a", alt:"scandi-p-6b"},
    {id:7, name:"Møller Dining Chair", meta:"Oak / black stain", price:280, badge:"New", img:"scandi-p-7a", alt:"scandi-p-7b"},
    {id:8, name:"Skog Wall Sconce", meta:"Patinated brass", price:165, badge:"", img:"scandi-p-8a", alt:"scandi-p-8b"}
  ];

  // ---------- Render products ----------
  const grid = document.getElementById('productGrid');
  grid.innerHTML = PRODUCTS.map(p => `
    <a href="#" class="product reveal" data-id="${p.id}">
      <div class="product-image">
        ${p.badge ? `<span class="product-badge ${p.badge==='Sale'?'sale':''}">${p.badge}</span>` : ''}
        <img class="main" src="https://picsum.photos/seed/${p.img}/600/750" alt="${p.name}">
        <img class="alt" src="https://picsum.photos/seed/${p.alt}/600/750" alt="${p.name} alternate">
        <button class="quick-add" data-id="${p.id}">Quick add — $${p.price}</button>
      </div>
      <div class="product-info">
        <div>
          <h3>${p.name}</h3>
          <div class="meta">${p.meta}</div>
        </div>
        <div class="price">${p.priceOld?`<span class="old">$${p.priceOld}</span>`:''}$${p.price}</div>
      </div>
    </a>
  `).join('');

  // ---------- Cart state ----------
  let cart = [];
  const cartCountEl = document.getElementById('cartCount');
  const drawerBody = document.getElementById('drawerBody');
  const drawerFoot = document.getElementById('drawerFoot');
  const subtotalEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');

  function renderCart(){
    cartCountEl.textContent = cart.reduce((a,c)=>a+c.qty,0);
    if(cart.length===0){
      drawerBody.innerHTML = `<div class="drawer-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:.4"><path d="M6 7h12l-1.5 12.5a2 2 0 0 1-2 1.5H9.5a2 2 0 0 1-2-1.5L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>
        <p>Your cart is empty.</p>
        <p style="font-size:13px;margin-top:8px">Explore the collection to find something you'll live with.</p>
      </div>`;
      drawerFoot.style.display = 'none';
      return;
    }
    drawerBody.innerHTML = cart.map(item=>{
      const p = PRODUCTS.find(x=>x.id===item.id);
      return `<div class="cart-item">
        <img src="https://picsum.photos/seed/${p.img}/200/250" alt="${p.name}">
        <div>
          <h4>${p.name}</h4>
          <div class="meta">${p.meta}</div>
          <div class="qty">
            <button data-act="dec" data-id="${p.id}">−</button>
            <span>${item.qty}</span>
            <button data-act="inc" data-id="${p.id}">+</button>
          </div>
          <button class="remove" data-act="rm" data-id="${p.id}">Remove</button>
        </div>
        <div class="item-price">$${p.price*item.qty}</div>
      </div>`;
    }).join('');
    const subtotal = cart.reduce((s,c)=>s + PRODUCTS.find(p=>p.id===c.id).price * c.qty, 0);
    subtotalEl.textContent = '$'+subtotal;
    totalEl.textContent = '$'+subtotal;
    drawerFoot.style.display = 'block';
  }

  function addToCart(id){
    const ex = cart.find(c=>c.id===id);
    if(ex) ex.qty++; else cart.push({id, qty:1});
    renderCart();
    openDrawer();
    showToast(PRODUCTS.find(p=>p.id===id).name + ' added');
  }
  function updateQty(id, delta){
    const c = cart.find(c=>c.id===id);
    if(!c) return;
    c.qty += delta;
    if(c.qty<=0) cart = cart.filter(x=>x.id!==id);
    renderCart();
  }
  function removeItem(id){ cart = cart.filter(c=>c.id!==id); renderCart(); }

  // Delegate cart interactions
  drawerBody.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const id = +btn.dataset.id;
    if(btn.dataset.act==='inc') updateQty(id,1);
    if(btn.dataset.act==='dec') updateQty(id,-1);
    if(btn.dataset.act==='rm') removeItem(id);
  });

  // Quick-add on product cards
  grid.addEventListener('click', e=>{
    const btn = e.target.closest('.quick-add');
    if(!btn) return;
    e.preventDefault();
    addToCart(+btn.dataset.id);
  });

  // ---------- Drawer ----------
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  function openDrawer(){ drawer.classList.add('open'); overlay.classList.add('open'); drawer.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  document.getElementById('cartBtn').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrawer(); });

  // ---------- Mobile menu ----------
  const mobileNav = document.getElementById('mobileNav');
  document.getElementById('menuToggle').addEventListener('click', ()=>{
    mobileNav.classList.toggle('open');
  });
  mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>mobileNav.classList.remove('open')));

  // ---------- Toast ----------
  const toast = document.getElementById('toast');
  let toastTimer;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.remove('show'), 2400);
  }

  // ---------- Newsletter ----------
  document.getElementById('newsletterForm').addEventListener('submit', e=>{
    e.preventDefault();
    showToast('Thank you — see you in Aalborg.');
    e.target.reset();
  });

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver(entries=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // ---------- Init ----------
  renderCart();
</script>
</body>
</html>
```

---

## 2. Project Requirements Document (PRD)
### Scandi Haven — Production-Ready E-Commerce Platform

**Version:** 1.0 · **Author:** Product · **Last updated:** 2025 · **Status:** Approved for build

---

### 1. Executive Summary

Scandi Haven is a direct-to-consumer e-commerce brand selling handcrafted Scandinavian furniture, lighting, textiles and ceramics. The current marketing landing page (captured above) communicates the brand but is non-functional: no real checkout, no account, no inventory, no admin.

This PRD defines the requirements to build a **full production e-commerce platform** — customer-facing storefront, headless commerce APIs, admin back-office, and integrations — capable of supporting €5M+ annual GMV across EU + US markets with a four-person operating team.

**North-star metric:** Conversion rate (visitor → paid order) ≥ 2.4% on cold traffic.
**Secondary metrics:** Average order value €420+, repeat-purchase rate ≥ 38% within 12 months, NPS ≥ 70.

---

### 2. Goals & Non-Goals

**Goals**
- Replace the static landing page with a full storefront (PLP, PDP, cart, checkout, account, order management).
- Provide an admin back-office for products, orders, customers, content and promotions usable by a non-technical operator.
- Support multi-region (EU + US + UK) with localized pricing, taxes, shipping and language.
- Be performant (Core Web Vitals "Good" on all key pages), accessible (WCAG 2.2 AA), and SEO-competitive.
- Be commercially extensible (discounts, gift cards, trade program, subscriptions later).

**Non-Goals (v1)**
- Marketplace / third-party sellers.
- Physical retail POS integration.
- Augmented-reality room visualisation.
- Native mobile apps (responsive web only).
- Custom manufacturing / ERP integration (Phase 2).

---

### 3. Target Audience & Personas

**P1 — "The Considered Buyer"** · 35–55, design-literate, urban professional, €80k+ household income. Buys 1–3 major pieces per year. Researches for weeks. Values provenance, materials, longevity. Will pay premium for craft and service.

**P2 — "The New-Home Nestor"** · 28–40, furnishing first or second home, €50k+ income. Mid-funnel via Pinterest/Instagram. Higher category breadth per order. Sensitive to shipping cost and lead-time clarity.

**P3 — "Trade Buyer (B2B)"** · Interior designers, architects, boutique hospitality. Needs trade pricing, lead times, sample ordering, line-of-credit. Represents ~22% of forecasted revenue.

**P4 — "The Gift Buyer"** · Seasonal, lower AOV (€60–€180), ships to third address. Needs gift wrap, gift card, message field, easy returns.

---

### 4. Functional Requirements (by domain)

#### 4.1 Storefront — Navigation & Discovery
- **Global header:** logo, primary nav (Shop, Collections, Our Story, Journal, Contact), search, account, cart. Sticky on scroll. Mobile hamburger drawer.
- **Search:** instant results with product image, name, price; typeahead suggestions for categories and journal entries; supports synonyms ("couch" → "sofa"); typo tolerance; recent searches.
- **Mega-menu:** Shop → Furniture → Seating / Tables / Storage / Beds; each with featured collection thumbnail.
- **Footer:** shop links, about links, help links, showroom addresses, newsletter form, social icons, payment methods, legal links, locale switcher.

#### 4.2 Product Listing Page (PLP)
- Filters: category, sub-category, material, colour, price range, availability, lead time, collection.
- Sort: featured, newest, price asc/desc, best-selling.
- Grid/list toggle. Product card: image (hover-swap), badge (New/Sale/Low-stock), name, material, price (with strikethrough if on sale), quick-add.
- Pagination or infinite scroll (pref: pagination with 24 per page for SEO + shareable URLs).
- SEO-friendly URLs: `/shop/furniture/seating/halden-linen-armchair`.
- Faceted URL params (`?material=oak&color=sand`) that are canonicalized and indexable.
- Empty-state messaging when filters return zero results.

#### 4.3 Product Detail Page (PDP)
- Image gallery: primary + up to 8 thumbnails, zoom-on-hover, swipe on mobile, video optional.
- Variants: material/colour/size selectors with swatch images and stock state per variant.
- Price display: current price, compare-at price, "save X%" badge, tax-inclusive label per locale.
- **Lead-time badge:** "Made to order — ships in 6–8 weeks" or "In stock — ships in 2–4 days".
- Quantity selector, **Add to cart** primary CTA, **Save to wishlist** secondary.
- Description (rich text), materials & care accordion, dimensions diagram, sustainability notes, shipping & returns accordion.
- Cross-sell: "Pairs well with" (4 products, merchandiser-curated + algorithmic fallback).
- Reviews: star summary, distribution bars, paginated reviews with photos, sort by recency/helpfulness, write-a-review form (post-purchase verified buyers only).
- Sticky mobile add-to-cart bar.
- Structured data: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList`.

#### 4.4 Cart & Checkout
- Slide-out mini-cart drawer (already prototyped in the captured HTML) with line items, qty stepper, remove, subtotal, "Proceed to checkout".
- Full cart page with order summary, shipping estimate by ZIP/postcode, promo code field, gift card field.
- **Checkout:** single-page, 3 steps (Information → Shipping → Payment), express options (Apple Pay, Google Pay, Klarna, PayPal).
- Address autocomplete (Google Places or Loqate).
- Guest checkout supported; account creation offered post-purchase.
- Multi-currency display; charged in customer's currency with locked FX rate at order.
- Tax calculation by destination (Avalara or Stripe Tax).
- Shipping methods: Standard, Express, White-glove (furniture), Pickup-at-showroom.
- Gift options: gift wrap (+€8), gift message, gift receipt (no prices in shipment).
- Order confirmation: on-screen + email + SMS (optional opt-in).

#### 4.5 Customer Account
- Auth: email/password, magic-link, OAuth (Google, Apple).
- Profile: name, email, phone, default addresses, communication preferences.
- Order history with status, tracking link, invoice PDF download.
- Reorder one-click, return-request initiation.
- Saved addresses, payment methods (tokenized via Stripe).
- Wishlist (multiple lists, shareable via URL).
- Reviews written + pending.
- Trade account: separate registration with business verification, trade-only pricing visible when approved.

#### 4.6 Content & Editorial
- **Collections** (curated groups of products with editorial header image, story copy, and product grid).
- **Journal** (blog posts with categories: Craft, Home, People, Sustainability). Rich-text WYSIWYG, hero image, inline product embeds ("shop this post").
- **Static pages:** Our Story, Sustainability, Materials, Showrooms, Trade Program, FAQ, Shipping, Returns, Privacy, Terms, Cookies, Accessibility.
- **Lookbooks** (seasonal, image-led, shoppable hotspots).
- Redirect manager for URL changes.

#### 4.7 Admin / Back-Office

**Dashboard:** revenue today/7d/30d, orders pending fulfilment, low-stock alerts, top products, conversion funnel.

**Catalog management:**
- Product CRUD: title, slug, description (rich text), variants, materials, dimensions, weight, HS code, country of origin, lead time, images (with alt text), collections, tags, SEO meta.
- Inventory per variant per warehouse (Aalborg warehouse + Copenhagen showroom floor stock).
- Pricing: base price per currency, sale price with schedule, trade price tier.
- Bulk import/export (CSV).

**Order management:**
- Order list with filters (status, date, channel, value, country).
- Order detail: line items, customer, addresses, payments, shipments, notes, timeline.
- Actions: capture payment, refund (partial/full), cancel, split-ship, mark shipped, print packing slip, print return label.
- Returns workflow: request → approve → ship → inspect → refund/exchange.
- Fraud review queue (flagged by risk score).

**Customer management:** searchable directory, order history, lifetime value, segment tags, manual notes, GDPR tools (export, anonymize, delete).

**Content management:** journal posts, collections, lookbooks, static pages, redirects, navigation menu editor.

**Promotions:** discount codes (fixed/percent/free shipping), automatic promotions, scheduling, usage limits, per-customer limits, product/category exclusions, BOGO, tiered ("spend €500 get €50 off").

**Gift cards:** digital gift cards, configurable denominations, custom design, scheduled delivery, balance lookup, fraud limits.

**Reporting:** sales by day/week/month, by product, by category, by channel, by country, by discount; export to CSV; scheduled email reports; cohort + repeat-purchase report.

**Settings:** regions enabled, currencies, tax rules, shipping zones & rates, payment providers, team members & roles, webhooks, API keys.

**Roles & permissions:** Owner, Admin, Merchandiser, Customer-service, Warehouse, Read-only.

#### 4.8 Trade / B2B
- Application form with business details + resale certificate upload.
- Manual approval workflow.
- Trade-only pricing visible after login (crossed-out retail + net price).
- Net-30 payment terms for approved accounts (via Stripe Invoicing).
- Bulk order pad (CSV upload of SKUs).
- Dedicated trade concierge contact.

#### 4.9 Post-Purchase
- Order status emails: confirmed, in-production, shipped, out-for-delivery, delivered.
- Tracking page (carrier-agnostic via AfterShip).
- Returns portal: self-service, reason codes, photo upload for damage, label generation, refund status.
- Review request email 21 days post-delivery.

---

### 5. Non-Functional Requirements

| Domain | Requirement |
|---|---|
| **Performance** | LCP < 2.0s on 4G mobile for PDP/PLP; INP < 200ms; CLS < 0.05. Product images served as AVIF/WebP via CDN with responsive `srcset`. |
| **Availability** | 99.95% monthly for storefront; 99.9% for admin. Multi-AZ; DR RTO 4h, RPO 15min. |
| **Scalability** | Support 10× traffic peak (e.g., holiday gift guide press) without degradation. Stateless web tier, horizontally scalable. |
| **Security** | OWASP ASVS L2; PCI DSS via Stripe (no card data on our servers); TLS 1.3; HSTS; CSP; signed S3 image URLs; secrets in vault; pen-test annually. |
| **Accessibility** | WCAG 2.2 AA; axe-core in CI; keyboard navigable; screen-reader tested with NVDA + VoiceOver. |
| **i18n** | English (default), Danish, German, Swedish. Language negotiation by URL prefix (`/de/...`) + Accept-Language. |
| **Browser support** | Last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 16+; Android Chrome 110+. |
| **SEO** | Server-rendered HTML; canonical URLs; sitemap.xml; robots.txt; structured data; breadcrumb; OG/Twitter cards; pagination via `rel=next/prev`. |
| **Privacy / Compliance** | GDPR (EU + UK), CCPA, Danish Cookie Order, EU Digital Services Act (DSA). Consent management via OneTrust or Cookiebot. |
| **Observability** | APM (Datadog or Sentry), structured logs, RUM (SpeedCurve or Datadog RUM), error tracking, alerting on SLO breaches. |
| **Backup** | Database PITR + daily snapshots; 30-day retention; quarterly restore drills. |

---

### 6. Information Architecture (Pages & Routes)

```
/                            Homepage
/shop                        All products
/shop/{category}             Category PLP (furniture, lighting, textiles, ceramics)
/shop/{category}/{sub}       Sub-category PLP
/collections                 All collections
/collections/{slug}          Single collection
/products/{slug}             PDP (canonical URL pattern; /shop/.../slug redirects here)
/journal                     Journal index
/journal/{category}/{slug}   Article
/lookbooks/{slug}            Lookbook
/our-story, /sustainability, /materials, /showrooms, /trade, /faq,
/shipping, /returns, /privacy, /terms, /cookies, /accessibility
/cart                        Full cart
/checkout                    Checkout
/account                     Account dashboard (auth required)
/account/orders, /account/addresses, /account/wishlists, /account/reviews,
/account/returns, /account/settings
/trade/apply                 Trade application
/search?q=                   Search results
/404, /500
```

Admin:
```
/admin                       Dashboard
/admin/catalog/products      Product list
/admin/catalog/products/new  Product editor
/admin/catalog/inventory     Inventory
/admin/orders                Order list
/admin/orders/{id}           Order detail
/admin/customers             Customer list
/admin/customers/{id}        Customer detail
/admin/content/{journal,collections,pages,lookbooks}
/admin/marketing/{promotions,gift-cards,email}
/admin/reports
/admin/settings/{regions,shipping,taxes,payments,team}
```

---

### 7. User Flows (illustrative)

**Flow A — First-time buyer (cold traffic → first order):**
1. Lands on homepage from Instagram ad.
2. Browses "Autumn Collection".
3. Opens Halden Armchair PDP.
4. Selects variant, adds to cart → cart drawer opens.
5. Clicks "Checkout".
6. Enters email + shipping address (autocomplete).
7. Selects standard shipping, sees lead time.
8. Pays with Apple Pay.
9. Sees confirmation, receives email.
10. 21 days post-delivery: review request email.
11. 30 days later: win-back email with €50 off next order.

**Flow B — Trade buyer:**
1. Lands via Google search "trade furniture suppliers Denmark".
2. Visits /trade, applies with CVR + resale cert.
3. Admin reviews within 48h, approves.
4. Buyer receives welcome email with login.
5. Logs in, sees trade prices.
6. Uploads CSV of SKUs to order pad.
7. Selects Net-30 terms.
8. Invoice generated via Stripe Invoicing, sent to AP email.

**Flow C — Return:**
1. Customer logs into /account/orders.
2. Clicks "Return item" on order.
3. Selects reason, uploads damage photo.
4. Receives prepaid return label by email.
5. Ships item; warehouse receives, inspects.
6. Admin approves refund; Stripe refunds original payment.
7. Customer receives refund-confirmation email.

---

### 8. Page-by-Page Specifications (key pages)

#### 8.1 Homepage
Sections (in order):
1. Announcement bar (rotating, dismissible, content-managed).
2. Hero — editorial split (image + headline + CTAs), content-managed, can be swapped per season.
3. Trust marquee (handcrafted, FSC oak, carbon-neutral, 10-year guarantee).
4. Featured categories (4 tiles, merchandiser-curated).
5. New arrivals (8 products, automated from `is_new=true`).
6. Brand story teaser (image + copy + stats + CTA).
7. Materials section (3 material cards).
8. Editorial collection block ("Hygge Edit") — dark background.
9. Testimonials (3-up, randomized from approved reviews).
10. Journal preview (3 latest posts).
11. Newsletter signup.
12. Footer.

#### 8.2 Product Detail Page
Specs in section 4.3. Additional:
- Breadcrumb (Home > Shop > Category > Product).
- Mobile sticky add-to-cart.
- Out-of-stock variant: disabled swatch + "Notify me" form (Klaviyo back-in-stock).
- Pre-order support: distinct badge + estimated ship date.

#### 8.3 Checkout
- Single-page accordion layout.
- Express pay buttons at top (Apple/Google/PayPal).
- Email → shipping → shipping method → payment → review.
- Trust badges, secure-checkout indicator.
- Inline validation, no page reloads.
- Error recovery: if payment fails, preserve form data, show clear error.
- abandonment: email triggered at 30min, 24h.

---

### 9. Data Model (high-level)

**Core entities:**

```
Product
  id, slug, title, description, status (draft/active/archived),
  category_id, brand, country_of_origin, hs_code,
  lead_time_days, is_new, is_preorder, created_at, updated_at

ProductVariant
  id, product_id, sku, material, color, size,
  weight_g, dimensions_cm, price_cents (multi-currency), compare_at_cents,
  inventory[{warehouse_id, qty, safety_stock}], images[]

Collection
  id, slug, title, hero_image, story_copy, product_ids[], sort

Order
  id, number, customer_id, status, currency,
  subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
  billing_address, shipping_address, shipments[], payments[],
  placed_at, fulfilled_at, refunded_at, source

OrderLine
  id, order_id, product_variant_id, qty, unit_price_cents, totals

Customer
  id, email, name, phone, addresses[], is_trade, trade_tier,
  lifetime_value_cents, segment_tags[], created_at

Promotion
  id, code, type (fixed/percent/freeship/boGO), value, conditions,
  schedule, usage_count, usage_limit, customer_limit

GiftCard
  id, code, balance_cents, purchaser_customer_id, recipient_email,
  expires_at, transactions[]

JournalPost
  id, slug, title, hero_image, body_html, category, published_at,
  author, related_product_ids[]

Review
  id, product_id, customer_id, order_id, rating, body, photos[],
  approved, created_at
```

Multi-currency: prices stored in EUR base; rates table updated daily; pricing overrides allowed per currency.

---

### 10. Technical Architecture

**Stack recommendation:**

- **Storefront:** Next.js 14 (App Router, RSC) on Vercel. Server-rendered for SEO, streaming for performance.
- **Styling:** Tailwind CSS + CSS variables for the design tokens (matches the captured palette).
- **Commerce backend:** **Medusa.js v2** (open-source, Node, self-hosted on AWS Fargate) OR **Shopify Plus** (faster TTM, higher licensing cost). Recommendation: **Medusa.js** for control over multi-warehouse, made-to-order lead times and trade pricing — requirements that are awkward in Shopify.
- **Database:** PostgreSQL 16 (RDS Aurora Serverless v2) + Redis (cache, sessions, rate-limit).
- **Search:** Algolia or Meilisearch (self-hosted). Index products + journal.
- **Image CDN:** Cloudinary or Cloudflare Images (AVIF/WebP, responsive variants, signed URLs for trade-only assets).
- **Email:** Resend (transactional) + Klaviyo (marketing).
- **Payments:** Stripe (cards, Apple/Google Pay), Klarna (BNPL), PayPal.
- **Tax:** Stripe Tax or Avalara AvaTax.
- **Shipping:** ShipStation or Shippo (rates + labels), AfterShip (tracking).
- **Analytics:** GA4 + Segment + Hotjar + Meta Pixel + Google Tag Manager.
- **Auth:** Auth0 or Clerk (email/password, magic link, OAuth).
- **CMS for journal:** Built-in (rich-text WYSIWYG in admin) or Sanity for editorial team.
- **Hosting:** Vercel (storefront), AWS Fargate (Medusa), RDS (DB), ElastiCache (Redis), S3 (assets).
- **CI/CD:** GitHub Actions → Vercel preview deploys + ECS Fargate blue/green.
- **IaC:** Terraform for AWS resources.

---

### 11. API Specification (key endpoints)

REST or GraphQL (recommend REST for v1 simplicity; Medusa already provides these):

```
GET    /store/products?category=&limit=&cursor=    List products
GET    /store/products/{slug}                       Product detail
POST   /store/carts                                 Create cart
GET    /store/carts/{id}                            Get cart
POST   /store/carts/{id}/line-items                 Add to cart
PUT    /store/carts/{id}/line-items/{lid}           Update qty
DELETE /store/carts/{id}/line-items/{lid}           Remove line
POST   /store/carts/{id}/promotions                 Apply promo
POST   /store/carts/{id}/complete                   Place order → returns order_id
GET    /store/orders/{id}                           Order detail (auth)
POST   /store/orders/{id}/returns                   Initiate return
GET    /store/customers/me                          Profile
POST   /store/customers/me/addresses                Add address
GET    /store/collections/{slug}                    Collection + products
POST   /store/newsletter/subscribe                  Newsletter signup
POST   /store/reviews                               Submit review
POST   /store/back-in-stock                         Notify me
```

Admin API (key-only):
```
GET/POST/PUT/DELETE /admin/products
GET/POST/PUT        /admin/orders/{id}
POST                /admin/orders/{id}/refund
POST                /admin/orders/{id}/ship
GET/POST            /admin/customers
GET/POST            /admin/promotions
GET/POST            /admin/gift-cards
GET                 /admin/reports/sales
```

Webhooks:
- `order.placed` → Klaviyo, ShipStation, Slack
- `order.shipped` → AfterShip, Klaviyo
- `order.delivered` → review request scheduled
- `inventory.updated` → back-in-stock notifier
- `return.requested` → admin Slack

---

### 12. Third-Party Integrations

| Purpose | Vendor | Notes |
|---|---|---|
| Payments | Stripe | EU + US, 3DS SCA compliant |
| BNPL | Klarna | DE/SE/DK/UK |
| Tax | Stripe Tax | Real-time by destination |
| Shipping rates & labels | Shippo | Multi-carrier |
| Tracking | AfterShip | Customer-facing tracking page |
| Email (transactional) | Resend | Order confirmations, shipping updates |
| Email (marketing) | Klaviyo | Newsletters, abandoned cart, flows |
| Reviews | Yotpo or Junip | Photo reviews, verified buyer |
| Search | Algolia | Faceted, typo-tolerant |
| CMS (journal) | Built-in or Sanity | Depends on editorial workflow |
| Auth | Clerk | Magic link, OAuth |
| Analytics | GA4 + Segment | Single event source |
| Error tracking | Sentry | Frontend + backend |
| APM | Datadog | Backend services |
| CDN | Cloudflare | WAF + image resizing |
| Consent | Cookiebot | GDPR/CCPA |

---

### 13. Design System

**Tokens (matching the captured landing page):**
- Background: `#FAF7F2` (warm off-white), `#F0EAE0` (cream), `#E8E0D2` (sand)
- Ink: `#1F1B17` (warm near-black), `#4A433B` (warm gray), `#8A8178` (muted)
- Accent: `#C97B5E` (terracotta), `#B06548` (deep terracotta)
- Secondary: `#8B9A82` (sage), `#C9A876` (wood)
- Line: `#E5DDD1`
- Display typeface: **Fraunces** (variable, opsz 9–144, weights 300–500, italic)
- UI typeface: **Inter** (weights 300–600)
- Type scale: 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64 / 96
- Radii: 2px (cards), 999px (pills), 0 (images — sharp editorial)
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80 / 120
- Motion: `cubic-bezier(0.22, 1, 0.36, 1)`, durations 200/300/400/800ms
- Elevation: minimal; use hairlines and warm backgrounds rather than drop shadows

**Components library:** build in Storybook — Button (primary/ghost/icon), Badge, ProductCard, CartDrawer, Drawer, Modal, Toast, Input, Select, Swatch, QuantityStepper, Accordion, Tabs, Pagination, Breadcrumb, Rating, Table, etc.

---

### 14. SEO Requirements

- Server-rendered HTML on all indexable pages.
- Per-page editable: `title`, `meta description`, `og:image`, `canonical`.
- Sitemap.xml generated daily, includes PLPs, PDPs, collections, journal, static pages.
- Robots.txt blocks `/admin`, `/account`, `/cart`, `/checkout`, `/search`.
- Structured data: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList`, `Article`, `Organization`, `WebSite` with SearchAction.
- Image sitemap; descriptive alt text required at CMS field level.
- Pagination via `rel=next/prev` and `?page=N` (not infinite scroll) for indexable PLPs.
- Hreflang tags for EN/DA/DE/SV.
- 301 redirect manager in admin.
- Core Web Vitals "Good" on PDP, PLP, homepage.

---

### 15. Analytics & Event Tracking

**GA4 events** (via Segment):
- `page_viewed`
- `product_viewed` (with product_id, variant, price)
- `product_list_viewed` (PLP, with list_id)
- `product_added_to_cart`, `product_removed_from_cart`
- `cart_viewed`, `checkout_started`, `checkout_step_completed`
- `payment_info_entered`, `order_completed` (revenue, currency, items)
- `wishlist_added`, `wishlist_removed`
- `review_submitted`
- `newsletter_subscribed`
- `search_performed` (with query)
- `promotion_applied` (with code)

**Conversions:** Purchase (primary), Add-to-cart, Begin-checkout, Email-subscribe.

**Dashboards:** Revenue (daily/weekly/monthly), Conversion rate by channel, AOV, Top products, Funnel (view → add → checkout → purchase), Cohort retention, Abandoned-cart recovery rate.

---

### 16. Security & Compliance

- **PCI DSS:** Use Stripe Elements + Payment Intents; never touch PAN. SAQ-A scope.
- **GDPR:** Cookie consent banner (Cookiebot), DSR (data subject request) workflow in admin (export + delete), data-retention policy (raw order data 7y for tax; customer profile deletable on request with order anonymized).
- **CCPA:** "Do Not Sell My Personal Information" link in footer.
- **EU DSA:** Trader identification on product pages, clear reporting channel for illegal content.
- **Danish Cookie Order:** Consent banner reflects local requirements.
- **Security:** WAF (Cloudflare), DDoS protection, rate-limiting on auth + checkout, bot detection (Cloudflare Bot Management), 2FA required for all admin users, audit log for all admin actions, secrets in AWS Secrets Manager, dependency scanning (Snyk) in CI.
- **Pen-test:** Annual third-party; quarterly internal review.

---

### 17. Performance Budget

| Page | LCP | INP | CLS | JS transferred |
|---|---|---|---|---|
| Homepage | < 2.0s | < 200ms | < 0.05 | < 180 KB |
| PLP | < 2.0s | < 200ms | < 0.05 | < 200 KB |
| PDP | < 2.0s | < 200ms | < 0.05 | < 220 KB |
| Checkout | < 1.5s | < 100ms | < 0.02 | < 250 KB |

Image strategy: AVIF first, WebP fallback; responsive `srcset`; lazy-load below the fold; CMS enforces max 200KB per hero, 80KB per product image.

---

### 18. Accessibility Requirements

- WCAG 2.2 AA.
- All interactive elements keyboard accessible; visible focus rings.
- Skip-to-content link.
- Semantic landmarks (`header`, `nav`, `main`, `footer`).
- ARIA on dynamic regions (cart drawer, mobile menu, toast).
- Form labels explicit; error messaging via `aria-describedby` + `role="alert"`.
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large text.
- Alt text required on all product images at upload.
- axe-core in CI; quarterly audit with screen-reader users.

---

### 19. Testing Strategy

- **Unit:** Jest / Vitest for business logic (pricing, tax, shipping).
- **Component:** React Testing Library on Storybook stories.
- **E2E:** Playwright covering critical paths (browse → add → checkout → order), running on every PR + hourly smoke in prod.
- **Visual regression:** Chromatic on Storybook.
- **Load:** k6 simulating 10× peak traffic on PLP + checkout.
- **Accessibility:** axe-core in CI + manual NVDA/VoiceOver sweeps per release.
- **Security:** Snyk (deps), OWASP ZAP (DAST), GitHub CodeQL (SAST).
- **UAT:** Pre-release checklist with merchandiser + customer-service.

---

### 20. Release & Rollout Plan

**Phase 0 — Foundations (4 weeks):**
- Repo setup, CI/CD, design system in Storybook, auth scaffold, Medusa deploy, Stripe connect, basic catalog import.

**Phase 1 — MVP Storefront (6 weeks):**
- Homepage, PLP, PDP, cart, checkout, order confirmation, customer account, search, basic admin (catalog + orders). Launch to staging.

**Phase 2 — Pre-launch polish (3 weeks):**
- Performance pass, accessibility audit, SEO setup, analytics, email flows, returns portal, reviews.

**Phase 3 — Soft launch (2 weeks):**
- Invite-only to existing newsletter; monitor; fix; refine.

**Phase 4 — Public launch:**
- DNS cutover, redirect legacy URLs, press kit, paid social.
- Rollback plan: feature flags on all major surfaces; instant rollback via Vercel + ECS.

**Phase 5 — Post-launch (ongoing):**
- Trade program (4 weeks post-launch), gift cards (6 weeks), subscriptions on consumables (Q+2), AR visualizer (Q+3).

---

### 21. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Long lead times (made-to-order) hurt conversion | High | High | Clear lead-time badges; "in-stock" filter; safety stock for hero SKUs |
| Cross-border tax complexity (EU OSS + US nexus) | Med | High | Use Stripe Tax from day 1; quarterly tax review |
| Carrier damage on large furniture | Med | Med | White-glove option for >30kg; packaging spec; damage-claim SOP |
| Image bloat hurts performance | High | Med | Hard limits in CMS; AVIF; CDN resizing |
| Trade program abuse (resale) | Low | Med | Manual approval; resale cert required; order limits |
| Single-supplier concentration (oak from SE) | Low | High | Qualify second supplier in PL; safety stock |
| SEO migration from current site | Med | High | 301 map; preserve high-traffic URLs; monitor 404s weekly |

---

### 22. Success Metrics (12-month targets)

| Metric | Target |
|---|---|
| Conversion rate (cold traffic) | ≥ 2.4% |
| AOV | ≥ €420 |
| Repeat purchase rate (12m) | ≥ 38% |
| NPS | ≥ 70 |
| Return rate | ≤ 6% |
| Order-to-ship lead (in-stock) | ≤ 3 business days |
| Customer-service first response | ≤ 4 business hours |
| Core Web Vitals "Good" | 100% of key pages |
| Uptime | ≥ 99.95% |
| Trade accounts active | ≥ 250 by month 12 |

---

### 23. Future Roadmap (post-launch)

- **Q+1:** Trade portal v2 (line-of-credit, bulk order pad, custom finishes).
- **Q+2:** Subscriptions on ceramics restocks + linens refills.
- **Q+3:** AR room visualizer (3D models per product).
- **Q+4:** Marketplace expansion (Norway, Finland, Netherlands).
- **Q+5:** Showroom booking system; in-store pickup expansion.
- **Q+6:** Sustainability impact dashboard per order (kg CO₂e, materials origin map).
- **Year 2:** Custom upholstery configurator; B2B contract pricing engine.

---

### 24. Appendices

**A. Glossary** — AOV, GMV, DSA, OSS, BNPL, PLP, PDP, RTO, RPO, SLO, CWV.

**B. Open questions for stakeholder review**
1. Final currency list at launch? (proposed: EUR, DKK, SEK, USD, GBP)
2. Net-30 trade credit — in-house or via Stripe Invoicing?
3. Warehouse strategy: single Aalborg vs. add EU 3PL for Southern Europe?
4. Editorial CMS: in-house WYSIWYG vs. Sanity — depends on editorial workflow.

**C. Sign-off**
- Product: ___ · Engineering: ___ · Design: ___ · Operations: ___ · Legal: ___

---

That gives you (1) a self-contained, faithful recreation of the Scandi Haven landing page in one HTML file with working cart, mobile menu, reveals, marquee, and editorial layout — and (2) a meticulous, build-ready PRD covering scope, personas, functional/non-functional requirements, data model, API surface, integrations, design system, security, performance budgets, testing, rollout, risks, metrics, and roadmap.
