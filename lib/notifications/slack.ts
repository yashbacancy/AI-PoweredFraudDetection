import type { AlertRow } from "@/lib/local/management-repository";

export async function sendSlackAlert(alert: AlertRow, webhookUrl: string): Promise<void> {
  const severityColor =
    alert.severity === "high" ? "#F78166" : alert.severity === "medium" ? "#D29922" : "#3FB950";
  const severityEmoji = alert.severity === "high" ? "🔴" : alert.severity === "medium" ? "🟡" : "🟢";

  const fields = [
    { type: "mrkdwn", text: `*Severity:*\n${severityEmoji} ${alert.severity.toUpperCase()}` },
    { type: "mrkdwn", text: `*Channel:*\n${alert.channel}` },
  ];
  if (alert.transaction_id) {
    fields.push({ type: "mrkdwn", text: `*Transaction:*\n\`${alert.transaction_id}\`` });
  }
  if (alert.case_id) {
    fields.push({ type: "mrkdwn", text: `*Case:*\n\`${alert.case_id}\`` });
  }

  const payload = {
    attachments: [
      {
        color: severityColor,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `Aegis Alert: ${alert.title}` },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: alert.message },
          },
          {
            type: "section",
            fields,
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Aegis Fraud Detection  ·  ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack delivery failed: ${res.status}`);
  }
}
