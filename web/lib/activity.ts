export interface ActivityInput {
  action: string;
  feature?: string;
  level?: "info" | "warn" | "error" | "fatal";
  status?: 0 | 1;
  galaxyId?: string;
  description?: Record<string, unknown>;
}

declare global {
  interface Window {
    LumoraActivity?: { log: (activity: ActivityInput) => void };
  }
}

export function trackActivity(activity: ActivityInput): void {
  if (typeof window === "undefined") return;
  window.LumoraActivity?.log(activity);
}
