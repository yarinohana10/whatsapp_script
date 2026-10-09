import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { MessageMedia } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { createClient } from '@supabase/supabase-js';
import {
  EVENT_DATE_HE,
  EVENT_NAMES_HE,
  EVENT_VENUE_HE,
  INVITATION_IMAGE_PATH,
  LINK_FOLLOWUP_HE,
  RSVP_LINK,
  WAZE_SEARCH_HE,
  buildInvitationCaption,
} from './event.constants';


@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;

  private resolveChromeExecutablePath(): string | undefined {
    const candidates = [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ].filter(Boolean) as string[];

    return candidates.find((p) => fs.existsSync(p));
  }

  async onModuleInit() {
    try {
      const executablePath = this.resolveChromeExecutablePath();
      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: false,
          ...(executablePath ? { executablePath } : {}),
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
    } catch (err) {
      console.error('🚨 Error initializing WhatsApp client:', err);
    }
  }

  private readInvitationMedia(): MessageMedia {
    const imagePath = path.join(process.cwd(), INVITATION_IMAGE_PATH);
    return MessageMedia.fromFilePath(imagePath);
  }

  /** Digits only, country code 972, no leading 0 (e.g. 0532493904 → 972532493904). */
  private normalizeIsraeliPhone(raw: string): string {
    let digits = raw.toString().replace(/[^0-9]/g, '');
    if (digits.startsWith('972')) {
      digits = digits.slice(3);
    }
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    return `972${digits}`;
  }

  private toChatId(phoneNumber: string): string {
    return `${this.normalizeIsraeliPhone(phoneNumber)}@c.us`;
  }

  private async resolveChatId(phoneNumber: string): Promise<string> {
    const digits = this.normalizeIsraeliPhone(phoneNumber);
    const wid = await this.client.getNumberId(digits);
    if (!wid?._serialized) {
      throw new Error(`Number ${digits} is not registered on WhatsApp`);
    }
    return wid._serialized;
  }

  /** Avoid getLinkPreview errors on text messages that include URLs. */
  private readonly whatsappSendOptions = {
    linkPreview: false,
    sendSeen: false,
  };

  /** One WhatsApp message: invitation image + full caption (including RSVP link). */
  private async sendInvitationWithImageCaption(
    chatId: string,
    caption: string,
  ): Promise<void> {
    const media = this.readInvitationMedia();
    const fullCaption = caption.trim();

    const sendWithMedia = (extra: Record<string, unknown> = {}) =>
      this.client.sendMessage(chatId, media, {
        caption: fullCaption,
        ...this.whatsappSendOptions,
        ...extra,
      });

    try {
      await sendWithMedia();
    } catch (firstErr) {
      console.warn(
        `⚠️ Image+caption failed (${firstErr.message}), retrying as document…`,
      );
      await sendWithMedia({ sendMediaAsDocument: true });
    }
  }

  async sendMessageWithPichture(phoneNumber: string, message: string) {
    try {
      const number = this.normalizeIsraeliPhone(phoneNumber);
      const chatId = await this.resolveChatId(phoneNumber);
      const caption = message;
      const media = this.readInvitationMedia();
      await this.client.sendMessage(chatId, media, {
        caption,
        ...this.whatsappSendOptions,
      });

      console.log(`✅ Message with image sent to ${number}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
      throw err;
    }
  }

  async sendMessageWithOutPichture(phoneNumber: string, message: string) {
    try {
      const number = this.normalizeIsraeliPhone(phoneNumber);
      const chatId = await this.resolveChatId(phoneNumber);
      const caption = `${message} מחכים לראותכם! `;
      await this.client.sendMessage(chatId, caption, this.whatsappSendOptions);
      console.log(`✅ Message with image sent to ${number}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
      throw err;
    }
  }

  async sendMessageToArrivalConfirmation(phoneNumber: string, message: string) {
    try {
      const number = this.normalizeIsraeliPhone(phoneNumber);
      const chatId = await this.resolveChatId(phoneNumber);
      await this.sendInvitationWithImageCaption(chatId, message.trim());
      console.log(`✅ Invitation (image + caption) sent to ${number}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
      throw err;
    }
  }


  async sendToMany(numbers: string[], message: string) {
    const successes: string[] = [];
    const failures: { number: string; error: string }[] = [];

    for (const num of numbers) {
      try {
        await this.sendMessageWithOutPichture(num, message);
        successes.push(num);
        await this.delay(1000); // 1 שנייה בין הודעות
      } catch (err) {
        failures.push({ number: num, error: err.message });
      }
    }

    return { successes, failures };
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  //read from excel
  async sendMessagesInviteWeddingFromExcel(file: Express.Multer.File) {
    const successes: { name: string; phone: string }[] = [];
    const failures: { name: string; phone: string; error: string }[] = [];
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any = XLSX.utils.sheet_to_json(sheet);
    const formattedData = data
      .filter(item => item["מספר טלפון"]) // רק שורות עם טלפון
      .map(item => {
        return {
          name: item["שם מלא"]?.trim(),
          phone: this.normalizeIsraeliPhone(item["מספר טלפון"].toString()),
        };
      });
    // console.log('formattedData', formattedData)
    for (const contact of formattedData) {
      // const message = "אנו נרגשים להזמינכם לחגוג עימנו את חתונתינו שתתקיים בתאריך 27/05/25\nנשמח לראותכם!\nירין ואוראן  💍✨";
      // const message = 'אנו נרגשים להזמינכם לחגוג עימנו את חתונת בננו שתתקיים ב"ה בתאריך 27/05/25\nנשמח לראותכם!\n עמי ואורלי אוחנה 💍✨';

      //       const message1 = `שלום ${contact.name} 😊,
      // הוזמנתם לחתונה של ירין ואוראן 💍✨
      // 🗓️ בתאריך 27.05.2025
      // באולמי דוריה
      // לאישור הגעה לחתונה, בחירת כמות המגיעים ופרטים נוספים 📋
      // ניתן ללחוץ על הקישור הבא: 
      // `;
      //       const message2 = `היי  😊 ,
      //       כאן צוות האישורי הגעה לחתונה של ירין ואוראן 🎉


      //  שמנו לב שעדיין לא אישרתם את הגעתכם –  נשמח לדעת אם תגיעו וכמה תהיו 🙏
      // לחצו כאן כדי לעדכן אותנו:
      //       `;

      const invitationCaption = buildInvitationCaption(contact.name);

      try {
        await this.sendMessageToArrivalConfirmation(contact.phone, invitationCaption);
        successes.push(contact);
      } catch (err) {
        failures.push({
          name: contact.name,
          phone: contact.phone,
          error: err.message,
        });
      }
      await this.delay(1000); // 20 שנייה בין הודעות
    }
    return { successes, failures };
  }


  async sendMessagesForTableNumberFromExcel(file: Express.Multer.File) {
    const successes: string[] = [];
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any = XLSX.utils.sheet_to_json(sheet);
    const formattedData = data
      .filter(item => item["מספר טלפון"]) // רק שורות עם טלפון
      .map(item => {
        return {
          name: item["שם מלא"]?.trim(),
          phone: this.normalizeIsraeliPhone(item["מספר טלפון"].toString()),
          tableNumber: item["מספר שולחן"].toString(),
        };
      });
    for (const contact of formattedData) {

      const message = `*🎉 היום הגדול הגיע! 🎉*

*🤍 בדרך לחינה של ${EVENT_NAMES_HE}?🤍*

מספר השולחן שלכם הוא: *${contact.tableNumber}* 🍽️

לניווט לאולם MEDEA רשמו בוויז: *${WAZE_SEARCH_HE}*

`;


      await this.sendMessageWithOutPichture(contact.phone, message);
      successes.push(contact);
      await this.delay(1000); // 20 שנייה בין הודעות
    }
    return successes
  }





  async sendThenkYouMessageFromExcel(file: Express.Multer.File) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any = XLSX.utils.sheet_to_json(sheet);
    const formattedData = data.filter(item => item["מספר טלפון"]).map(item => {
      return {
        name: item["שם מלא"]?.trim(),
        phone: this.normalizeIsraeliPhone(item["מספר טלפון"].toString()),
      }
    }
    )
    console.log('formattedData', formattedData)

    for (const person of formattedData) {
      const message = ` מודים לכם מקרב לב על השתתפותכם בחינת השנה! מקווים שנהניתם ושניפגש רק בשמחות! אוהבים המון אלי וליאן ${person.name}`
      await this.thenkYouMessage(person.phone, message)
      await this.delay(1000)// 1 שנייה בין הודעות
    }
  }
  async thenkYouMessage(phoneNumber: string, message: string) {
    try {
      const number = this.normalizeIsraeliPhone(phoneNumber);
      const chatId = await this.resolveChatId(phoneNumber);
      await this.client.sendMessage(chatId, message, this.whatsappSendOptions);
      console.log(`✅ Message with image sent to ${number}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${phoneNumber}:`, err.message);
      throw err;
    }
  }


  async checkUnikeyNumber(file: Express.Multer.File) {
    const invalidNumbers: string[] = [];
    const seen = new Set<string>();

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);
    for (const row of data) {
      const phoneNumber = row["מספר טלפון"]?.toString().trim();
      if (!phoneNumber) continue;

      if (seen.has(phoneNumber)) {
        invalidNumbers.push(row);
      } else {
        seen.add(phoneNumber);
      }
    }
    return invalidNumbers;
  }













  async getGuestsToRemindByEventDate() {
    const supabaseUrl = 'https://dbwyevnpwriumspqlujk.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRid3lldm5wd3JpdW1zcHFsdWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTA1OTQsImV4cCI6MjA1OTA4NjU5NH0.dDCB2tG6ZtagvjvIlWmf9GUoYLaK28ZaGuRD4rrMseU';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const TODAY = dayjs();
    const validReminderDays = [7, 4, 3];

    const { data, error } = await supabase
      .from('guests')
      .select('name, phone, status, event_date')
      .eq('status', 'טרם אישר')

    if (error) {
      console.error('❌ שגיאה בשליפת אורחים:', error.message);
      return [];
    }
    console.log('data', data)
    console.log('TODAY', TODAY)

    return data
      // .filter(g => {
      //   const eventDate = dayjs(g.event_date);
      //   const diff = eventDate.diff(TODAY, 'day');
      //   return validReminderDays.includes(diff);
      // })
      .map(g => ({
        name: g.name?.trim(),
        phone: this.normalizeIsraeliPhone(g.phone.toString()),
        eventDate: g.event_date
      }));
  }


  async sendMessagesInviteWeddingFromDB() {
    const guests = await this.getGuestsToRemindByEventDate();
    const successes: string[] = [];

    console.log('guests', guests)



        for (const guest of guests) {
          // const dateFormatted = dayjs(guest.eventDate).format('DD.MM.YYYY');

          const message = `שלום ${guest.name || ''}, אנו מזכירים לכם לגבי *החינה של ${EVENT_NAMES_HE}* שתתקיים בתאריך ${EVENT_DATE_HE}
    ב${EVENT_VENUE_HE}

    לניווט לאירוע ניתן לרשום בוויז - "${WAZE_SEARCH_HE}"

    לפרטים נוספים, הוספה ליומן ועדכון סטטוס ההגעה ניתן ללחוץ על הקישור הבא:
מחכים לראותכם!
${RSVP_LINK}
${LINK_FOLLOWUP_HE}`;
          await this.sendMessageToArrivalConfirmation(guest.phone, message);
          successes.push(guest.phone);
          await this.delay(1000); // שנייה בין הודעות
        }

        return successes;
  }


}
