"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  AlertTriangle,
  BellRing,
  BrainCircuit,
  FileCheck,
  Home,
  ListFilter,
  LogOut,
  Network,
  SlidersHorizontal,
  UserCircle2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { IS_LOCAL_DB_MODE_CLIENT } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const navGroups = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard", href: "/app/dashboard", icon: Home },
      { label: "Transactions", href: "/app/transactions", icon: Activity },
      { label: "Fraud Cases", href: "/app/cases", icon: AlertTriangle },
    ],
  },
  {
    label: "Risk Controls",
    items: [
      { label: "Risk Rules", href: "/app/risk-rules", icon: SlidersHorizontal },
      { label: "Watchlists", href: "/app/watchlists", icon: ListFilter },
      { label: "Model Ops", href: "/app/model-ops", icon: BrainCircuit },
      { label: "Alerts Hub", href: "/app/alerts-hub", icon: BellRing },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Compliance", href: "/app/compliance", icon: FileCheck },
      { label: "Graph", href: "/app/graph", icon: Network },
      { label: "Customer Risk", href: "/app/customer-risk", icon: UsersRound },
    ],
  },
];

export function AppSidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-main">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span>Aegis</span>
        </div>
        {navGroups.map((group) => (
          <nav key={group.label} className="nav-list">
            <p className="nav-section-title">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ))}
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="user-chip">
          <Avatar.Root className="avatar">
            <Avatar.Fallback>
              {(profile?.first_name?.[0] ?? "L").toUpperCase()}
            </Avatar.Fallback>
          </Avatar.Root>
          <div>
            <p>{profile?.first_name ?? "Local"}</p>
            <span>{profile?.email ?? "local@aegis.dev"}</span>
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="dropdown-content" sideOffset={8} align="start">
            <DropdownMenu.Item className="dropdown-item" onSelect={() => router.push("/app/dashboard")}> 
              <UserCircle2 size={14} />
              Profile
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="dropdown-item"
              onSelect={async () => {
                if (IS_LOCAL_DB_MODE_CLIENT) {
                  toast.success("Local mode: no auth session to sign out.");
                  router.push("/login");
                  return;
                }

                const supabase = createClient();
                const { error } = await supabase.auth.signOut();
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("Signed out");
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={14} />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </aside>
  );
}
