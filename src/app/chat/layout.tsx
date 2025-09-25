import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        height: "100vh",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      <Sidebar />
      <div
        style={{
          borderLeft: "1px solid #1f2937",
          padding: "16px",
          overflow: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
