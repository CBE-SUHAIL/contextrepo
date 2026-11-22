"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  GitBranch,
  LoaderCircle,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const API =
  process.env.NEXT_PUBLIC_CONTEXTOPS_API_URL ?? "http://localhost:4000/api";

type Role = "owner" | "reviewer" | "contributor";
type RepositoryAccess =
  "owner" | "not_granted" | "pending" | "active" | "external";
type Member = {
  id: string;
  login: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
  repositoryAccess: RepositoryAccess;
  repositoryAccessRequestedAt: string | null;
};

export function TeamAccess() {
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<Role>("contributor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [repositoryBusy, setRepositoryBusy] = useState<string | null>(null);

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

  async function updateRepositoryAccess(member: Member) {
    const enabled = member.repositoryAccess === "not_granted";
    const confirmed = window.confirm(
      enabled
        ? `Send @${member.login} a GitHub invitation with normal write access to the connected repository? They must accept it in GitHub.`
        : `Remove the repository access that ContextOps granted to @${member.login}? Their ContextOps membership and MCP access will remain.`,
    );
    if (!confirmed) return;

    setRepositoryBusy(member.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API}/projects/team/${member.id}/repository-access`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      const body = (await response.json()) as {
        repositoryAccess?: RepositoryAccess;
        message?: string;
      };
      if (!response.ok || !body.repositoryAccess) {
        throw new Error(
          body.message ?? "Could not update GitHub repository access.",
        );
      }
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id
            ? { ...item, repositoryAccess: body.repositoryAccess! }
            : item,
        ),
      );
      setNotice(
        body.repositoryAccess === "pending"
          ? `GitHub invitation sent to @${member.login}. Access starts after they accept it.`
          : body.repositoryAccess === "external"
            ? `@${member.login} already had repository access in GitHub.`
            : `Repository access removed for @${member.login}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update GitHub repository access.",
      );
    } finally {
      setRepositoryBusy(null);
    }
  }

  function repositoryLabel(access: RepositoryAccess) {
    if (access === "owner") return "Repository owner";
    if (access === "pending") return "Invitation pending";
    if (access === "active") return "Write access";
    if (access === "external") return "Managed on GitHub";
    return "No repository access";
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
                drafts. Owners and reviewers approve what is published. The
                owner can separately grant normal GitHub write access.
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

          {notice && (
            <p role="status" className="mt-3 text-xs text-emerald-700">
              {notice}
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
                <div className="flex shrink-0 items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="flex items-center justify-end gap-1 text-[11px] font-medium text-stone-700">
                      <GitBranch className="size-3" aria-hidden="true" />
                      {repositoryLabel(member.repositoryAccess)}
                    </p>
                    {member.repositoryAccess === "pending" && (
                      <p className="mt-0.5 text-[10px] text-stone-500">
                        Must be accepted in GitHub
                      </p>
                    )}
                  </div>
                  {role === "owner" && member.role !== "owner" && (
                    <button
                      type="button"
                      role="switch"
                      aria-label={`GitHub repository access for @${member.login}`}
                      aria-checked={member.repositoryAccess !== "not_granted"}
                      disabled={
                        repositoryBusy === member.id ||
                        member.repositoryAccess === "external"
                      }
                      onClick={() => updateRepositoryAccess(member)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        member.repositoryAccess !== "not_granted"
                          ? "bg-violet-700"
                          : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`inline-flex size-4 items-center justify-center rounded-full bg-white shadow-sm transition ${
                          member.repositoryAccess !== "not_granted"
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      >
                        {repositoryBusy === member.id && (
                          <LoaderCircle
                            className="size-3 animate-spin text-stone-500"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </button>
                  )}
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] capitalize text-stone-600">
                    {member.role}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {role === "owner" && (
            <p className="mt-2 text-[11px] leading-5 text-stone-500">
              Repository access is optional and separate from ContextOps. The
              switch grants write access only—never admin access. Existing
              GitHub access stays managed in GitHub.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
