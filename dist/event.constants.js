"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINK_FOLLOWUP_HE = exports.INVITATION_IMAGE_PATH = exports.WAZE_SEARCH_HE = exports.EVENT_VENUE_HE = exports.EVENT_DATE_HE = exports.EVENT_NAMES_EN = exports.EVENT_NAMES_HE = exports.RSVP_LINK = void 0;
exports.buildInvitationCaption = buildInvitationCaption;
exports.RSVP_LINK = 'https://lianhenna.netlify.app/';
exports.EVENT_NAMES_HE = 'ליאן & אלי';
exports.EVENT_NAMES_EN = 'Lian & Eli';
exports.EVENT_DATE_HE = '3.11.2026';
exports.EVENT_VENUE_HE = 'אולמי MEDEA | מתחם "פאור סנטר", אשקלון';
exports.WAZE_SEARCH_HE = 'החינה של ליאן ואלי';
exports.INVITATION_IMAGE_PATH = 'src/assets/henna-invitation.jpeg';
exports.LINK_FOLLOWUP_HE = 'במידה והקישור לא נפתח השיבו כאן בהודעה חוזרת את המילה -פתח- ותוכלו להיכנס לקישור';
function buildInvitationCaption(guestName) {
    const greeting = guestName?.trim()
        ? `שלום ${guestName.trim()}, `
        : 'שלום, ';
    const coupleNames = `*${exports.EVENT_NAMES_HE}*`;
    const venue = `*ב${exports.EVENT_VENUE_HE}*`;
    return `${greeting}אנו נרגשים להזמינכם לחגוג עימנו את טקס החינה של ${coupleNames}
שיתקיים
ביום שלישי ה-${exports.EVENT_DATE_HE}
${venue}

לאישור הגעה, פרטים נוספים והוספה ליומן ניתן ללחוץ על הקישור הבא:
${exports.RSVP_LINK}

מחכים לראותכם!

${exports.LINK_FOLLOWUP_HE}`;
}
//# sourceMappingURL=event.constants.js.map