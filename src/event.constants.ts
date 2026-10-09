export const RSVP_LINK = 'https://lianhenna.netlify.app/';

export const EVENT_NAMES_HE = 'ליאן & אלי';
export const EVENT_NAMES_EN = 'Lian & Eli';

export const EVENT_DATE_HE = '3.11.2026';
export const EVENT_VENUE_HE = 'אולמי MEDEA | מתחם "פאור סנטר", אשקלון';
export const WAZE_SEARCH_HE = 'החינה של ליאן ואלי';

export const INVITATION_IMAGE_PATH = 'src/assets/henna-invitation.jpeg';

export const LINK_FOLLOWUP_HE =
  'במידה והקישור לא נפתח השיבו כאן בהודעה חוזרת את המילה -פתח- ותוכלו להיכנס לקישור';

/** Full caption for Excel invitation (image + text in one message). */
export function buildInvitationCaption(guestName?: string): string {
  const greeting = guestName?.trim()
    ? `שלום ${guestName.trim()}, `
    : 'שלום, ';
  const coupleNames = `*${EVENT_NAMES_HE}*`;
  const venue = `*ב${EVENT_VENUE_HE}*`;

  return `${greeting}אנו נרגשים להזמינכם לחגוג עימנו את טקס החינה של ${coupleNames}
שיתקיים
ביום שלישי ה-${EVENT_DATE_HE}
${venue}

לאישור הגעה, פרטים נוספים והוספה ליומן ניתן ללחוץ על הקישור הבא:
${RSVP_LINK}

מחכים לראותכם!

${LINK_FOLLOWUP_HE}`;
}
