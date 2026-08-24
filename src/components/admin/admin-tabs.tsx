"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/users", label: "Users" },
    { href: "/admin/types", label: "Types" },
    { href: "/admin/templates", label: "Templates" },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-2 text-sm font-medium ${
              active
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
