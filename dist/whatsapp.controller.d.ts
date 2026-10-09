import { WhatsappService } from './whatsapp.service';
export declare class WhatsappController {
    private readonly whatsappService;
    constructor(whatsappService: WhatsappService);
    send(body: {
        numbers: string[];
        message: string;
    }): Promise<{
        status: string;
    }>;
    uploadExcel(file: Express.Multer.File): Promise<string[]>;
    sendTableNumber(file: Express.Multer.File): Promise<string[]>;
    thenkYou(file: Express.Multer.File): Promise<void>;
    onlyOneThenkYouMessage(body: {
        phoneNumber: string;
        message: string;
    }): Promise<void>;
    checkUnikeyNumberOfArray(file: Express.Multer.File): Promise<string[]>;
    sendRemindersFromDB(): Promise<string[]>;
}
