export const RSVP_LINK = 'https://lianandeliwedding.netlify.app/';

export const EVENT_NAMES_HE = 'ליאן & אלי';
export const EVENT_NAMES_EN = 'Lian & Eli';

export const EVENT_DATE_HE = '1.12.2026';
export const EVENT_DAY_HE = 'יום שלישי';
export const EVENT_DATE_HEBREW_CALENDAR = 'כ״א בכסלו תשפ״ז';
export const EVENT_VENUE_HE = 'אולמי דוריה, היכל, שדה יואב';
export const WAZE_SEARCH_HE = 'אולמי דוריה שדה יואב';

export const RECEPTION_TIME_HE = '19:00';
export const CHUPPAH_TIME_HE = '20:00';

export const INVITATION_IMAGE_PATH = 'src/assets/wedding-invitation.jpeg';

export const LINK_FOLLOWUP_HE =
  'במידה והקישור לא נפתח השיבו כאן בהודעה חוזרת את המילה -פתח- ותוכלו להיכנס לקישור';

/** Full caption for Excel invitation (image + text in one message). */
export function buildInvitationCaption(guestName?: string): string {
  const nameLine = guestName?.trim() ? `${guestName.trim()},\n` : '';

  return `${nameLine}אנו נרגשים להזמינכם לחגוג עימנו את *חתונתנו* ב${EVENT_DAY_HE}, ${EVENT_DATE_HEBREW_CALENDAR}, ${EVENT_DATE_HE}
*ב${EVENT_VENUE_HE}*

קבלת פנים: ${RECEPTION_TIME_HE} | חופה וקידושין: ${CHUPPAH_TIME_HE}

לניווט בוויז: *${WAZE_SEARCH_HE}*

לאישור הגעה, פרטים נוספים והוספה ליומן:
${RSVP_LINK}

מחכים לראותכם! ❤️

${LINK_FOLLOWUP_HE}`;
}

/** Reminder message for guests pulled from the DB. */
export function buildReminderMessage(guestName?: string): string {
  const name = guestName?.trim() ?? '';

  return `שלום ${name},

מזכירים לגבי *החתונה של ${EVENT_NAMES_HE}* ב${EVENT_DAY_HE}, ${EVENT_DATE_HE}
ב${EVENT_VENUE_HE}

לניווט בוויז: "${WAZE_SEARCH_HE}"

לאישור הגעה, פרטים נוספים והוספה ליומן:
${RSVP_LINK}

מחכים לראותכם! ❤️

${LINK_FOLLOWUP_HE}`;
}

/** Day-of message with the guest's table number. */
export function buildTableNumberMessage(tableNumber?: string): string {
  return `*🎉 היום הגדול הגיע! 🎉*

*🤍 בדרך לחתונת ${EVENT_NAMES_HE}? 🤍*

מספר השולחן שלכם: *${tableNumber ?? ''}* 🍽️

לניווט בוויז: *${WAZE_SEARCH_HE}*

מחכים לראותכם!`;
}

/** Post-event thank-you message. */
export function buildThankYouMessage(guestName?: string): string {
  const nameLine = guestName?.trim() ? `${guestName.trim()}, ` : '';

  return `${nameLine}מודים לכם מקרב לב על השתתפותכם בחתונתנו!
מקווים שנהניתם ושניפגש רק בשמחות.

אוהבים ומעריכים,
${EVENT_NAMES_HE} 💕`;
}

/** Wedding invitation caption for couples (sent with the invitation image). */
export function buildCoupleInvitationMessage(guestName?: string): string {
  const nameLine = guestName?.trim() ? `${guestName.trim()}\n` : '';

  return `${nameLine}שמחים ונרגשים להזמינכם ליום המאושר בחיינו! 💍
בעז"ה ${EVENT_DAY_HE} | 01.12.2026
אולמי דוריה | שדה יואב
מחכים לראותכם,
ליאן ואלי 🤍`;
}

/** Wedding invitation caption for single guests (sent with the invitation image). */
export function buildSingleInvitationMessage(guestName?: string): string {
  const nameLine = guestName?.trim() ? `${guestName.trim()}\n` : '';

  return `${nameLine}שמחים ונרגשים להזמינך ליום המאושר בחיינו! 🤍
בעז"ה ${EVENT_DAY_HE} | 01.12.2026
אולמי דוריה | שדה יואב
מחכים לראותכם,
ליאן ואלי 🤍`;
}
