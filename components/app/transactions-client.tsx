"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

type FormState = {
  merchant_name: string;
  amount: number;
  payment_method: string;
  ip_address: string;
  country: string;
  device_id: string;
  channel: "web" | "mobile_app" | "api" | "pos" | "call_center";
  typing_cadence_ms: string;
  pointer_velocity: string;
  touch_pressure: string;
  scroll_speed: string;
};

const emptyForm: FormState = {
  merchant_name: "",
  amount: 0,
  payment_method: "card",
  ip_address: "",
  country: "US",
  device_id: "",
  channel: "web",
  typing_cadence_ms: "",
  pointer_velocity: "",
  touch_pressure: "",
  scroll_speed: "",
};

function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

export function TransactionsClient({ initialData }: { initialData: Transaction[] }) {
  const [items, setItems] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const totalProtected = useMemo(() => items.reduce((sum, tx) => sum + Number(tx.amount), 0), [items]);

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.merchant_name || !form.ip_address || !form.device_id) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    const behavioral_biometrics = {
      typing_cadence_ms: toOptionalNumber(form.typing_cadence_ms),
      pointer_velocity: toOptionalNumber(form.pointer_velocity),
      touch_pressure: toOptionalNumber(form.touch_pressure),
      scroll_speed: toOptionalNumber(form.scroll_speed),
    };
    const hasBiometrics = Object.values(behavioral_biometrics).some((value) => value !== undefined);
    const localPayload = {
      merchant_name: form.merchant_name,
      amount: form.amount,
      payment_method: form.payment_method,
      ip_address: form.ip_address,
      country: form.country,
      device_id: form.device_id,
      channel: form.channel,
      behavioral_biometrics: hasBiometrics ? behavioral_biometrics : null,
    };

    setSaving(true);

    try {
      const url = editing ? `/api/transactions/${editing.id}` : "/api/transactions";
      const method = editing ? "PATCH" : "POST";
      const data = await fetchJson<Transaction>(url, { method, body: JSON.stringify(localPayload) });
      setItems((prev) => (editing ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev]));

      toast.success(editing ? "Transaction updated" : "Transaction created");
      setOpen(false);
      reset();
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
          Total monitored volume: <strong>{currency(totalProtected)}</strong>
        </p>
        <Button
          onClick={() => {
            setOpen(true);
            reset();
          }}
        >
          <Plus size={16} />
          Add transaction
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>No transactions yet</h3>
          <p>Create your first transaction to start risk scoring.</p>
          <Button onClick={() => setOpen(true)}>Create transaction</Button>
        </div>
      ) : (
        <div className="content-card overflow-x">
          <table className="table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Country</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/app/transactions/${item.id}`} className="txn-link">
                      {item.merchant_name}
                    </Link>
                  </td>
                  <td>{currency(Number(item.amount))}</td>
                  <td>{item.risk_score}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === "blocked"
                          ? "danger"
                          : item.status === "review"
                            ? "warning"
                            : "success"
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>{item.country}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            merchant_name: item.merchant_name,
                            amount: Number(item.amount),
                            payment_method: item.payment_method,
                            ip_address: item.ip_address,
                            country: item.country,
                            device_id: item.device_id,
                            channel: "web",
                            typing_cadence_ms: "",
                            pointer_velocity: "",
                            touch_pressure: "",
                            scroll_speed: "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>

                      <ConfirmDialog
                        title="Delete transaction"
                        description="This action cannot be undone."
                        onConfirm={async () => {
                          try {
                            await fetchJson(`/api/transactions/${item.id}`, { method: "DELETE" });
                            setItems((prev) => prev.filter((tx) => tx.id !== item.id));
                            toast.success("Transaction deleted");
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
        title={editing ? "Edit transaction" : "Create transaction"}
        description="Risk score and decision are computed automatically."
      >
        <div className="form-grid">
          <label className="field">
            Merchant name
            <Input
              value={form.merchant_name}
              onChange={(event) => setForm((state) => ({ ...state, merchant_name: event.target.value }))}
            />
          </label>
          <label className="field">
            Amount
            <Input
              type="number"
              min={1}
              value={String(form.amount)}
              onChange={(event) =>
                setForm((state) => ({
                  ...state,
                  amount: Number(event.target.value || 0),
                }))
              }
            />
          </label>
          <label className="field">
            Payment method
            <Input
              value={form.payment_method}
              onChange={(event) => setForm((state) => ({ ...state, payment_method: event.target.value }))}
              placeholder="card, ach, wallet"
            />
          </label>
          <label className="field">
            IP address
            <Input
              value={form.ip_address}
              onChange={(event) => setForm((state) => ({ ...state, ip_address: event.target.value }))}
            />
          </label>
          <label className="field">
            Country code
            <Input
              value={form.country}
              onChange={(event) => setForm((state) => ({ ...state, country: event.target.value.toUpperCase() }))}
              maxLength={2}
            />
          </label>
          <label className="field">
            Device id
            <Input
              value={form.device_id}
              onChange={(event) => setForm((state) => ({ ...state, device_id: event.target.value }))}
            />
          </label>
          <label className="field">
            Channel
            <select
              className="input"
              value={form.channel}
              onChange={(event) =>
                setForm((state) => ({
                  ...state,
                  channel: event.target.value as FormState["channel"],
                }))
              }
            >
              <option value="web">Web</option>
              <option value="mobile_app">Mobile App</option>
              <option value="api">API</option>
              <option value="pos">POS</option>
              <option value="call_center">Call Center</option>
            </select>
          </label>
          <label className="field">
            Typing cadence (ms)
            <Input
              type="number"
              min={0}
              value={form.typing_cadence_ms}
              onChange={(event) => setForm((state) => ({ ...state, typing_cadence_ms: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Pointer velocity
            <Input
              type="number"
              min={0}
              value={form.pointer_velocity}
              onChange={(event) => setForm((state) => ({ ...state, pointer_velocity: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Touch pressure
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.touch_pressure}
              onChange={(event) => setForm((state) => ({ ...state, touch_pressure: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Scroll speed
            <Input
              type="number"
              min={0}
              value={form.scroll_speed}
              onChange={(event) => setForm((state) => ({ ...state, scroll_speed: event.target.value }))}
              placeholder="Optional"
            />
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
