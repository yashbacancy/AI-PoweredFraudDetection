import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <p>Fraud defense, made adaptive.</p>
        <h1>Detect risk before it becomes loss.</h1>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Sign in to Aegis</h2>
          <p>Access your fraud operations workspace.</p>
          <AuthForm mode="login" />
          <Link href="/" className="muted-link">
            Back to landing
          </Link>
        </div>
      </section>
    </main>
  );
}
