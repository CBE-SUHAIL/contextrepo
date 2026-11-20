"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, History, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_URL =
  process.env.NEXT_PUBLIC_CONTEXTOPS_API_URL ?? "http://localhost:4000/api";

type Release = {
  sha: string;
  url: string;
  message: string;
  author: string;
  createdAt: string;
  isActive: boolean;
};

type ReleaseHistoryResponse = {
  repository: string;
  branch: string;
  items: Release[];
  rollbacks: Array<{
    fromCommitSha: string;
    toCommitSha: string;
    branch: string;
    createdAt: string;
    actor: string;
  }>;
};

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message ?? "Could not complete that action. Please retry.";
}

async function fetchReleaseHistory(signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/proposals/releases`, {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(await responseMessage(response));
  return (await response.json()) as ReleaseHistoryResponse;
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function dateLabel(value: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ReleaseHistory() {
  const [history, setHistory] = useState<ReleaseHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySha, setBusySha] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHistory(await fetchReleaseHistory());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load context history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchReleaseHistory(controller.signal)
      .then(setHistory)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load context history.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  async function restore(release: Release) {
    const confirmed = window.confirm(
      `Restore the active AI context to ${shortSha(release.sha)}? Newer GitHub history will remain unchanged.`,
    );
    if (!confirmed) return;
    setBusySha(release.sha);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}/proposals/releases/${release.sha}/rollback`,
        { method: "POST", credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setNotice("Previous context version restored for AI retrieval.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not restore version.",
      );
    } finally {
      setBusySha(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Approved context versions
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {history
              ? `${history.repository} · ${history.branch}`
              : "GitHub changes to the context folder"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-stone-500">
          Loading context history…
        </p>
      ) : history?.items.length ? (
        <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {history.items.map((release) => (
            <li
              key={release.sha}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {release.isActive && (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                      Active for AI
                    </Badge>
                  )}
                  <span className="font-mono text-xs text-stone-500">
                    {shortSha(release.sha)}
                  </span>
                  <span className="text-xs text-stone-500">
                    {dateLabel(release.createdAt)}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-stone-900">
                  {release.message || "Context repository update"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  by {release.author}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a href={release.url} target="_blank" rel="noreferrer" />
                  }
                >
                  <ExternalLink className="size-3.5" />
                  GitHub
                </Button>
                {!release.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busySha !== null}
                    onClick={() => void restore(release)}
                  >
                    <RotateCcw className="size-3.5" />
                    {busySha === release.sha ? "Restoring…" : "Restore"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-stone-100 text-stone-600">
            <History className="size-4" />
          </span>
          <p className="mt-3 text-sm font-medium text-stone-900">
            No context changes found
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-stone-500">
            Approving and publishing a proposal creates a GitHub change that
            will appear here.
          </p>
        </div>
      )}

      {history?.rollbacks?.length ? (
        <div className="border-t border-stone-200 pt-5">
          <h3 className="text-sm font-semibold text-stone-900">
            Restore activity
          </h3>
          <ul className="mt-3 space-y-2">
            {history.rollbacks.map((rollback, index) => (
              <li
                key={`${rollback.createdAt}-${index}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600"
              >
                <RotateCcw className="size-3.5 text-stone-400" />
                <span>
                  {rollback.actor} restored {shortSha(rollback.toCommitSha)}
                </span>
                <span className="text-stone-400">
                  from {shortSha(rollback.fromCommitSha)} ·{" "}
                  {dateLabel(rollback.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
