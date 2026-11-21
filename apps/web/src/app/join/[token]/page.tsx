import { Suspense } from "react";
import { JoinProject } from "@/components/join-project";
import { LoadingScreen } from "@/components/loading-screen";

export default function JoinProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<LoadingScreen variant="auth" />}>
      <JoinProjectContent params={params} />
    </Suspense>
  );
}

async function JoinProjectContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinProject token={token} />;
}
