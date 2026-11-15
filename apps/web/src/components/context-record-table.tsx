"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Database,
  FileCheck2,
  FlaskConical,
  ShieldCheck,
  CircleHelp,
  Clock3,
  XCircle,
} from "lucide-react";

import type { ContextRecord, ContextType } from "@/lib/context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const typeMeta: Record<ContextType, { label: string; icon: typeof Database }> =
  {
    decision: { label: "Decision", icon: Database },
    requirement: { label: "Requirement", icon: FileCheck2 },
    constraint: { label: "Constraint", icon: ShieldCheck },
    research: { label: "Research", icon: FlaskConical },
    "rejected-approach": { label: "Rejected approach", icon: XCircle },
    "open-question": { label: "Open question", icon: CircleHelp },
    "project-state": { label: "Project state", icon: Clock3 },
  };

const typeColors: Record<ContextType, string> = {
  decision:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300",
  requirement:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  constraint:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  research:
    "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300",
  "rejected-approach":
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  "open-question":
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  "project-state":
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

function formatDate(value: string) {
  if (!value) return "Recently updated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function TypeBadge({ type }: { type: ContextType }) {
  const { label, icon: Icon } = typeMeta[type];
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-medium ${typeColors[type]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function DetailGroup({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 ${className}`}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {title}
      </h3>
      <div className="text-[15px] leading-7 text-stone-800">{children}</div>
    </section>
  );
}

const CONTENT_LABELS: Record<ContextType, Array<[string, string, boolean?]>> = {
  decision: [
    ["Problem and context", "problem"],
    ["Decision drivers", "drivers", true],
    ["Outcome", "outcome"],
    ["Why this option", "rationale"],
    ["Relevant constraints", "constraints", true],
    ["Options and trade-offs", "alternatives", true],
    ["Consequences", "consequences", true],
    ["When to revisit", "revisitWhen"],
  ],
  requirement: [
    ["Requirement", "statement"],
    ["Why it is needed", "rationale"],
    ["Source or originating need", "origin"],
    ["How to verify it", "acceptanceCriteria", true],
    ["Priority", "priority"],
  ],
  constraint: [
    ["Constraint", "statement"],
    ["Where it applies", "scope"],
    ["Source", "source"],
    ["Why it exists", "rationale"],
    ["Impact", "impact"],
    ["How to check it", "verificationCriteria", true],
  ],
  research: [
    ["Research question", "question"],
    ["Scope", "scope"],
    ["Method", "method"],
    ["Findings", "findings", true],
    ["Confidence", "confidence"],
    ["Limitations", "limitations", true],
    ["Project implications", "implications", true],
    ["Recommendation", "recommendation"],
  ],
  "rejected-approach": [
    ["Rejected approach", "approach"],
    ["Context", "context"],
    ["Why it was rejected", "reasonRejected"],
    ["Evidence or trade-offs", "evidence", true],
    ["Chosen alternative", "chosenAlternative"],
    ["When to reconsider", "reconsiderIf"],
  ],
  "open-question": [
    ["Unresolved question", "question"],
    ["Why it matters", "whyItMatters"],
    ["Known facts", "knownFacts", true],
    ["What remains unknown", "unknowns", true],
    ["Options discussed", "optionsDiscussed", true],
    ["Next step", "nextStep"],
    ["Target date", "targetDate"],
  ],
  "project-state": [
    ["As of", "asOf"],
    ["Project health", "health"],
    ["Current status", "summary"],
    ["Completed", "completed", true],
    ["In progress", "inProgress", true],
    ["Blockers", "blockers", true],
    ["Risks", "risks", true],
    ["Next steps", "nextSteps", true],
    ["Decisions needed", "decisionsNeeded", true],
  ],
};

function typeName(type: ContextType) {
  return typeMeta[type].label.toLocaleLowerCase();
}

function contextSections(
  record: ContextRecord,
): Array<[string, string | string[]]> {
  const legacyContent: Record<string, string | string[]> = {};
  if (!record.content) {
    switch (record.type) {
      case "decision":
        Object.assign(legacyContent, {
          problem: record.question,
          outcome: record.summary,
          rationale: record.rationale,
          constraints: record.constraints,
          alternatives: record.alternatives,
        });
        break;
      case "requirement":
        Object.assign(legacyContent, {
          statement: record.summary || record.question,
          rationale: record.rationale,
        });
        break;
      case "constraint":
        Object.assign(legacyContent, {
          statement: record.summary || record.question,
          rationale: record.rationale,
          scope: record.discussionSummary,
        });
        break;
      case "research":
        Object.assign(legacyContent, {
          question: record.question,
          findings: record.summary ? [record.summary] : [],
          method: record.discussionSummary,
        });
        break;
      case "rejected-approach":
        Object.assign(legacyContent, {
          approach: record.summary,
          context: record.question,
          reasonRejected: record.rationale,
        });
        break;
      case "open-question":
        Object.assign(legacyContent, {
          question: record.question,
          whyItMatters: record.rationale,
          knownFacts: record.summary ? [record.summary] : [],
          optionsDiscussed: record.alternatives,
        });
        break;
      case "project-state":
        Object.assign(legacyContent, {
          health: "unknown",
          summary: record.summary,
          blockers: record.constraints,
          nextSteps: record.alternatives,
        });
        break;
    }
  }
  const content = record.content ?? legacyContent;
  const sections: Array<[string, string | string[]]> = [];
  for (const [label, key] of CONTENT_LABELS[record.type]) {
    const value = content[key];
    if (Array.isArray(value)) {
      const items = value.map((item) => item.trim()).filter(Boolean);
      if (items.length) sections.push([label, items]);
      continue;
    }
    const text = typeof value === "string" ? value.trim() : "";
    if (text) sections.push([label, text]);
  }
  return sections;
}

export function ContextRecordTable({ records }: { records: ContextRecord[] }) {
  const [selected, setSelected] = useState<ContextRecord | null>(null);

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_14px_38px_-34px_rgba(28,25,23,0.38)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Context</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length > 0 ? (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left font-medium text-foreground"
                        onClick={() => setSelected(record)}
                      >
                        {record.title}
                      </Button>
                      <p className="mt-1 line-clamp-1 max-w-lg text-xs text-muted-foreground">
                        {record.summary}
                      </p>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={record.type} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                        <Check className="size-3.5" aria-hidden="true" />{" "}
                        Approved
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {record.tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="font-normal"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(record.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    No context records match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <SheetHeader className="shrink-0 gap-2 border-b border-stone-200 bg-gradient-to-r from-white to-stone-50 px-5 pb-5 pt-6">
              <div className="flex items-center justify-between gap-3 pr-8">
                <TypeBadge type={selected.type} />
                <Badge
                  variant="outline"
                  className="gap-1.5 font-normal text-emerald-700"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Approved
                </Badge>
              </div>
              <SheetTitle className="pt-1 pr-8 text-left text-2xl leading-tight tracking-tight">
                {selected.title}
              </SheetTitle>
              <SheetDescription className="text-left">
                Approved context · {typeName(selected.type)}
              </SheetDescription>
            </SheetHeader>
            <div className="context-detail-scroll min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
              {contextSections(selected).map(([title, value]) => (
                <DetailGroup
                  key={title}
                  title={title}
                  className={
                    title === "Outcome"
                      ? "rounded-xl border border-violet-200/80 bg-violet-50/60 p-4"
                      : undefined
                  }
                >
                  {Array.isArray(value) ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {value.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className={
                        title === "Outcome"
                          ? "font-medium text-stone-950"
                          : undefined
                      }
                    >
                      {value}
                    </p>
                  )}
                </DetailGroup>
              ))}
              {selected.schemaVersion !== 2 && selected.discussionSummary && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    Discussion trail
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    {selected.discussionSummary}
                  </p>
                </div>
              )}
              {selected.sourceReferences.length > 0 && (
                <DetailGroup title="Source notes">
                  <ul className="space-y-2">
                    {selected.sourceReferences.map((source) => (
                      <li
                        key={source}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <ArrowUpRight
                          className="mt-1 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {source}
                      </li>
                    ))}
                  </ul>
                </DetailGroup>
              )}
              <p className="border-t border-stone-200 pt-4 text-xs text-stone-500">
                Added by {selected.owner} · {formatDate(selected.updatedAt)}
              </p>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
