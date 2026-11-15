import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  CreateEngineerDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
  UpdateStoreDto,
} from "./admin.dto";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("staff")
  listStaff() {
    return this.admin.listStaff();
  }

  @Post("staff")
  createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateEngineerDto,
  ) {
    return this.admin.createEngineer(input, user.id);
  }

  @Patch("staff/:staffId")
  updateStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("staffId") staffId: string,
    @Body() input: UpdateStaffDto,
  ) {
    return this.admin.updateStaff(staffId, input, user.id);
  }

  @Post("staff/:staffId/reset-password")
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("staffId") staffId: string,
    @Body() input: ResetStaffPasswordDto,
  ) {
    return this.admin.resetPassword(staffId, input, user.id);
  }

  @Get("stores")
  listStores() {
    return this.admin.listStores();
  }

  @Patch("stores/:storeId")
  updateStore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Body() input: UpdateStoreDto,
  ) {
    return this.admin.updateStore(storeId, input, user.id);
  }
}
