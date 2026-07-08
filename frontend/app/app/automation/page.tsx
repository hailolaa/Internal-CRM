"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutomationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/ops/automations");
  }, [router]);
  return null;
}
