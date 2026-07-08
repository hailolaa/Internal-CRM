"use client";

import { Users, Activity, Calendar, CheckSquare, FileText } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const CRM_NAV = [
  { label: "Contacts", href: "/app/crm/contacts", icon: Users },
  { label: "Pipeline", href: "/app/crm/pipeline", icon: Activity },
  { label: "Calendar", href: "/app/crm/calendar", icon: Calendar },
  { label: "Tasks", href: "/app/crm/tasks", icon: CheckSquare },
  { label: "Forms", href: "/app/crm/forms", icon: FileText },
];

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNav items={CRM_NAV} />
      {children}
    </div>
  );
}
