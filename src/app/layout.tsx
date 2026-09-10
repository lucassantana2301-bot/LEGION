import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/legion/sidebar";
import { CommandPalette } from "@/components/legion/command-palette";
import { StoreBootstrap } from "@/components/legion/store-bootstrap";
import { ApprovalModal } from "@/components/approvals/approval-modal";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";

export const metadata: Metadata = {
  title: "LEGION // Autonomous Software Engineering Platform",
  description: "One Mission. Multiple Agents. Working Software.",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark notranslate" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="bg-background text-foreground flex h-screen overflow-hidden font-sans notranslate" translate="no" suppressHydrationWarning>
        <StoreBootstrap />
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          {children}
        </main>
        <CommandPalette />
        <ApprovalModal />
        <TaskDetailModal />
      </body>
    </html>
  );
}
