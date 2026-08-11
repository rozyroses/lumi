import { describe, expect, it } from "vitest";
import { attachmentKind, durableChats, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_TOTAL_BYTES, storageKey, validateAttachmentBatch } from "../src/safety";

describe("account isolation", () => {
  it("namespaces every local value by its exact owner", () => {
    expect(storageKey("lumi-chats-v1", "user-a")).toBe("lumi-chats-v1:user-a");
    expect(storageKey("lumi-chats-v1", "user-b")).not.toBe(storageKey("lumi-chats-v1", "user-a"));
  });

  it("refuses ownerless keys", () => {
    expect(() => storageKey("lumi-chats-v1", " ")).toThrow();
  });
});

describe("temporary chat privacy", () => {
  it("never returns temporary chats for persistence or cloud sync", () => {
    const chats = [{ id: "saved" }, { id: "private", temporary: true }];
    expect(durableChats(chats)).toEqual([{ id: "saved" }]);
  });
});

describe("secure attachment limits", () => {
  it("accepts only Lumi-supported image, PDF, Word, and text formats", () => {
    expect(attachmentKind({ name: "photo.png", type: "image/png" })).toBe("image");
    expect(attachmentKind({ name: "work.pdf", type: "application/pdf" })).toBe("pdf");
    expect(attachmentKind({ name: "notes.docx", type: "application/octet-stream" })).toBe("document");
    expect(attachmentKind({ name: "malware.svg", type: "image/svg+xml" })).toBeNull();
    expect(attachmentKind({ name: "app.exe", type: "application/octet-stream" })).toBeNull();
  });

  it("rejects a file over 8 MB", () => {
    const result = validateAttachmentBatch([{ name: "huge.png", type: "image/png", size: MAX_ATTACHMENT_BYTES + 1 }]);
    expect(result.rejected[0]?.reason).toBe("file-too-large");
  });

  it("enforces four files and a 12 MB combined limit", () => {
    const mb = 1024 * 1024;
    const five = Array.from({ length: 5 }, (_, index) => ({ name: `${index}.png`, type: "image/png", size: 1 }));
    expect(validateAttachmentBatch(five).rejected.at(-1)?.reason).toBe("too-many");
    const total = validateAttachmentBatch([
      { name: "one.png", type: "image/png", size: 7 * mb },
      { name: "two.png", type: "image/png", size: MAX_ATTACHMENT_TOTAL_BYTES - 7 * mb + 1 },
    ]);
    expect(total.rejected[0]?.reason).toBe("total-too-large");
  });
});
