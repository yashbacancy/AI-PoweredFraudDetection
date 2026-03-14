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

type RiskRuleItem = {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  operator: string;
  threshold: number | null;
  weight: number;
  is_active: boolean;
  updated_at: string;
};

type ModelItem = {
  id: string;
  model_key: string;
  version: string;
  status: "active" | "shadow" | "disabled";
  rollout_percent: number;
  review_threshold: number;
  block_threshold: number;
  updated_at: string;
};

type FormState = {
  name: string;
  description: string;
  rule_type: string;
  operator: string;
  threshold: string;
  weight: number;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  rule_type: "amount",
  operator: "gt",
  threshold: "",
  weight: 20,
  is_active: true,
};

const ruleTypes = ["amount", "velocity_1h", "velocity_24h", "geo", "device", "payment_method"];
const operators = ["gt", "gte", "lt", "lte", "eq", "neq", "in", "not_in"];

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

export function RiskRulesClient({
  initialRules,
  initialModels = [],
  compact = false,
}: {
  initialRules: RiskRuleItem[];
  initialModels?: ModelItem[];
  compact?: boolean;
}) {
  const [rules, setRules] = useState(initialRules);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RiskRuleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);
  const visibleRules = compact ? rules.slice(0, 8) : rules;

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Rule name is required.");
      return;
    }
    if (!Number.isFinite(form.weight) || form.weight < 1 || form.weight > 100) {
      toast.error("Weight must be between 1 and 100.");
      return;
    }

    const threshold = form.threshold.trim() ? Number(form.threshold) : null;
    if (threshold !== null && !Number.isFinite(threshold)) {
      toast.error("Threshold must be numeric.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      rule_type: form.rule_type,
      operator: form.operator,
      threshold,
      weight: Math.round(form.weight),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      const url = editing ? `/api/risk-rules/${editing.id}` : "/api/risk-rules";
      const method = editing ? "PATCH" : "POST";
      const data = await fetchJson<RiskRuleItem>(url, { method, body: JSON.stringify(payload) });
      setRules((prev) => (editing ? prev.map((rule) => (rule.id === data.id ? data : rule)) : [data, ...prev]));
      toast.success(editing ? "Risk rule updated." : "Risk rule created.");
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: RiskRuleItem) => {
    try {
      const data = await fetchJson<RiskRuleItem>(`/api/risk-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      setRules((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      toast.success(`Rule ${data.is_active ? "activated" : "deactivated"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toggle failed.");
    }
  };

  return (
    <div className="stack-24">
      <section className="content-card stat-inline">
        <p>
          Active rules: <strong>{activeCount}</strong>
        </p>
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus size={16} />
          Add rule
        </Button>
      </section>

      <section className="content-card overflow-x">
        <h3>{compact ? "Quick Rule Manager" : "Rules Engine"}</h3>
        {rules.length === 0 ? (
          <p style={{ marginTop: 8 }}>No rules found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                {!compact && <th>Description</th>}
                <th>Type</th>
                <th>Operator</th>
                <th>Threshold</th>
                <th>Weight</th>
                <th>Status</th>
                {!compact && <th>Updated</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  {!compact && <td>{rule.description ?? "n/a"}</td>}
                  <td>{rule.rule_type}</td>
                  <td>{rule.operator}</td>
                  <td>{rule.threshold ?? "n/a"}</td>
                  <td>{rule.weight}</td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => toggleRule(rule)}
                      title="Toggle active status"
                      style={{ width: "auto", padding: "0 8px" }}
                    >
                      {rule.is_active ? "active" : "inactive"}
                    </button>
                  </td>
                  {!compact && <td>{formatDate(rule.updated_at)}</td>}
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditing(rule);
                          setForm({
                            name: rule.name,
                            description: rule.description ?? "",
                            rule_type: rule.rule_type,
                            operator: rule.operator,
                            threshold: rule.threshold === null ? "" : String(rule.threshold),
                            weight: rule.weight,
                            is_active: rule.is_active,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <ConfirmDialog
                        title="Delete rule"
                        description="This action cannot be undone."
                        onConfirm={async () => {
                          try {
                            await fetchJson(`/api/risk-rules/${rule.id}`, { method: "DELETE" });
                            setRules((prev) => prev.filter((item) => item.id !== rule.id));
                            toast.success("Rule deleted.");
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

      {!compact && (
        <section className="content-card overflow-x">
          <h3>Model Threshold Profiles</h3>
          {initialModels.length === 0 ? (
            <p style={{ marginTop: 8 }}>No model registry entries found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Rollout</th>
                  <th>Review</th>
                  <th>Block</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {initialModels.map((model) => (
                  <tr key={model.id}>
                    <td>{model.model_key}</td>
                    <td>{model.version}</td>
                    <td>
                      <Badge
                        tone={
                          model.status === "active"
                            ? "success"
                            : model.status === "shadow"
                              ? "warning"
                              : "default"
                        }
                      >
                        {model.status}
                      </Badge>
                    </td>
                    <td>{model.rollout_percent}%</td>
                    <td>{model.review_threshold}</td>
                    <td>{model.block_threshold}</td>
                    <td>{formatDate(model.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit risk rule" : "Create risk rule"}
        description="Configure weighted checks for the fraud rules engine."
      >
        <div className="form-grid">
          <label className="field">
            Name
            <Input value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} />
          </label>

          <label className="field">
            Description
            <Input
              value={form.description}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
              placeholder="Optional"
            />
          </label>

          <label className="field">
            Rule type
            <select
              className="input"
              value={form.rule_type}
              onChange={(event) => setForm((state) => ({ ...state, rule_type: event.target.value }))}
            >
              {ruleTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Operator
            <select
              className="input"
              value={form.operator}
              onChange={(event) => setForm((state) => ({ ...state, operator: event.target.value }))}
            >
              {operators.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Threshold
            <Input
              type="number"
              value={form.threshold}
              onChange={(event) => setForm((state) => ({ ...state, threshold: event.target.value }))}
              placeholder="Optional"
            />
          </label>

          <label className="field">
            Weight (1-100)
            <Input
              type="number"
              min={1}
              max={100}
              value={String(form.weight)}
              onChange={(event) => setForm((state) => ({ ...state, weight: Number(event.target.value || 0) }))}
            />
          </label>

          <label className="field">
            Active
            <select
              className="input"
              value={form.is_active ? "true" : "false"}
              onChange={(event) =>
                setForm((state) => ({
                  ...state,
                  is_active: event.target.value === "true",
                }))
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
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
