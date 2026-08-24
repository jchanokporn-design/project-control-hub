"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface TypeOption {
  id: string;
  name: string;
  code_prefix: string;
}
interface TemplateOption {
  id: string;
  name: string;
  type_id: string;
}
interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface DefaultTask {
  name: string;
  offset_days_start: number;
  offset_days_due: number;
  is_milestone?: boolean;
}

export function NewProjectForm({
  types,
  templates,
  users,
  userTypeMap,
}: {
  types: TypeOption[];
  templates: TemplateOption[];
  users: UserOption[];
  userTypeMap: Record<string, string[]>; // userId -> type_id[]
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [pmId, setPmId] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetPlanned, setBudgetPlanned] = useState("");
  const [templateId, setTemplateId] = useState("");
  // Construction-only extra fields, stored in custom_fields (jsonb).
  // Still matched by Type *name* — a full custom-field-builder per Type
  // is a separate, larger piece of work we agreed to defer.
  const [site, setSite] = useState("");
  const [contractor, setContractor] = useState("");
  const [contractValue, setContractValue] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);
  const isConstruction = selectedType?.name.toLowerCase() === "construction";

  const filteredTemplates = templates.filter((t) => t.type_id === typeId);

  // Show users tagged with the selected Type, plus anyone with no Type
  // assigned yet at all — so nobody just disappears from the list before
  // everyone's been tagged. See migration 0007 for the schema.
  const pmCandidates = users.filter((u) => {
    const userTypeIds = userTypeMap[u.id];
    if (!userTypeIds || userTypeIds.length === 0) return true;
    return userTypeIds.includes(typeId);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const customFields = isConstruction
      ? { site, contractor, contract_value: contractValue ? Number(contractValue) : null }
      : {};

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        name,
        type_id: typeId,
        pm_id: pmId || null,
        sponsor: sponsor || null,
        start_date: startDate || null,
        end_date: endDate || null,
        budget_planned: budgetPlanned ? Number(budgetPlanned) : 0,
        template_id: templateId || null,
        custom_fields: customFields,
      })
      .select()
      .single();

    if (insertError || !project) {
      setError(insertError?.message ?? "สร้าง Project ไม่สำเร็จ");
      setLoading(false);
      return;
    }

    // Add the PM as a project member so RLS + "pm can edit any task" rules apply.
    if (pmId) {
      await supabase
        .from("project_members")
        .insert({ project_id: project.id, user_id: pmId, role_in_project: "pm" });
    }

    // Generate starting tasks from the chosen template, offset from start_date.
    if (templateId && startDate) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        const { data: fullTemplate } = await supabase
          .from("project_templates")
          .select("default_tasks")
          .eq("id", templateId)
          .single();

        const defaultTasks = (fullTemplate?.default_tasks ?? []) as unknown as DefaultTask[];
        if (defaultTasks.length > 0) {
          const base = new Date(startDate);
          const addDays = (days: number) => {
            const d = new Date(base);
            d.setDate(d.getDate() + days);
            return d.toISOString().slice(0, 10);
          };

          const rows = defaultTasks.map((t) => ({
            project_id: project.id,
            name: t.name,
            start_date: addDays(t.offset_days_start),
            due_date: addDays(t.offset_days_due),
            is_milestone: t.is_milestone ?? false,
          }));
          await supabase.from("tasks").insert(rows);
        }
      }
    }

    setLoading(false);
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value);
                setTemplateId("");
                setPmId("");
              }}
            >
              {types.length === 0 && <option value="">-- ยังไม่มี Type ให้เลือก --</option>}
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {types.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                ยังไม่มี Type ในระบบ — ไปเพิ่มที่ Admin → Types ก่อนสร้างโครงการ
              </p>
            )}
          </div>

          {filteredTemplates.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Template (จะสร้าง Task เริ่มต้นให้อัตโนมัติ)
              </label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">-- ไม่ใช้ Template --</option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project Manager</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={pmId}
              onChange={(e) => setPmId(e.target.value)}
            >
              <option value="">-- เลือก PM --</option>
              {pmCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              แสดงเฉพาะผู้ใช้ที่ผูก Type &ldquo;{selectedType?.name ?? "-"}&rdquo; ไว้ (หรือยังไม่ได้ผูก Type ใดเลย) —
              จัดการได้ที่ Admin → Users
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sponsor</label>
            <Input value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Budget Planned</label>
            <Input
              type="number"
              min="0"
              value={budgetPlanned}
              onChange={(e) => setBudgetPlanned(e.target.value)}
            />
          </div>

          {isConstruction && (
            <div className="rounded-md border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Construction-specific fields</p>
              <div className="flex flex-col gap-2">
                <Input placeholder="Site" value={site} onChange={(e) => setSite(e.target.value)} />
                <Input
                  placeholder="Contractor"
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Contract Value"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading || types.length === 0} className="mt-2">
            {loading ? "กำลังสร้าง..." : "สร้าง Project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
