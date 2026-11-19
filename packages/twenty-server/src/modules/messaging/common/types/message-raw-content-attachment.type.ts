export type MessageRawContentAttachment = {
  partPath: string;
  mimePartId: string;
  attachmentId: string;
  fileId: string;
  match: 'association' | 'message' | 'ancestor' | 'sent';
};
