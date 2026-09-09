import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

// The sign-in form reads ?redirect= via useSearchParams; keep the route
// dynamic and wrap the client island in Suspense (Next 16 prerender contract,
// same shape as the admin sign-in route).
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-5 py-20 md:px-8" />}>
      <SignInForm />
    </Suspense>
  );
}
