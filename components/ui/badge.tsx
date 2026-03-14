import { cn } from "@/lib/utils";

export function Badge({ children, tone = "default" }: { children: string; tone?: "default" | "danger" | "warning" | "success" }) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}
