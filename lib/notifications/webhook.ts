import { createHmac } from "crypto";
import type { AlertRow } from "@/lib/local/management-repository";

export async function postAlertWebhook(
  alert: AlertRow,
  endpointUrl: string,
  secret?: string | null,
): Promise<void> {
  const payload = JSON.stringify({
    event: "alert.triggered",
    alert,
    timestamp: new Date().toISOString(),
    source: "aegis",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Aegis-Event": "alert.triggered",
    "X-Aegis-Alert-Id": alert.id,
    "X-Aegis-Severity": alert.severity,
  };

  if (secret) {
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    headers["X-Aegis-Signature"] = `sha256=${sig}`;
  }

  const res = await fetch(endpointUrl, { method: "POST", headers, body: payload });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
  }
}
