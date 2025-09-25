import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-screen grid-cols-[18rem_1fr] bg-white text-slate-900">
      <Sidebar />
      <div className="flex flex-col overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}
