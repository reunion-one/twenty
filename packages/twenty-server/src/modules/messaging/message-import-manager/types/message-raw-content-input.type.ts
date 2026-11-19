export type MessageRawContentInput = {
  provider: string;
  contentFormat: string;
  content: string;
  metadata: Record<string, unknown> | null;
};
