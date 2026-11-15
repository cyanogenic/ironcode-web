import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttachmentKind, UploadStatus, UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { R2StorageService } from "../storage/r2-storage.service";
import type { CreateAttachmentUploadDto } from "./attachment.dto";

const customerKinds = new Set<AttachmentKind>([
  AttachmentKind.CUSTOMER_FAULT_PHOTO,
]);
const staffKinds = new Set<AttachmentKind>([
  AttachmentKind.INSPECTION_PHOTO,
  AttachmentKind.DELIVERY_PROOF,
  AttachmentKind.WARRANTY_DOCUMENT,
  AttachmentKind.OTHER,
]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
  ) {}

  async createUpload(
    user: AuthenticatedUser,
    orderId: string,
    input: CreateAttachmentUploadDto,
  ) {
    const order = await this.assertOrderAccess(user, orderId);
    const allowed =
      user.role === UserRole.CUSTOMER ? customerKinds : staffKinds;
    if (!allowed.has(input.kind))
      throw new ForbiddenException("Attachment kind is not allowed");
    if (
      input.contentType === "application/pdf" &&
      input.kind !== AttachmentKind.WARRANTY_DOCUMENT
    ) {
      throw new BadRequestException(
        "PDF is only allowed for warranty documents",
      );
    }
    if (input.inspectionId) {
      const inspection = await this.prisma.inspectionReport.findFirst({
        where: { id: input.inspectionId, orderId },
      });
      if (!inspection)
        throw new BadRequestException(
          "Inspection report does not belong to order",
        );
    }

    const objectKey = `orders/${order.orderNo}/${input.kind.toLowerCase()}/${randomUUID()}.${extensions[input.contentType]}`;
    const uploadUrl = await this.storage.createUploadUrl({
      objectKey,
      contentType: input.contentType,
      expiresInSeconds: 300,
    });
    const attachment = await this.prisma.attachment.create({
      data: {
        orderId,
        inspectionId: input.inspectionId,
        uploadedById: user.id,
        kind: input.kind,
        objectKey,
        originalName: input.originalName,
        contentType: input.contentType,
        expectedSize: BigInt(input.size),
      },
    });
    return {
      attachmentId: attachment.id,
      uploadUrl,
      expiresIn: 300,
      requiredHeaders: { "Content-Type": input.contentType },
    };
  }

  async completeUpload(
    user: AuthenticatedUser,
    orderId: string,
    attachmentId: string,
  ) {
    await this.assertOrderAccess(user, orderId);
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        orderId,
        uploadedById: user.id,
        uploadStatus: UploadStatus.PENDING,
      },
    });
    if (!attachment)
      throw new NotFoundException("Pending attachment not found");

    const object = await this.storage.inspectObject(attachment.objectKey);
    const actualSize = object.ContentLength;
    if (
      actualSize === undefined ||
      attachment.expectedSize === null ||
      BigInt(actualSize) !== attachment.expectedSize ||
      object.ContentType !== attachment.contentType
    ) {
      await this.storage.deleteObject(attachment.objectKey);
      await this.prisma.attachment.update({
        where: { id: attachment.id },
        data: { uploadStatus: UploadStatus.REJECTED },
      });
      throw new BadRequestException(
        "Uploaded object does not match declared metadata",
      );
    }

    const verified = await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        uploadStatus: UploadStatus.VERIFIED,
        verifiedSize: BigInt(actualSize),
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        kind: true,
        originalName: true,
        contentType: true,
        verifiedAt: true,
      },
    });
    return verified;
  }

  async createDownloadUrl(
    user: AuthenticatedUser,
    orderId: string,
    attachmentId: string,
  ) {
    await this.assertOrderAccess(user, orderId);
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        orderId,
        uploadStatus: UploadStatus.VERIFIED,
        deletedAt: null,
      },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    return {
      url: await this.storage.createDownloadUrl(attachment.objectKey, 300),
      expiresIn: 300,
    };
  }

  private async assertOrderAccess(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.repairOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (user.role === UserRole.CUSTOMER && order.customerId !== user.id) {
      throw new NotFoundException("Order not found");
    }
    if (
      user.role === UserRole.ENGINEER &&
      order.assignedEngineerId !== user.id
    ) {
      throw new ForbiddenException("Order is not assigned to this engineer");
    }
    return order;
  }
}
