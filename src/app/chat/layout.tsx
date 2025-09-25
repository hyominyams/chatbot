import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-screen grid-cols-[18rem_1fr] bg-white text-slate-900">
      <Sidebar />
      <div className="relative flex flex-col overflow-hidden bg-white">
        <div className="absolute right-6 top-6 z-20">
          <LogoutButton />
        </div>
        {children}
      </div>
    </div>
  );
}
