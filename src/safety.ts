export type AttachmentKind = "image" | "pdf" | "document" | "text";

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;

export type AttachmentCandidate = {
  name: string;
  type: string;
  size: number;
};

export type PersistableChat = { temporary?: boolean };

export function storageKey(key: string, ownerId: string) {
  if (!key.trim() || !ownerId.trim()) throw new Error("A storage key and owner are required.");
  return `${key}:${ownerId}`;
}

export function durableChats<T extends PersistableChat>(chats: T[]): T[] {
  return chats.filter((chat) => !chat.temporary);
}

export function attachmentKind(file: Pick<AttachmentCandidate, "name" | "type">): AttachmentKind | null {
  const name = file.name.toLowerCase();
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("text/") || /\.(txt|csv|md)$/.test(name)) return "text";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return "document";
  return null;
}

export function validateAttachmentBatch(
  files: AttachmentCandidate[],
  existing: Pick<AttachmentCandidate, "size">[] = [],
) {
  const room = Math.max(0, MAX_ATTACHMENTS - existing.length);
  let totalBytes = existing.reduce((sum, file) => sum + file.size, 0);
  const accepted: Array<AttachmentCandidate & { kind: AttachmentKind }> = [];
  const rejected: Array<AttachmentCandidate & { reason: "unsupported" | "file-too-large" | "total-too-large" | "too-many" }> = [];

  files.forEach((file, index) => {
    if (index >= room) return rejected.push({ ...file, reason: "too-many" });
    const kind = attachmentKind(file);
    if (!kind) return rejected.push({ ...file, reason: "unsupported" });
    if (file.size > MAX_ATTACHMENT_BYTES) return rejected.push({ ...file, reason: "file-too-large" });
    if (totalBytes + file.size > MAX_ATTACHMENT_TOTAL_BYTES) return rejected.push({ ...file, reason: "total-too-large" });
    accepted.push({ ...file, kind });
    totalBytes += file.size;
  });

  return { accepted, rejected, totalBytes };
}
