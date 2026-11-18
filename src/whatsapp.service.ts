import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { MessageMedia } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { createClient } from '@supabase/supabase-js';
import {
  INVITATION_IMAGE_PATH,
  randomSendDelayMs,
  buildInvitationCaption,
  buildReminderMessage,
  buildTableNumberMessage,
  buildThankYouMessage,
  buildCoupleInvitationMessage,
  buildSingleInvitationMessage,
} from './event.constants';


@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;

  /** True only between the client's "ready" and "disconnected" events. */
  private isReady = false;

  /** Resolved the next time the client reports itself ready. */
  private readyWaiters: (() => void)[] = [];

  /** How many times one bulk run may rebuild the browser before giving up. */
  private static readonly MAX_RESTARTS_PER_RUN = 5;

  private resolveChromeExecutablePath(): string | undefined {
    const candidates = [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ].filter(Boolean) as string[];

    return candidates.find((p) => fs.existsSync(p));
  }

  /** A fresh client with its event handlers wired up. */
  private buildClient(): Client {
    const executablePath = this.resolveChromeExecutablePath();
    const client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: false,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    client.on('qr', (qr) => {
      console.log('📱 Scan this QR code:');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      this.isReady = true;
      console.log('✅ WhatsApp is ready!');
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach((resolve) => resolve());
    });

    client.on('authenticated', () => {
      console.log('🔐 Authenticated');
    });

    client.on('auth_failure', (msg) => {
      this.isReady = false;
      console.error('❌ Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
      this.isReady = false;
      console.warn('⚠️ Disconnected:', reason);
    });

    return client;
  }

  async onModuleInit() {
    try {
      this.client = this.buildClient();
      await this.client.initialize();
    } catch (err) {
      console.error('🚨 Error initializing WhatsApp client:', err);
    }
  }

  /** Resolves once the client reports ready, or rejects after timeoutMs. */
  private waitForReady(timeoutMs = 120_000): Promise<void> {
    if (this.isReady) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== waiter);
        reject(new Error(`WhatsApp did not become ready within ${timeoutMs}ms`));
      }, timeoutMs);

      const waiter = () => {
        clearTimeout(timer);
        resolve();
      };

      this.readyWaiters.push(waiter);
    });
  }

  /**
   * The page dying takes the whole session with it, and whatsapp-web.js cannot
   * re-attach to a detached frame. These are the errors that mean "this client
   * is finished, build a new one".
   */
  private isSessionDeadError(err: unknown): boolean {
    const message = (err as Error)?.message ?? '';
    return /detached frame|execution context was destroyed|target closed|session closed|protocol error|page crashed|browser has disconnected/i.test(
      message,
    );
  }

  /**
   * Throw the dead browser away and start a brand-new one. A fresh Client gets
   * a fresh page, which avoids the "binding already exists" crash that comes
   * from re-injecting into a page that has already been used.
   */
  /**
   * Make absolutely sure the old Chrome is gone. destroy() cannot close a
   * browser whose page has detached, and a surviving process keeps the profile
   * locked, so the next launch fails with "browser is already running".
   */
  private async killBrowser(): Promise<void> {
    const client = this.client as unknown as {
      destroy?: () => Promise<void>;
      pupBrowser?: { close?: () => Promise<void>; process?: () => { pid?: number } | null };
    };

    const pid = client?.pupBrowser?.process?.()?.pid;

    try {
      await client?.destroy?.();
    } catch (err) {
      console.warn('… destroy() failed:', (err as Error).message);
    }

    try {
      await client?.pupBrowser?.close?.();
    } catch {
      // the page is detached; closing politely is expected to fail
    }

    if (pid) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already gone
      }

      // Wait for the process to actually disappear before relaunching.
      for (let i = 0; i < 40; i++) {
        try {
          process.kill(pid, 0);
        } catch {
          break; // throwing means the pid no longer exists
        }
        await this.delay(500);
      }
    }

    // Chrome leaves these behind when it is killed, and puppeteer reads them
    // as "still running".
    const sessionDir = path.join(process.cwd(), '.wwebjs_auth', 'session');
    for (const lock of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      try {
        fs.rmSync(path.join(sessionDir, lock), { force: true });
      } catch {
        // nothing to clear
      }
    }
  }

  /**
   * Throw the dead browser away and start a brand-new one. A fresh Client gets
   * a fresh page, which avoids the "binding already exists" crash that comes
   * from re-injecting into a page that has already been used.
   */
  private async restartClient(): Promise<boolean> {
    console.warn('♻️ WhatsApp page died - restarting the client…');
    this.isReady = false;

    await this.killBrowser();
    await this.delay(3000);

    try {
      this.client = this.buildClient();
      await this.client.initialize();
      await this.waitForReady();
      console.log('✅ WhatsApp client restarted - resuming where it stopped');
      return true;
    } catch (err) {
      console.error('❌ Restart failed:', (err as Error).message);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Refuse to start a bulk run unless WhatsApp is actually connected, so a dead
   * session fails on request 1 instead of burning every row in the file.
   */
  private async ensureWhatsappReady(): Promise<void> {
    let state: string | undefined;
    try {
      state = await this.client?.getState();
    } catch {
      state = undefined;
    }

    if (!this.isReady || state !== 'CONNECTED') {
      this.isReady = state === 'CONNECTED';
      throw new ServiceUnavailableException(
        `WhatsApp is not connected (state: ${state ?? 'unknown'}). Restart the server and scan the QR, then try again.`,
      );
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

  private parseExcelPhoneCell(raw: unknown): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    const value = raw.toString().trim();
    if (!value || value === 'פיזית') return undefined;
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length < 9) return undefined;
    return value;
  }

  /** Excel column "מספר טלפון" or "טלפון" (either or both; trimmed headers OK). */
  private getExcelPhone(row: Record<string, unknown>): string | undefined {
    const direct = [
      row['מספר טלפון'],
      row['טלפון'],
    ] as const;
    for (const raw of direct) {
      const phone = this.parseExcelPhoneCell(raw);
      if (phone) return phone;
    }
    for (const [key, val] of Object.entries(row)) {
      const header = key.trim();
      if (header === 'מספר טלפון' || header === 'טלפון') {
        const phone = this.parseExcelPhoneCell(val);
        if (phone) return phone;
      }
    }
    return undefined;
  }

  private getExcelName(row: Record<string, unknown>): string | undefined {
    const direct = row['שם מלא']?.toString()?.trim();
    if (direct) return direct;
    for (const [key, val] of Object.entries(row)) {
      if (key.trim() === 'שם מלא') {
        const name = val?.toString()?.trim();
        if (name) return name;
      }
    }
    return undefined;
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
      await this.client.sendMessage(chatId, message, this.whatsappSendOptions);
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
        await this.delay(randomSendDelayMs());
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
  /** The RSVP route: same image, same resilience, RSVP wording. */
  async sendMessagesInviteWeddingFromExcel(file: Express.Multer.File) {
    return this.sendInvitationsFromExcel(file, buildInvitationCaption);
  }

  async sendMessagesForTableNumberFromExcel(file: Express.Multer.File) {
    const successes: string[] = [];
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any = XLSX.utils.sheet_to_json(sheet);
    const formattedData = data
      .map((item) => {
        const phone = this.getExcelPhone(item);
        if (!phone) return null;
        return {
          name: this.getExcelName(item),
          phone: this.normalizeIsraeliPhone(phone),
          tableNumber: item['מספר שולחן']?.toString(),
        };
      })
      .filter(Boolean) as {
      name?: string;
      phone: string;
      tableNumber: string;
    }[];
    for (const contact of formattedData) {

      const message = buildTableNumberMessage(contact.tableNumber);


      await this.sendMessageWithOutPichture(contact.phone, message);
      successes.push(contact.phone);
      await this.delay(randomSendDelayMs());
    }
    return successes
  }





  async sendThenkYouMessageFromExcel(file: Express.Multer.File) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any = XLSX.utils.sheet_to_json(sheet);
    const formattedData = data
      .map((item) => {
        const phone = this.getExcelPhone(item);
        if (!phone) return null;
        return {
          name: this.getExcelName(item),
          phone: this.normalizeIsraeliPhone(phone),
        };
      })
      .filter(Boolean) as { name?: string; phone: string }[];
    console.log('formattedData', formattedData)

    for (const person of formattedData) {
      const message = buildThankYouMessage(person.name);
      await this.thenkYouMessage(person.phone, message)
      await this.delay(randomSendDelayMs())
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


  /** Parse "שם מלא" + "מספר טלפון" rows out of an uploaded Excel file. */
  private parseContactsFromExcel(file: Express.Multer.File): {
    contacts: { name?: string; phone: string }[];
    totalRowsInSheet: number;
  } {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    const contacts = data
      .map((item) => {
        const phone = this.getExcelPhone(item);
        if (!phone) return null;
        return {
          name: this.getExcelName(item),
          phone: this.normalizeIsraeliPhone(phone),
        };
      })
      .filter(Boolean) as { name?: string; phone: string }[];

    return { contacts, totalRowsInSheet: data.length };
  }

  /** Send the invitation (image + caption) to every row of the Excel file. */
  private async sendInvitationsFromExcel(
    file: Express.Multer.File,
    buildMessage: (name?: string) => string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Missing Excel file. In Postman: Body -> form-data -> key "file" -> type File -> select your .xlsx.',
      );
    }

    await this.ensureWhatsappReady();

    const { contacts, totalRowsInSheet } = this.parseContactsFromExcel(file);
    const successes: { name?: string; phone: string }[] = [];
    const failures: { name?: string; phone: string; error: string }[] = [];
    const notSent: { name?: string; phone: string }[] = [];
    let restarts = 0;

    for (const [index, contact] of contacts.entries()) {
      let delivered = false;
      let lastError = '';
      let gaveUp = false;

      // Two tries at most: the original send, plus one on a rebuilt client.
      for (let attempt = 0; attempt < 2 && !delivered; attempt++) {
        try {
          await this.sendMessageToArrivalConfirmation(
            contact.phone,
            buildMessage(contact.name),
          );
          delivered = true;
        } catch (err) {
          lastError = (err as Error).message;

          if (!this.isSessionDeadError(err)) break;

          if (restarts >= WhatsappService.MAX_RESTARTS_PER_RUN) {
            console.error(
              `❌ Already restarted ${restarts} times in this run - stopping.`,
            );
            gaveUp = true;
            break;
          }

          restarts++;
          if (!(await this.restartClient())) {
            gaveUp = true;
            break;
          }
        }
      }

      if (delivered) {
        successes.push(contact);
      } else {
        failures.push({
          name: contact.name,
          phone: contact.phone,
          error: lastError,
        });

        if (gaveUp) {
          notSent.push(...contacts.slice(index + 1));
          console.warn(
            `⚠️ Stopping: ${successes.length} sent, ${notSent.length} not attempted.`,
          );
          break;
        }
      }

      await this.delay(randomSendDelayMs());
    }

    return {
      successes,
      failures,
      notSent,
      stoppedEarly: notSent.length > 0,
      restarts,
      totalRowsInSheet,
      rowsWithValidPhone: contacts.length,
    };
  }

  /** Invitation wording for couples. */
  async sendInvitationToCouplesFromExcel(file: Express.Multer.File) {
    return this.sendInvitationsFromExcel(file, buildCoupleInvitationMessage);
  }

  /** Invitation wording for single guests. */
  async sendInvitationToSinglesFromExcel(file: Express.Multer.File) {
    return this.sendInvitationsFromExcel(file, buildSingleInvitationMessage);
  }

  async checkUnikeyNumber(file: Express.Multer.File) {
    const invalidNumbers: string[] = [];
    const seen = new Set<string>();

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);
    for (const row of data) {
      const phoneNumber = this.getExcelPhone(row);
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

          const message = buildReminderMessage(guest.name);
          await this.sendMessageToArrivalConfirmation(guest.phone, message);
          successes.push(guest.phone);
          await this.delay(randomSendDelayMs());
        }

        return successes;
  }


}
