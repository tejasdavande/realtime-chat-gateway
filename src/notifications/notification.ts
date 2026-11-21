export interface Notification {
  id: string;
  type: string;
  data: Record<string, unknown>;
  sentAt: string;
}
