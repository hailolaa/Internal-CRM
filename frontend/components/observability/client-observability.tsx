"use client";

import { useEffect } from "react";
import { installClientObservabilityHandlers } from "@/lib/client-observability";

export function ClientObservability() {
  useEffect(() => installClientObservabilityHandlers(), []);
  return null;
}
