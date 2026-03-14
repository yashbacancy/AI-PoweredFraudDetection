import type { AlertRow, ApiIntegrationRow } from "@/lib/local/management-repository";
import { sendAlertEmail } from "./email";
import { postAlertWebhook } from "./webhook";
import { sendSlackAlert } from "./slack";

const CHANNEL_TO_TYPES: Record<AlertRow["channel"], ApiIntegrationRow["integration_type"][]> = {
  email: ["email"],
  webhook: ["webhook", "siem"],
  slack: ["slack"],
  in_app: [],
};

export async function dispatchAlert(
  alert: AlertRow,
  integrations: ApiIntegrationRow[],
): Promise<void> {
  const matchedTypes = CHANNEL_TO_TYPES[alert.channel] ?? [];
  if (matchedTypes.length === 0) return;

  const targets = integrations.filter(
    (i) => i.status === "active" && matchedTypes.includes(i.integration_type) && i.endpoint,
  );

  const tasks = targets.map(async (integration) => {
    try {
      if (integration.integration_type === "email") {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.ALERT_EMAIL_FROM ?? "alerts@aegis.dev";
        if (!apiKey) {
          console.warn("[dispatch] RESEND_API_KEY not set — skipping email delivery");
          return;
        }
        await sendAlertEmail(alert, integration.endpoint!, from, apiKey);
      } else if (
        integration.integration_type === "webhook" ||
        integration.integration_type === "siem"
      ) {
        await postAlertWebhook(alert, integration.endpoint!, integration.secret_ref);
      } else if (integration.integration_type === "slack") {
        await sendSlackAlert(alert, integration.endpoint!);
      }
    } catch (err) {
      console.error(
        `[dispatch] Failed to deliver alert ${alert.id} via ${integration.integration_type} (${integration.id}):`,
        err,
      );
    }
  });

  await Promise.allSettled(tasks);
}
