export type BackendStatus = "success" | "error";

export interface ApiEnvelope<T> {
  status: BackendStatus;
  data?: T;
  message?: string;
}
