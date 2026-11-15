import { AttachmentKind } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateAttachmentUploadDto {
  @IsEnum(AttachmentKind)
  kind!: AttachmentKind;

  @IsString()
  @MaxLength(255)
  originalName!: string;

  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number;

  @IsOptional()
  @IsString()
  inspectionId?: string;
}
