import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/sidebar";
import { getLocalProfile } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (IS_LOCAL_DB_MODE) {
    const profile = await getLocalProfile();

    return (
      <div className="app-shell">
        <AppSidebar profile={profile} />
        <div className="app-main">{children}</div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return (
    <div className="app-shell">
      <AppSidebar profile={profile} />
      <div className="app-main">{children}</div>
    </div>
  );
}
