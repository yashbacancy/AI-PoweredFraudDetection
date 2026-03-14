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
import type { FraudCase, Transaction } from "@/lib/types";

type FormState = {
  title: string;
  reason: string;
  status: FraudCase["status"];
  severity: FraudCase["severity"];
  assigned_to: string;
  transaction_id: string;
};

const emptyForm: FormState = {
  title: "",
  reason: "",
  status: "open",
  severity: "medium",
  assigned_to: "",
  transaction_id: "",
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

export function CasesClient({
  initialCases,
  transactions,
}: {
  initialCases: FraudCase[];
  transactions: Transaction[];
}) {
  const [items, setItems] = useState(initialCases);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FraudCase | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCount = useMemo(() => items.filter((item) => item.status !== "resolved").length, [items]);

  const save = async () => {
    if (!form.title || !form.reason) {
      toast.error("Please fill the title and reason");
      return;
    }

    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      transaction_id: form.transaction_id || null,
      resolution_notes: null,
    };

    setSaving(true);

    try {
      const url = editing ? `/api/cases/${editing.id}` : "/api/cases";
      const method = editing ? "PATCH" : "POST";
      const data = await fetchJson<FraudCase>(url, { method, body: JSON.stringify(payload) });
      setItems((prev) => (editing ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev]));

      toast.success(editing ? "Case updated" : "Case created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-24">
      <div className="content-card stat-inline">
        <p>
          Active investigations: <strong>{openCount}</strong>
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus size={16} />
          New case
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>No fraud cases yet</h3>
          <p>Create a case to begin analyst workflow.</p>
          <Button onClick={() => setOpen(true)}>Create case</Button>
        </div>
      ) : (
        <div className="content-card overflow-x">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    <Badge tone={item.severity === "high" ? "danger" : item.severity === "medium" ? "warning" : "default"}>
                      {item.severity}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={item.status === "resolved" ? "success" : "warning"}>{item.status}</Badge>
                  </td>
                  <td>{item.assigned_to ?? "Unassigned"}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            title: item.title,
                            reason: item.reason,
                            status: item.status,
                            severity: item.severity,
                            assigned_to: item.assigned_to ?? "",
                            transaction_id: item.transaction_id ?? "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>

                      <ConfirmDialog
                        title="Delete fraud case"
                        description="This action cannot be undone."
                        onConfirm={async () => {
                          try {
                            await fetchJson(`/api/cases/${item.id}`, { method: "DELETE" });
                            setItems((prev) => prev.filter((current) => current.id !== item.id));
                            toast.success("Case deleted");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Delete failed");
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
        </div>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit fraud case" : "Create fraud case"}
        description="Track investigations and analyst ownership."
      >
        <div className="form-grid">
          <label className="field">
            Title
            <Input value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} />
          </label>

          <label className="field">
            Reason
            <Input value={form.reason} onChange={(event) => setForm((state) => ({ ...state, reason: event.target.value }))} />
          </label>

          <label className="field">
            Severity
            <select
              className="input"
              value={form.severity}
              onChange={(event) =>
                setForm((state) => ({ ...state, severity: event.target.value as FraudCase["severity"] }))
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
              value={form.status}
              onChange={(event) =>
                setForm((state) => ({ ...state, status: event.target.value as FraudCase["status"] }))
              }
            >
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <label className="field">
            Assigned to
            <Input
              placeholder="analyst@aegis.com"
              value={form.assigned_to}
              onChange={(event) => setForm((state) => ({ ...state, assigned_to: event.target.value }))}
            />
          </label>

          <label className="field">
            Transaction
            <select
              className="input"
              value={form.transaction_id}
              onChange={(event) => setForm((state) => ({ ...state, transaction_id: event.target.value }))}
            >
              <option value="">No linked transaction</option>
              {transactions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.merchant_name} - ${Number(item.amount)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {editing ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
