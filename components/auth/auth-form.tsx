"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IS_LOCAL_DB_MODE_CLIENT } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isSignup = mode === "signup";

  return (
    <form
      className="auth-form"
      onSubmit={async (event) => {
        event.preventDefault();

        if (IS_LOCAL_DB_MODE_CLIENT) {
          toast.success("Local mode active. Opening dashboard.");
          router.push("/app/dashboard");
          return;
        }

        if (!email.includes("@")) {
          toast.error("Please enter a valid email");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }

        const supabase = createClient();
        setLoading(true);

        if (isSignup) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: firstName,
              },
            },
          });
          setLoading(false);
          if (error) {
            toast.error(error.message);
            return;
          }

          toast.success("Account created. You can now sign in.");
          router.push("/login");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) {
          toast.error(error.message);
          return;
        }

        toast.success("Welcome back");
        router.push("/app/dashboard");
        router.refresh();
      }}
    >
      {isSignup ? (
        <label className="field">
          First name
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} required={!IS_LOCAL_DB_MODE_CLIENT} />
        </label>
      ) : null}

      <label className="field">
        Email
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required={!IS_LOCAL_DB_MODE_CLIENT}
          placeholder="you@company.com"
        />
      </label>

      <label className="field">
        Password
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required={!IS_LOCAL_DB_MODE_CLIENT}
          minLength={8}
          placeholder="Minimum 8 characters"
        />
      </label>

      <Button type="submit" loading={loading}>
        {IS_LOCAL_DB_MODE_CLIENT ? "Continue in local mode" : isSignup ? "Create account" : "Sign in"}
      </Button>

      <Button
        type="button"
        variant="secondary"
        disabled={IS_LOCAL_DB_MODE_CLIENT}
        onClick={async () => {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) {
            toast.error(error.message);
          }
        }}
      >
        Continue with Google
      </Button>

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to Aegis?"}
        <Link href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Sign in" : "Create account"}
          <ArrowRight size={14} />
        </Link>
      </p>
    </form>
  );
}
