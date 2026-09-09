pnpm lint
pnpm typecheck
pnpm test
pnpm build            # once (needs DATABASE_URL + BETTER_AUTH_SECRET — same as CI) 
pnpm prod             # storefront http://localhost:3000 
pnpm prod:admin       # admin     http://localhost:3001

---

pnpm install 
cp .env.example .env   # + openssl rand -base64 32 for BETTER_AUTH_SECRET 
pnpm lint && pnpm typecheck && pnpm test   # 8/8, 8/8, 7/7 — commerce 90.79%/89.65% 
DATABASE_URL=… BETTER_AUTH_SECRET=… pnpm build  # 2/2, ƒ Proxy
