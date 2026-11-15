import { AttachmentKind, UploadStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { R2StorageService } from "../storage/r2-storage.service";
import { AttachmentsService } from "./attachments.service";

describe("AttachmentsService", () => {
  const prisma = {
    repairOrder: { findUnique: vi.fn() },
    inspectionReport: { findFirst: vi.fn() },
    attachment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  } as unknown as PrismaService;
  const storage = {
    createUploadUrl: vi.fn(),
    inspectObject: vi.fn(),
    deleteObject: vi.fn(),
  } as unknown as R2StorageService;
  const service = new AttachmentsService(prisma, storage);
  const customer = {
    id: "customer-1",
    role: UserRole.CUSTOMER,
    phone: "13800138000",
    username: null,
    displayName: null,
  };

  beforeEach(() => vi.clearAllMocks());

  it("does not let a customer upload an inspection photo", async () => {
    vi.mocked(prisma.repairOrder.findUnique).mockResolvedValue({
      id: "order-1",
      orderNo: "WX1",
      customerId: customer.id,
      assignedEngineerId: null,
    } as never);
    await expect(
      service.createUpload(customer, "order-1", {
        kind: AttachmentKind.INSPECTION_PHOTO,
        originalName: "inspection.jpg",
        contentType: "image/jpeg",
        size: 100,
      }),
    ).rejects.toThrow("Attachment kind is not allowed");
  });

  it("deletes an R2 object when its metadata does not match the declaration", async () => {
    vi.mocked(prisma.repairOrder.findUnique).mockResolvedValue({
      id: "order-1",
      orderNo: "WX1",
      customerId: customer.id,
      assignedEngineerId: null,
    } as never);
    vi.mocked(prisma.attachment.findFirst).mockResolvedValue({
      id: "attachment-1",
      orderId: "order-1",
      uploadedById: customer.id,
      uploadStatus: UploadStatus.PENDING,
      objectKey: "orders/WX1/photo.jpg",
      expectedSize: 100n,
      contentType: "image/jpeg",
    } as never);
    vi.mocked(storage.inspectObject).mockResolvedValue({
      ContentLength: 99,
      ContentType: "image/jpeg",
      $metadata: {},
    });
    vi.mocked(prisma.attachment.update).mockResolvedValue({} as never);

    await expect(
      service.completeUpload(customer, "order-1", "attachment-1"),
    ).rejects.toThrow("does not match declared metadata");
    expect(storage.deleteObject).toHaveBeenCalledWith("orders/WX1/photo.jpg");
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { uploadStatus: UploadStatus.REJECTED },
      }),
    );
  });
});
