"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type AlertItem = {
  id: string;
  channel: "in_app" | "email" | "webhook" | "slack";
  severity: "low" | "medium" | "high";
  status: "new" | "sent" | "acknowledged" | "closed";
  title: string;
  message: string;
  created_at: string;
  updated_at: string;
  transaction_id: string | null;
  case_id: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
};

type IntegrationItem = {
  id: string;
  name: string;
  integration_type: "webhook" | "email" | "slack" | "siem";
  endpoint: string | null;
  status: "active" | "disabled" | "error";
  secret_ref: string | null;
  last_delivery_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type AlertForm = {
  title: string;
  message: string;
  channel: AlertItem["channel"];
  severity: AlertItem["severity"];
  status: AlertItem["status"];
  transaction_id: string;
  case_id: string;
};

type IntegrationForm = {
  name: string;
  integration_type: IntegrationItem["integration_type"];
  endpoint: string;
  status: IntegrationItem["status"];
  secret_ref: string;
  last_error: string;
};

const emptyAlertForm: AlertForm = {
  title: "",
  message: "",
  channel: "in_app",
  severity: "medium",
  status: "new",
  transaction_id: "",
  case_id: "",
};

const emptyIntegrationForm: IntegrationForm = {
  name: "",
  integration_type: "webhook",
  endpoint: "",
  status: "active",
  secret_ref: "",
  last_error: "",
};

async function fetchJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ message: "Request failed" }))) as { message?: string };
    throw new Error(payload.message ?? "Request failed");
  }
  return (await response.json()) as T;
}

