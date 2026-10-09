"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappController = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_service_1 = require("./whatsapp.service");
const platform_express_1 = require("@nestjs/platform-express");
let WhatsappController = class WhatsappController {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }
    async send(body) {
        await this.whatsappService.sendToMany(body.numbers, body.message);
        return { status: 'messages sent' };
    }
    async uploadExcel(file) {
        return this.whatsappService.sendMessagesInviteWeddingFromExcel(file);
    }
    async sendTableNumber(file) {
        return this.whatsappService.sendMessagesForTableNumberFromExcel(file);
    }
    async thenkYou(file) {
        return this.whatsappService.sendThenkYouMessageFromExcel(file);
    }
    async onlyOneThenkYouMessage(body) {
        return await this.whatsappService.thenkYouMessage(body.phoneNumber, body.message);
    }
    async checkUnikeyNumberOfArray(file) {
        return this.whatsappService.checkUnikeyNumber(file);
    }
    async sendRemindersFromDB() {
        return this.whatsappService.sendMessagesInviteWeddingFromDB();
    }
};
exports.WhatsappController = WhatsappController;
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "send", null);
__decorate([
    (0, common_1.Post)('uploadExcel'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "uploadExcel", null);
__decorate([
    (0, common_1.Post)('sendTbaleNumber'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "sendTableNumber", null);
__decorate([
    (0, common_1.Post)('thenkYouMessage'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "thenkYou", null);
__decorate([
    (0, common_1.Post)('onlyOneThenkYouMessage'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "onlyOneThenkYouMessage", null);
__decorate([
    (0, common_1.Post)('unikeyNumberValid'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "checkUnikeyNumberOfArray", null);
__decorate([
    (0, common_1.Post)('send-reminders-from-db'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "sendRemindersFromDB", null);
exports.WhatsappController = WhatsappController = __decorate([
    (0, common_1.Controller)('whatsapp'),
    __metadata("design:paramtypes", [whatsapp_service_1.WhatsappService])
], WhatsappController);
//# sourceMappingURL=whatsapp.controller.js.map