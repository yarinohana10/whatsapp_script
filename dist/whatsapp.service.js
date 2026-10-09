"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode-terminal"));
const whatsapp_web_js_2 = require("whatsapp-web.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const XLSX = __importStar(require("xlsx"));
const dayjs_1 = __importDefault(require("dayjs"));
const supabase_js_1 = require("@supabase/supabase-js");
const event_constants_1 = require("./event.constants");
let WhatsappService = class WhatsappService {
    async onModuleInit() {
        try {
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth(),
                puppeteer: {
                    headless: false,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            });
            this.client.on('qr', (qr) => {
                console.log('📱 Scan this QR code:');
                qrcode.generate(qr, { small: true });
            });
            this.client.on('ready', () => {
                console.log('✅ WhatsApp is ready!');
            });
            this.client.on('authenticated', () => {
                console.log('🔐 Authenticated');
            });
            this.client.on('auth_failure', (msg) => {
                console.error('❌ Authentication failed:', msg);
            });
            this.client.on('disconnected', (reason) => {
                console.warn('⚠️ Disconnected:', reason);
            });
            await this.client.initialize();
        }
        catch (err) {
            console.error('🚨 Error initializing WhatsApp client:', err);
        }
    }
    readInvitationMedia() {
        const imagePath = path.join(process.cwd(), event_constants_1.INVITATION_IMAGE_PATH);
        const mediaBuffer = fs.readFileSync(imagePath);
        return new whatsapp_web_js_2.MessageMedia('image/png', mediaBuffer.toString('base64'), 'henna-invitation.png');
    }
    async sendMessageWithPichture(phoneNumber, message) {
        try {
            const number = phoneNumber.replace(/[^0-9]/g, '');
            const chatId = `${number}@c.us`;
            const caption = message;
            const media = this.readInvitationMedia();
            await this.client.sendMessage(chatId, media, { caption });
            console.log(`✅ Message with image sent to ${number}`);
        }
        catch (err) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
            throw err;
        }
    }
    async sendMessageWithOutPichture(phoneNumber, message) {
        try {
            const number = phoneNumber.replace(/[^0-9]/g, '');
            const chatId = `${number}@c.us`;
            const caption = `${message} מחכים לראותכם! `;
            await this.client.sendMessage(chatId, caption);
            console.log(`✅ Message with image sent to ${number}`);
        }
        catch (err) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
            throw err;
        }
    }
    async sendMessageToArrivalConfirmation(phoneNumber, message) {
        try {
            const number = phoneNumber.replace(/[^0-9]/g, '');
            const chatId = `${number}@c.us`;
            const caption = `${message} ${event_constants_1.RSVP_LINK}${event_constants_1.LINK_FOLLOWUP_HE}`;
            const media = this.readInvitationMedia();
            await this.client.sendMessage(chatId, media, { caption });
            console.log(`✅ Message with image sent to ${number}`);
        }
        catch (err) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
            throw err;
        }
    }
    async sendToMany(numbers, message) {
        const successes = [];
        const failures = [];
        for (const num of numbers) {
            try {
                await this.sendMessageWithOutPichture(num, message);
                successes.push(num);
                await this.delay(1000);
            }
            catch (err) {
                failures.push({ number: num, error: err.message });
            }
        }
        return { successes, failures };
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async sendMessagesInviteWeddingFromExcel(file) {
        const successes = [];
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        const formattedData = data
            .filter(item => item["מספר טלפון"])
            .map(item => {
            return {
                name: item["שם מלא"]?.trim(),
                phone: `+972${item["מספר טלפון"].toString().replace(/[^0-9]/g, '')}`
            };
        });
        for (const contact of formattedData) {
            const message3 = `שלום, אנו מזכירים לכם לגבי *החינה של ${event_constants_1.EVENT_NAMES_HE}* שתתקיים ביום שלישי ה-${event_constants_1.EVENT_DATE_HE}
    ב${event_constants_1.EVENT_VENUE_HE}
      
    לניווט לאירוע ניתן לרשום בוייז - "${event_constants_1.WAZE_SEARCH_HE}"

      לפרטים נוספים, הוספה ליומן ועדכון סטטוס ההגעה ניתן ללחוץ על הקישור הבא:`;
            await this.sendMessageToArrivalConfirmation(contact.phone, message3);
            successes.push(contact);
            await this.delay(1000);
        }
        return successes;
    }
    async sendMessagesForTableNumberFromExcel(file) {
        const successes = [];
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        const formattedData = data
            .filter(item => item["מספר טלפון"])
            .map(item => {
            return {
                name: item["שם מלא"]?.trim(),
                phone: `+972${item["מספר טלפון"].toString().replace(/[^0-9]/g, '')}`,
                tableNumber: item["מספר שולחן"].toString(),
            };
        });
        for (const contact of formattedData) {
            const message = `*🎉 היום הגדול הגיע! 🎉*

*🤍 בדרך לחינה של ${event_constants_1.EVENT_NAMES_HE}?🤍*

מספר השולחן שלכם הוא: *${contact.tableNumber}* 🍽️

לניווט לאולם MEDEA רשמו בוויז: *${event_constants_1.WAZE_SEARCH_HE}*

`;
            await this.sendMessageWithOutPichture(contact.phone, message);
            successes.push(contact);
            await this.delay(1000);
        }
        return successes;
    }
    async sendThenkYouMessageFromExcel(file) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        const formattedData = data.filter(item => item["מספר טלפון"]).map(item => {
            return {
                name: item["שם מלא"]?.trim(),
                phone: `+972${item["מספר טלפון"].toString().replace(/[^0-9]/g, '')}`
            };
        });
        console.log('formattedData', formattedData);
        for (const person of formattedData) {
            const message = ` מודים לכם מקרב לב על השתתפותכם בחינת השנה! מקווים שנהניתם ושניפגש רק בשמחות! אוהבים המון אלי וליאן ${person.name}`;
            await this.thenkYouMessage(person.phone, message);
            await this.delay(1000);
        }
    }
    async thenkYouMessage(phoneNumber, message) {
        try {
            const number = phoneNumber.replace(/[^0-9]/g, '');
            const chatId = `${number}@c.us`;
            await this.client.sendMessage(chatId, message);
            console.log(`✅ Message with image sent to ${phoneNumber}`);
        }
        catch (err) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
            throw err;
        }
    }
    async checkUnikeyNumber(file) {
        const invalidNumbers = [];
        const seen = new Set();
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        for (const row of data) {
            const phoneNumber = row["מספר טלפון"]?.toString().trim();
            if (!phoneNumber)
                continue;
            if (seen.has(phoneNumber)) {
                invalidNumbers.push(row);
            }
            else {
                seen.add(phoneNumber);
            }
        }
        return invalidNumbers;
    }
    async getGuestsToRemindByEventDate() {
        const supabaseUrl = 'https://dbwyevnpwriumspqlujk.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRid3lldm5wd3JpdW1zcHFsdWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTA1OTQsImV4cCI6MjA1OTA4NjU5NH0.dDCB2tG6ZtagvjvIlWmf9GUoYLaK28ZaGuRD4rrMseU';
        const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
        const TODAY = (0, dayjs_1.default)();
        const validReminderDays = [7, 4, 3];
        const { data, error } = await supabase
            .from('guests')
            .select('name, phone, status, event_date')
            .eq('status', 'טרם אישר');
        if (error) {
            console.error('❌ שגיאה בשליפת אורחים:', error.message);
            return [];
        }
        console.log('data', data);
        console.log('TODAY', TODAY);
        return data
            .map(g => ({
            name: g.name?.trim(),
            phone: `${g.phone.toString().replace(/[^0-9]/g, '')}`,
            eventDate: g.event_date
        }));
    }
    async sendMessagesInviteWeddingFromDB() {
        const guests = await this.getGuestsToRemindByEventDate();
        const successes = [];
        console.log('guests', guests);
        for (const guest of guests) {
            const message = `שלום ${guest.name || ''}, אנו מזכירים לכם לגבי *החינה של ${event_constants_1.EVENT_NAMES_HE}* שתתקיים בתאריך ${event_constants_1.EVENT_DATE_HE}
    ב${event_constants_1.EVENT_VENUE_HE}

    לניווט לאירוע ניתן לרשום בוויז - "${event_constants_1.WAZE_SEARCH_HE}"

    לפרטים נוספים, הוספה ליומן ועדכון סטטוס ההגעה ניתן ללחוץ על הקישור הבא:`;
            await this.sendMessageToArrivalConfirmation(guest.phone, message);
            successes.push(guest.phone);
            await this.delay(1000);
        }
        return successes;
    }
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = __decorate([
    (0, common_1.Injectable)()
], WhatsappService);
//# sourceMappingURL=whatsapp.service.js.map