import { withDatabaseScope } from "@/lib/db";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export default async function BoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const session = await withDatabaseScope(async () => {
    const auth = await getAuth();
    return auth.api.getSession({ headers: requestHeaders });
  })();

  if (!session?.user) {
    redirect("/workspace");
  }

  return children;
}
