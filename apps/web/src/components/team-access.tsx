"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const API =
  process.env.NEXT_PUBLIC_CONTEXTOPS_API_URL ?? "http://localhost:4000/api";

type Role = "owner" | "reviewer" | "contributor";
type Member = {
  id: string;
  login: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
};

export function TeamAccess() {
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<Role>("contributor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/projects/team`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          role?: Role;
          members?: Member[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(body.message ?? "Could not load project members.");
        setRole(body.role ?? "contributor");
        setMembers(body.members ?? []);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load project members.",
        ),
      );
  }, []);

  async function createInvite() {
    setBusy(true);
    setError("");
    setInviteUrl("");
    try {
      const response = await fetch(`${API}/projects/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "contributor" }),
      });
      const body = (await response.json()) as {
        inviteUrl?: string;
        message?: string;
      };
      if (!response.ok || !body.inviteUrl)
        throw new Error(body.message ?? "Could not create an invitation.");
      setInviteUrl(body.inviteUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create an invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section
      aria-labelledby="team-heading"
      className="border-t border-stone-200 pt-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-800">
          <Users className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id="team-heading"
                className="text-sm font-semibold text-stone-950"
              >
                Project team
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">
                Contributors can use MCP to read approved context and submit
                drafts. Owners and reviewers approve what is published.
              </p>
            </div>
            {role === "owner" && (
              <Button size="sm" disabled={busy} onClick={createInvite}>
                <UserPlus className="mr-1 size-3.5" aria-hidden="true" />
                {busy ? "Creating…" : "Invite contributor"}
              </Button>
            )}
          </div>

          {inviteUrl && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-medium text-violet-950">
                Share this one-time link. It expires in seven days.
              </p>
              <div className="mt-2 flex gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-stone-700 ring-1 ring-violet-100">
                  {inviteUrl}
                </code>
                <Button size="sm" variant="outline" onClick={copyInvite}>
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs text-rose-700">
              {error}
            </p>
          )}

          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-700">
                    {member.login.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-medium text-stone-900">
                    @{member.login}
                  </span>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] capitalize text-stone-600">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
