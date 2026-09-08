"use client";

import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./server";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export type AuthSession = typeof auth.$Infer.Session;
