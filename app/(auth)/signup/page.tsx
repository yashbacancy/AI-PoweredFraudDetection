import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <p>Purpose-built for fintech and payments.</p>
        <h1>Protect revenue with real-time fraud intelligence.</h1>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Create your Aegis account</h2>
          <p>Start with seeded demo data instantly after signup.</p>
          <AuthForm mode="signup" />
          <Link href="/" className="muted-link">
            Back to landing
          </Link>
        </div>
      </section>
    </main>
  );
}
