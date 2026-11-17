import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { SectionPage } from "@/components/workspace-shell";
import { ReleaseHistory } from "@/components/release-history";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ActivityPage() {
  return (
    <Suspense fallback={<LoadingScreen variant="workspace" />}>
      <SectionPage
        activePage="activity"
        eyebrow="PROJECT HISTORY"
        title="Activity"
        description="Follow context proposals, reviews, and published decisions in one place."
      >
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Capture a project handoff
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Save what is done, in progress, blocked, and what should happen
              next. It will go through the usual human approval before AI can
              use it.
            </p>
          </div>
          <Button render={<Link href="/proposals" />}>
            Create project update
          </Button>
        </div>
        <ReleaseHistory />
      </SectionPage>
    </Suspense>
  );
}
