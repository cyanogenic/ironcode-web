import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateAttachmentUploadDto } from "./attachment.dto";
import { AttachmentsService } from "./attachments.service";

@ApiTags("attachments")
@ApiBearerAuth()
@Controller("orders/:orderId/attachments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.ENGINEER, UserRole.ADMIN)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post("uploads")
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() input: CreateAttachmentUploadDto,
  ) {
    return this.attachments.createUpload(user, orderId, input);
  }

  @Post(":attachmentId/complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.attachments.completeUpload(user, orderId, attachmentId);
  }

  @Get(":attachmentId/url")
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.attachments.createDownloadUrl(user, orderId, attachmentId);
  }
}
