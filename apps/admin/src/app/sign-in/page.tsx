import { Suspense } from "react";
import { AdminSignInForm } from "./sign-in-form";

// The sign-in form reads ?redirect= via useSearchParams; keep the route
// dynamic and wrap the client island in Suspense (Next 16 prerender contract).
export const dynamic = "force-dynamic";

export default function AdminSignInPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-5 py-28" />}>
      <AdminSignInForm />
    </Suspense>
  );
}
