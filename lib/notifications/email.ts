import type { AlertRow } from "@/lib/local/management-repository";

export async function sendAlertEmail(
  alert: AlertRow,
  toEmail: string,
  fromEmail: string,
  apiKey: string,
): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const severityColor = alert.severity === "high" ? "#F78166" : alert.severity === "medium" ? "#D29922" : "#3FB950";
  const severityLabel = alert.severity.toUpperCase();

  await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `[Aegis] ${severityLabel} Alert: ${alert.title}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1117; color: #E6EDF3; padding: 32px; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 11px; height: 11px; border-radius: 3px; transform: rotate(45deg); background: conic-gradient(from 25deg, #4f74ff 0 34%, #7f67ff 34% 67%, #f37a4d 67% 100%);"></div>
          <span style="font-size: 18px; font-weight: 700; color: #E6EDF3;">Aegis</span>
        </div>
        <div style="border-left: 3px solid ${severityColor}; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #E6EDF3;">${alert.title}</h2>
          <span style="background: ${severityColor}22; color: ${severityColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${severityLabel}</span>
        </div>
        <p style="color: #8B949E; line-height: 1.6; margin-bottom: 24px;">${alert.message}</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr style="border-bottom: 1px solid #21262D;">
            <td style="padding: 8px 0; color: #6E7681; font-size: 12px;">Channel</td>
            <td style="padding: 8px 0; color: #E6EDF3; font-size: 12px;">${alert.channel}</td>
          </tr>
          ${alert.transaction_id ? `<tr style="border-bottom: 1px solid #21262D;"><td style="padding: 8px 0; color: #6E7681; font-size: 12px;">Transaction ID</td><td style="padding: 8px 0; color: #E6EDF3; font-size: 12px; font-family: monospace;">${alert.transaction_id}</td></tr>` : ""}
          ${alert.case_id ? `<tr style="border-bottom: 1px solid #21262D;"><td style="padding: 8px 0; color: #6E7681; font-size: 12px;">Case ID</td><td style="padding: 8px 0; color: #E6EDF3; font-size: 12px; font-family: monospace;">${alert.case_id}</td></tr>` : ""}
          <tr>
            <td style="padding: 8px 0; color: #6E7681; font-size: 12px;">Triggered at</td>
            <td style="padding: 8px 0; color: #E6EDF3; font-size: 12px;">${new Date().toISOString()}</td>
          </tr>
        </table>
        <p style="color: #484f58; font-size: 11px; margin: 0;">Sent by Aegis Fraud Detection Platform. Do not reply to this email.</p>
      </div>
    `,
  });
}
