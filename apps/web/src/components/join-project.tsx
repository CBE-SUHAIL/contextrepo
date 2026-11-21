"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Users } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SetupShell } from "@/components/setup-shell";

const API =
  process.env.NEXT_PUBLIC_CONTEXTOPS_API_URL ?? "http://localhost:4000/api";

export function JoinProject({ token }: { token: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"joining" | "joined" | "error">(
    "joining",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch(`${API}/projects/invitations/accept`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace(`/signup?invite=${encodeURIComponent(token)}`);
          return;
        }
        const body = (await response.json()) as { message?: string };
        if (!response.ok)
          throw new Error(body.message ?? "Could not join this project.");
        setStatus("joined");
        window.setTimeout(() => router.replace("/"), 900);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not join this project.",
        );
        setStatus("error");
      });
  }, [router, token]);

  return (
    <SetupShell activeStep={1} showProgress={false} contentWidth="compact">
      <section className="rounded-2xl border border-stone-200 bg-white px-7 py-10 text-center shadow-[0_16px_50px_-36px_rgba(28,25,23,0.35)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-800">
          {status === "joined" ? (
            <Check className="size-6" aria-hidden="true" />
          ) : status === "error" ? (
            <AlertCircle className="size-6 text-rose-700" aria-hidden="true" />
          ) : (
            <Users className="size-6" aria-hidden="true" />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">
          {status === "joining"
            ? "Joining the shared project…"
            : status === "joined"
              ? "You’re on the team"
              : "Could not join the project"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
          {status === "joining"
            ? "ContextOps is checking your invitation and GitHub identity."
            : status === "joined"
              ? "Opening the shared context workspace now."
              : error}
        </p>
        {status === "error" && (
          <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
            Sign in and try again
          </Link>
        )}
      </section>
    </SetupShell>
  );
}
