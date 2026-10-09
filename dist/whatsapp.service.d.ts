import { OnModuleInit } from '@nestjs/common';
export declare class WhatsappService implements OnModuleInit {
    private client;
    private resolveChromeExecutablePath;
    onModuleInit(): Promise<void>;
    private readInvitationMedia;
    sendMessageWithPichture(phoneNumber: string, message: string): Promise<void>;
    sendMessageWithOutPichture(phoneNumber: string, message: string): Promise<void>;
    sendMessageToArrivalConfirmation(phoneNumber: string, message: string): Promise<void>;
    sendToMany(numbers: string[], message: string): Promise<{
        successes: string[];
        failures: {
            number: string;
            error: string;
        }[];
    }>;
    private delay;
    sendMessagesInviteWeddingFromExcel(file: Express.Multer.File): Promise<string[]>;
    sendMessagesForTableNumberFromExcel(file: Express.Multer.File): Promise<string[]>;
    sendThenkYouMessageFromExcel(file: Express.Multer.File): Promise<void>;
    thenkYouMessage(phoneNumber: string, message: string): Promise<void>;
    checkUnikeyNumber(file: Express.Multer.File): Promise<string[]>;
    getGuestsToRemindByEventDate(): Promise<{
        name: any;
        phone: string;
        eventDate: any;
    }[]>;
    sendMessagesInviteWeddingFromDB(): Promise<string[]>;
}
