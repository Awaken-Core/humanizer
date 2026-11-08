import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace — AI Writing Suite",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

