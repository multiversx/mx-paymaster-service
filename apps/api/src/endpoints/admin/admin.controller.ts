import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { DrainProtectionService } from "../../drain-protection/drain.protection.service";
import { ApiExcludeController } from "@nestjs/swagger";
import { ParseAddressPipe } from "@multiversx/sdk-nestjs-common";
import { NativeAuthAdminGuard, NativeAuthGuard } from "@multiversx/sdk-nestjs-auth";

@ApiExcludeController()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly drainProtectionService: DrainProtectionService
  ) { }

  @UseGuards(NativeAuthGuard, NativeAuthAdminGuard)
  @Post('/resume-relayer')
  async resumeRelayer() {
    await this.drainProtectionService.resumeRelaying();
    return {
      message: 'Relayer operations have been resumed',
    };
  }

  @UseGuards(NativeAuthGuard, NativeAuthAdminGuard)
  @Post('/pause-relayer')
  async pauseRelayer() {
    await this.drainProtectionService.pauseRelaying();
    return {
      message: 'Relayer operations have been halted',
    };
  }

  @UseGuards(NativeAuthGuard, NativeAuthAdminGuard)
  @Post('/ban/:address')
  async banAddress(@Param('address', ParseAddressPipe) address: string) {
    await this.drainProtectionService.banAddress(address);
    return {
      message: 'Address has been banned',
    };
  }

  @UseGuards(NativeAuthGuard, NativeAuthAdminGuard)
  @Post('/lift-ban/:address')
  async liftBanAddress(@Param('address', ParseAddressPipe) address: string) {
    await this.drainProtectionService.removeAddressBan(address);
    return {
      message: 'Address ban has been lifted',
    };
  }
}