export function AlertsHubClient({
  initialAlerts,
  initialIntegrations,
  compact = false,
}: {
  initialAlerts: AlertItem[];
  initialIntegrations: IntegrationItem[];
  compact?: boolean;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [integrations, setIntegrations] = useState(initialIntegrations);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertEditing, setAlertEditing] = useState<AlertItem | null>(null);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertForm, setAlertForm] = useState<AlertForm>(emptyAlertForm);

  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [integrationEditing, setIntegrationEditing] = useState<IntegrationItem | null>(null);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationForm, setIntegrationForm] = useState<IntegrationForm>(emptyIntegrationForm);

  const pendingAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "new" || alert.status === "sent" || alert.status === "acknowledged").length,
    [alerts],
  );

  const activeIntegrations = useMemo(
    () => integrations.filter((integration) => integration.status === "active").length,
    [integrations],
  );

  const visibleAlerts = compact ? alerts.slice(0, 10) : alerts;
  const visibleIntegrations = compact ? integrations.slice(0, 10) : integrations;

  const resetAlertForm = () => {
    setAlertEditing(null);
    setAlertForm(emptyAlertForm);
  };

  const resetIntegrationForm = () => {
    setIntegrationEditing(null);
    setIntegrationForm(emptyIntegrationForm);
  };

  const saveAlert = async () => {
    if (!alertForm.title.trim() || !alertForm.message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    setAlertSaving(true);
    try {
      const payload = {
        title: alertForm.title.trim(),
        message: alertForm.message.trim(),
        channel: alertForm.channel,
        severity: alertForm.severity,
        status: alertForm.status,
        transaction_id: alertForm.transaction_id.trim() || null,
        case_id: alertForm.case_id.trim() || null,
      };
      const url = alertEditing ? `/api/alerts/${alertEditing.id}` : "/api/alerts";
      const method = alertEditing ? "PATCH" : "POST";
      const data = await fetchJson<AlertItem>(url, { method, body: JSON.stringify(payload) });
      setAlerts((prev) => (alertEditing ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev]));
      toast.success(alertEditing ? "Alert updated." : "Alert created.");
      setAlertOpen(false);
      resetAlertForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed.");
    } finally {
      setAlertSaving(false);
    }
  };

  const saveIntegration = async () => {
    if (!integrationForm.name.trim()) {
      toast.error("Integration name is required.");
      return;
    }
    setIntegrationSaving(true);
    try {
      const payload = {
        name: integrationForm.name.trim(),
        integration_type: integrationForm.integration_type,
        endpoint: integrationForm.endpoint.trim() || null,
        status: integrationForm.status,
        secret_ref: integrationForm.secret_ref.trim() || null,
        last_error: integrationForm.last_error.trim() || null,
      };
      const url = integrationEditing ? `/api/integrations/${integrationEditing.id}` : "/api/integrations";
      const method = integrationEditing ? "PATCH" : "POST";
      const data = await fetchJson<IntegrationItem>(url, { method, body: JSON.stringify(payload) });
      setIntegrations((prev) =>
        integrationEditing ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev],
      );
      toast.success(integrationEditing ? "Integration updated." : "Integration created.");
      setIntegrationOpen(false);
      resetIntegrationForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed.");
    } finally {
      setIntegrationSaving(false);
    }
  };

  return (
    <div className="stack-24">
      <section className="stats-grid">
        <article className="content-card stat-card">
          <div className="stat-head">
            <span>Pending Alerts</span>
          </div>
          <h3>{pendingAlerts}</h3>
        </article>
        <article className="content-card stat-card">
          <div className="stat-head">
            <span>Active Integrations</span>
          </div>
          <h3>{activeIntegrations}</h3>
        </article>
      </section>

      <section className="content-card overflow-x">
        <div className="stat-inline" style={{ marginBottom: 10 }}>
          <h3>{compact ? "Quick Integration Manager" : "Integration Routing"}</h3>
          <Button
            onClick={() => {
              resetIntegrationForm();
              setIntegrationOpen(true);
            }}
          >
            <Plus size={16} />
            Add integration
          </Button>
        </div>
        {integrations.length === 0 ? (
          <p>No integration entries found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Endpoint</th>
                <th>Status</th>
                {!compact && <th>Last Delivery</th>}
                {!compact && <th>Last Error</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIntegrations.map((integration) => (
                <tr key={integration.id}>
                  <td>{integration.name}</td>
                  <td>{integration.integration_type}</td>
                  <td>{integration.endpoint ?? "n/a"}</td>
                  <td>
                    <Badge
                      tone={
                        integration.status === "active"
                          ? "success"
                          : integration.status === "error"
                            ? "danger"
                            : "default"
                      }
                    >
                      {integration.status}
                    </Badge>
                  </td>
                  {!compact && <td>{integration.last_delivery_at ? formatDate(integration.last_delivery_at) : "never"}</td>}
                  {!compact && <td>{integration.last_error ?? "none"}</td>}
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setIntegrationEditing(integration);
                          setIntegrationForm({
                            name: integration.name,
                            integration_type: integration.integration_type,
                            endpoint: integration.endpoint ?? "",
                            status: integration.status,
                            secret_ref: integration.secret_ref ?? "",
                            last_error: integration.last_error ?? "",
                          });
                          setIntegrationOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <ConfirmDialog
                        title="Delete integration"
                        description="This action cannot be undone."
                        onConfirm={async () => {
                          try {
                            await fetchJson(`/api/integrations/${integration.id}`, { method: "DELETE" });
                            setIntegrations((prev) => prev.filter((item) => item.id !== integration.id));
                            toast.success("Integration deleted.");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Delete failed.");
                          }
                        }}
                        trigger={
                          <button className="icon-btn">
                            <Trash2 size={14} />
                          </button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="content-card overflow-x">
        <div className="stat-inline" style={{ marginBottom: 10 }}>
          <h3>{compact ? "Quick Alert Manager" : "Alert Queue"}</h3>
          <Button
            onClick={() => {
              resetAlertForm();
              setAlertOpen(true);
            }}
          >
            <Plus size={16} />
            Add alert
          </Button>
        </div>
        {alerts.length === 0 ? (
          <p>No alerts found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Channel</th>
                <th>Severity</th>
                <th>Status</th>
                {!compact && <th>Transaction</th>}
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.title}</td>
                  <td>{alert.channel}</td>
                  <td>
                    <Badge
                      tone={
                        alert.severity === "high"
                          ? "danger"
                          : alert.severity === "medium"
                            ? "warning"
                            : "default"
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </td>
                  <td>{alert.status}</td>
                  {!compact && <td>{alert.transaction_id ?? "n/a"}</td>}
                  <td>{formatDate(alert.updated_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setAlertEditing(alert);
                          setAlertForm({
                            title: alert.title,
                            message: alert.message,
                            channel: alert.channel,
                            severity: alert.severity,
                            status: alert.status,
                            transaction_id: alert.transaction_id ?? "",
                            case_id: alert.case_id ?? "",
                          });
                          setAlertOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <ConfirmDialog
                        title="Delete alert"
                        description="This action cannot be undone."
                        onConfirm={async () => {
                          try {
                            await fetchJson(`/api/alerts/${alert.id}`, { method: "DELETE" });
                            setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
                            toast.success("Alert deleted.");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Delete failed.");
                          }
                        }}
                        trigger={
                          <button className="icon-btn">
                            <Trash2 size={14} />
                          </button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={integrationOpen}
        onOpenChange={setIntegrationOpen}
        title={integrationEditing ? "Edit integration" : "Create integration"}
        description="Configure channel routing for alerts and notifications."
      >
        <div className="form-grid">
          <label className="field">
            Name
            <Input
              value={integrationForm.name}
              onChange={(event) => setIntegrationForm((state) => ({ ...state, name: event.target.value }))}
            />
          </label>

          <label className="field">
            Type
            <select
              className="input"
              value={integrationForm.integration_type}
              onChange={(event) =>
                setIntegrationForm((state) => ({
                  ...state,
                  integration_type: event.target.value as IntegrationForm["integration_type"],
                }))
              }
            >
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="siem">SIEM</option>
            </select>
          </label>

          <label className="field">
            Endpoint
            <Input
              value={integrationForm.endpoint}
              placeholder="Optional"
              onChange={(event) => setIntegrationForm((state) => ({ ...state, endpoint: event.target.value }))}
            />
          </label>

          <label className="field">
            Status
            <select
              className="input"
              value={integrationForm.status}
              onChange={(event) =>
                setIntegrationForm((state) => ({
                  ...state,
                  status: event.target.value as IntegrationForm["status"],
                }))
              }
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="error">Error</option>
            </select>
          </label>

          <label className="field">
            Secret ref
            <Input
              value={integrationForm.secret_ref}
              placeholder="vault://..."
              onChange={(event) => setIntegrationForm((state) => ({ ...state, secret_ref: event.target.value }))}
            />
          </label>

          <label className="field">
            Last error
            <Input
              value={integrationForm.last_error}
              placeholder="Optional"
              onChange={(event) => setIntegrationForm((state) => ({ ...state, last_error: event.target.value }))}
            />
          </label>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIntegrationOpen(false)}>
            Cancel
          </Button>
          <Button loading={integrationSaving} onClick={saveIntegration}>
            {integrationEditing ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={alertOpen}
        onOpenChange={setAlertOpen}
        title={alertEditing ? "Edit alert" : "Create alert"}
        description="Manage lifecycle of fraud alerts and escalation channels."
      >
        <div className="form-grid">
          <label className="field">
            Title
            <Input value={alertForm.title} onChange={(event) => setAlertForm((state) => ({ ...state, title: event.target.value }))} />
          </label>

          <label className="field">
            Message
            <Input
              value={alertForm.message}
              onChange={(event) => setAlertForm((state) => ({ ...state, message: event.target.value }))}
            />
          </label>

          <label className="field">
            Channel
            <select
              className="input"
              value={alertForm.channel}
              onChange={(event) =>
                setAlertForm((state) => ({
                  ...state,
                  channel: event.target.value as AlertForm["channel"],
                }))
              }
            >
              <option value="in_app">In App</option>
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
            </select>
          </label>

          <label className="field">
            Severity
            <select
              className="input"
              value={alertForm.severity}
              onChange={(event) =>
                setAlertForm((state) => ({
                  ...state,
                  severity: event.target.value as AlertForm["severity"],
                }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="field">
            Status
            <select
              className="input"
              value={alertForm.status}
              onChange={(event) =>
                setAlertForm((state) => ({
                  ...state,
                  status: event.target.value as AlertForm["status"],
                }))
              }
            >
              <option value="new">New</option>
              <option value="sent">Sent</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          <label className="field">
            Transaction ID
            <Input
              value={alertForm.transaction_id}
              placeholder="Optional UUID"
              onChange={(event) => setAlertForm((state) => ({ ...state, transaction_id: event.target.value }))}
            />
          </label>

          <label className="field">
            Case ID
            <Input
              value={alertForm.case_id}
              placeholder="Optional UUID"
              onChange={(event) => setAlertForm((state) => ({ ...state, case_id: event.target.value }))}
            />
          </label>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setAlertOpen(false)}>
            Cancel
          </Button>
          <Button loading={alertSaving} onClick={saveAlert}>
            {alertEditing ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
