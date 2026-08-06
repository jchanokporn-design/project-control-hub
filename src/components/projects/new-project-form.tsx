"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectType } from "@/lib/supabase/types";

interface TemplateOption {
  id: string;
  name: string;
  type: string;
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
  templates,
  users,
}: {
  templates: TemplateOption[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("it");
  const [pmId, setPmId] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetPlanned, setBudgetPlanned] = useState("");
  const [templateId, setTemplateId] = useState("");
  // Construction-only extra fields, stored in custom_fields (jsonb)
  const [site, setSite] = useState("");
  const [contractor, setContractor] = useState("");
  const [contractValue, setContractValue] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredTemplates = templates.filter((t) => t.type === type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const customFields =
      type === "construction"
        ? { site, contractor, contract_value: contractValue ? Number(contractValue) : null }
        : {};

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        name,
        type,
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
              value={type}
              onChange={(e) => {
                setType(e.target.value as ProjectType);
                setTemplateId("");
              }}
            >
              <option value="it">IT</option>
              <option value="construction">Construction</option>
            </select>
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
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
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

          {type === "construction" && (
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

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "กำลังสร้าง..." : "สร้าง Project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
