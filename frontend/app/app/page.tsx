"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/crm/pipeline");
  }, [router]);
  return null;
}
