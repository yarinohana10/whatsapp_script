// whatsapp.controller.ts
import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) { }

  @Post('send')
  async send(@Body() body: { numbers: string[]; message: string }) {
    await this.whatsappService.sendToMany(body.numbers, body.message);
    return { status: 'messages sent' };
  }

  @Post('uploadExcel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Missing Excel file. In Postman: Body → form-data → key "file" → type File → select your .xlsx.',
      );
    }
    return this.whatsappService.sendMessagesInviteWeddingFromExcel(file);
  }
  /** Wedding invitation for couples (Excel: "שם מלא" + "מספר טלפון"). */
  @Post('sendInvitationCouples')
  @UseInterceptors(FileInterceptor('file'))
  async sendInvitationCouples(@UploadedFile() file: Express.Multer.File) {
    return this.whatsappService.sendInvitationToCouplesFromExcel(file);
  }

  /** Wedding invitation for single guests (Excel: "שם מלא" + "מספר טלפון"). */
  @Post('sendInvitationSingles')
  @UseInterceptors(FileInterceptor('file'))
  async sendInvitationSingles(@UploadedFile() file: Express.Multer.File) {
    return this.whatsappService.sendInvitationToSinglesFromExcel(file);
  }

  @Post('sendTbaleNumber')
  @UseInterceptors(FileInterceptor('file'))
  async sendTableNumber(@UploadedFile() file: Express.Multer.File) {
    return this.whatsappService.sendMessagesForTableNumberFromExcel(file);
  }


  @Post('thenkYouMessage')
  @UseInterceptors(FileInterceptor('file'))
  async thenkYou(@UploadedFile() file: Express.Multer.File) {
    return this.whatsappService.sendThenkYouMessageFromExcel(file)
  }
  @Post('onlyOneThenkYouMessage')
  async onlyOneThenkYouMessage(@Body() body: { phoneNumber: string, message: string }) {
    return await this.whatsappService.thenkYouMessage(body.phoneNumber, body.message)
  }

  @Post('unikeyNumberValid')
  @UseInterceptors(FileInterceptor('file'))
  async checkUnikeyNumberOfArray(@UploadedFile() file: Express.Multer.File) {
    return this.whatsappService.checkUnikeyNumber(file);
  }


  @Post('send-reminders-from-db')
  async sendRemindersFromDB() {
    return this.whatsappService.sendMessagesInviteWeddingFromDB();
  }
  

}
