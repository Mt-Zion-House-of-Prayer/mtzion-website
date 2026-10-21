/**
 * Mt Zion House of Prayer - weekly bulletin -> website
 *
 * Lives in the church Google account (mtzhop@gmail.com) at script.google.com.
 * A copy is kept in the website repo (apps-script/Bulletin.gs) - keep them in sync.
 *
 * What it does:
 *   createBulletinTemplate()  one time: builds a new bulletin Google Doc whose LEFT side
 *                             (order of service) is real text the script can read.
 *   postBulletin()            reads the left side and posts it to the website. Runs
 *                             automatically every Saturday evening (installTrigger).
 *                             Emails mtzhop@gmail.com what it posted, or what went wrong.
 *   previewBulletin()         shows what WOULD be posted, without posting (View -> Logs).
 *   fillBulletinFromSheet()   Fridays ~6 AM: fills the LEFT side for the coming Sunday from the
 *                             "Master Information Lists" spreadsheet (year tab only) and emails
 *                             mtzhop@gmail.com to review it. The right side is never touched.
 *   installTrigger()          one time: schedules the Friday fill and the Saturday post.
 *
 * The right side of the bulletin (Dates to Remember, announcements, birthdays) and the
 * offering amount are NEVER read or sent - only the left column is parsed.
 *
 * Settings (Project Settings -> Script properties):
 *   BULLETIN_DOC_ID   set automatically by createBulletinTemplate()
 *   ADMIN_PASSWORD    the website's Admin page password (from the church 1Password)
 *   ANNOUNCE_CONTACT  who to send announcements to, e.g. "Becky at 740-555-1234"
 *                     (printed on the bulletin's right side; kept out of this code)
 */

const SITE = 'https://mtzionhouseofprayer.netlify.app';
const NOTIFY = 'mtzhop@gmail.com';

// Labels the website accepts, with the spellings people tend to type.
const SERVICE_LABELS = {
  'moderator': 'Moderator', 'prayer & praise': 'Prayer & Praise', 'prayer and praise': 'Prayer & Praise',
  'message': 'Message', 'offering': 'Offering', 'host family': 'Host Family',
  'kingdom family prayer focus': 'Kingdom Family Prayer Focus', 'prayer focus': 'Kingdom Family Prayer Focus',
};
const CLASS_LABELS = {
  "women's": "Women's", 'womens': "Women's", 'women': "Women's",
  "men's": "Men's", 'mens': "Men's", 'men': "Men's",
  "children's": "Children's", 'childrens': "Children's", 'children': "Children's", 'youth': 'Youth',
};

// ---------------------------------------------------------------- template
// Rebuilds the ORIGINAL bulletin layout, but with real text instead of drawings, so the
// left side can be read. Sample content is the Oct 18, 2026 left side; the right side has
// placeholders only (no birthdays are ever stored in this script).

const SC = 'Alegreya Sans SC', SANS = 'Alegreya Sans', SOFTGRAY = '#999999';

function createBulletinTemplate() {
  // Safety: never swap out a bulletin that's already in use (it may have hand-made formatting).
  const existing = PropertiesService.getScriptProperties().getProperty('BULLETIN_DOC_ID');
  if (existing) throw new Error('A bulletin is already set up: https://docs.google.com/document/d/' + existing +
    '/edit  -- the script will keep using it. To really start a new one, delete BULLETIN_DOC_ID in Project Settings first.');
  const doc = DocumentApp.create('Mt Zion Bulletin (editable)');
  const body = doc.getBody();
  body.setPageWidth(792).setPageHeight(612)                 // US Letter, landscape
      .setMarginTop(24).setMarginBottom(16).setMarginLeft(30).setMarginRight(30);

  const outer = body.appendTable([['', '']]);
  outer.setBorderWidth(0);
  const L = outer.getCell(0, 0).setWidth(360).setPaddingRight(22);
  const R = outer.getCell(0, 1).setPaddingLeft(22);

  // ===== LEFT (the only part the website reads) =====
  buildLeft_(L, SAMPLE_);

  // ===== RIGHT (church-only; never read by the script) =====
  const top = R.appendTable([['', '']]);              // Dates box | Announcements, side by side
  top.setBorderWidth(0);
  const DC = top.getCell(0, 0).setWidth(190).setPaddingLeft(0).setPaddingRight(14);
  const AC = top.getCell(0, 1).setPaddingLeft(10);
  const dates = DC.appendTable([['Dates to Remember'], ['']]);
  dates.setBorderWidth(1).setBorderColor('#000000');
  const dh = dates.getCell(0, 0).setBackgroundColor(SOFTGRAY).setPaddingTop(4).setPaddingBottom(4);
  fmt(dh.getChild(0).asParagraph(), { size: 13, color: '#ffffff' });
  dates.getRow(1).setMinimumHeight(255);
  const db = dates.getCell(1, 0).setPaddingTop(10);
  const items = [['Prayer Meeting', 'Wednesday, October 28th'], ['Communion', 'Sunday, November 1st'],
                 ['Thanksgiving Supper', 'November 14th']];
  items.forEach(([what, when], i) => {
    const p = i === 0 ? db.getChild(0).asParagraph() : db.appendParagraph('');
    p.setText(what); fmt(p, { size: 11, before: i ? 22 : 0 });
    txt(db, when, { font: SANS, size: 10.5, italic: true });
  });
  DC.removeChild(DC.getChild(0));
  const ap = AC.getChild(0).asParagraph(); ap.setText('Announcements');
  fmt(ap, { size: 12, before: 8, after: 8 });
  txt(AC, ' ', { font: SANS, size: 10.5 });
  R.removeChild(R.getChild(0));

  txt(R, 'BIRTHDAYS & ANNIVERSARIES', { font: SANS, size: 14, underline: true, before: 20, after: 10 });
  txt(R, ' ', { size: 12 });
  txt(R, ' ', { size: 12, after: 34 });
  // Contact comes from Script properties (ANNOUNCE_CONTACT, e.g. "Becky at 740-555-1234")
  // so a phone number is never stored in this code, which is public on GitHub.
  const contact = PropertiesService.getScriptProperties().getProperty('ANNOUNCE_CONTACT') || '______ at ___-___-____';
  txt(R, 'To have announcements added to the bulletin, send to ' + contact + ' by Friday evening.',
      { font: SANS, size: 10.5, align: 'LEFT', before: 6 });

  const first = body.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH && !first.asParagraph().getText()) first.removeFromParent();
  doc.saveAndClose();
  PropertiesService.getScriptProperties().setProperty('BULLETIN_DOC_ID', doc.getId());
  Logger.log('Created: ' + doc.getUrl());
  return doc.getUrl();
}

// Sample left side used when the template is first created (the Oct 18, 2026 bulletin).
const SAMPLE_ = {
  date: '2026-10-18',
  service: { 'Moderator': 'Matt', 'Prayer & Praise': 'Kenlyn Miller', 'Message': 'Austin Miller',
             'Offering': 'General Fund', 'Host Family': '', 'Kingdom Family Prayer Focus': 'Kenlyn & Mary Sue Miller' },
  ss: { "Women's": 'Cherie', "Men's": 'Chris' },
  next: { date: '2026-10-25',
          service: { 'Moderator': 'Larry', 'Prayer & Praise': 'Worship Team (Jonny)', 'Message': 'Brendan Miller',
                     'Offering': 'Building Fund', 'Host Family': 'Joe & Elsie Miller', 'Kingdom Family Prayer Focus': '' },
          ss: { "Men's": 'Brandon Yoder', "Women's": 'Lisa' } },
};
const ORDER_ = ['Moderator', 'Prayer & Praise', 'Message', 'Offering', 'Host Family', 'Kingdom Family Prayer Focus'];

function longDate_(iso, ordinal) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  const suf = !ordinal ? '' : (day % 100 >= 11 && day % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
  return Utilities.formatDate(d, 'America/New_York', 'MMMM') + ' ' + day + suf + (ordinal ? '' : ', ' + d.getFullYear());
}

// Builds the whole left column from data d (see SAMPLE_). L must be empty except one paragraph.
function buildLeft_(L, d) {
  const lp = L.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  lp.appendInlineImage(UrlFetchApp.fetch(SITE + '/images/logo.png').getBlob()).setWidth(230).setHeight(105);
  txt(L, '20875 Clutter Rd Utica, OH 43080 | MtZionHouseofPrayer.org', { font: SANS, size: 10, bold: true, after: 2 });

  // Today's Service box: everything inside it is THIS Sunday
  const box = L.appendTable([['']]);
  box.setBorderWidth(1).setBorderColor('#000000');
  const B = box.getCell(0, 0).setPaddingTop(6).setPaddingBottom(6);
  const bp = B.getChild(0).asParagraph(); bp.setText("TODAY'S SERVICE | " + longDate_(d.date));
  fmt(bp, { font: SANS, size: 13, underline: true, after: 8 });
  ORDER_.forEach(k => txt(B, k + ' | ' + (d.service[k] || ''), { size: 12.5 }));

  txt(L, 'Sunday School', { size: 13, before: 10 });
  txt(L, "Women's - " + (d.ss["Women's"] || '') + " \\ Men's - " + (d.ss["Men's"] || ''), { size: 11 });
  L.appendHorizontalRule();
  txt(L, 'Next Sunday, ' + longDate_(d.next.date, true), { size: 13, before: 2 });
  txt(L, "Men's - " + (d.next.ss["Men's"] || ''), { size: 12 });
  txt(L, "Women's - " + (d.next.ss["Women's"] || ''), { size: 11 });
  txt(L, 'NEXT SUNDAY', { font: SANS, size: 13, underline: true, before: 10, after: 6 });
  ORDER_.forEach(k => txt(L, k + ' | ' + (d.next.service[k] || ''), { size: 11.5 }));
  txt(L, 'LAST SUNDAY OFFERING - ', { font: SANS, size: 11.5, before: 10 });
}

// ---------------------------------------------------------------- Friday: fill from the schedule sheet
// Reads ONLY the year tab (e.g. "2026") of the Master Information Lists spreadsheet -
// never the member, baptism, or other tabs.

const SHEET_ID_DEFAULT = '1ldaIZcdiW0gOlv33Tzvx0VTb-rgQmhUkp8-y_6wCwII';
const SHEET_COLS_ = { 'Kingdom Family Prayer Focus': 'Kingdom Family Prayer Focus', 'Moderator': 'Moderator',
  'Message': 'Message', 'Prayer & Praise': 'Prayer & Praise', 'Offering': 'Offering', 'Host Family': 'Host Family' };

function nextSunday_(from) {
  const d = new Date(from || new Date()); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
}

// Returns {service, ss} for one Sunday from the year tab, or null if there's no row for it.
function scheduleFor_(iso) {
  const id = PropertiesService.getScriptProperties().getProperty('SCHEDULE_SHEET_ID') || SHEET_ID_DEFAULT;
  const year = iso.slice(0, 4);
  const sh = SpreadsheetApp.openById(id).getSheetByName(year);
  if (!sh) throw new Error('The schedule spreadsheet has no "' + year + '" tab.');
  const range = sh.getDataRange();
  const shown = range.getDisplayValues(), raw = range.getValues(), rich = range.getRichTextValues();
  const head = shown[0].map(h => h.trim().toLowerCase());
  const col = name => head.indexOf(name.toLowerCase());
  const want = new Date(iso + 'T12:00:00');
  for (let r = 1; r < shown.length; r++) {
    let d = raw[r][0] instanceof Date ? new Date(raw[r][0]) : new Date(shown[r][0] + ' ' + year);
    if (isNaN(d) || d.getMonth() !== want.getMonth() || d.getDate() !== want.getDate()) continue;
    const cell = name => {
      const c = col(name); if (c < 0) return '';
      const rt = rich[r][c];
      if (rt && rt.getText() && rt.getTextStyle().isStrikethrough()) return '';   // crossed out = not happening
      return shown[r][c].replace(/\s+/g, ' ').trim();
    };
    const service = {};
    Object.keys(SHEET_COLS_).forEach(k => { service[k] = cell(SHEET_COLS_[k]); });
    return { service, ss: { "Women's": cell('Ladies SS'), "Men's": cell('Mens SS') } };
  }
  return null;
}

// Fills the bulletin's LEFT side for the coming Sunday from the schedule sheet, IN PLACE:
// only the names/dates after "|" or "-" are replaced, so any fonts, sizes, or spacing set
// by hand in the Doc are kept. The right side is never touched. Then emails a review note.
function fillBulletinFromSheet() {
  try {
    const date = nextSunday_(), next = nextSunday_(new Date(date + 'T12:00:00'));
    const today = scheduleFor_(date);
    let after = null;
    try { after = scheduleFor_(next); } catch (e) { /* e.g. next year's tab doesn't exist yet */ }
    if (!today) throw new Error('No row for ' + longDate_(date) + ' in the schedule spreadsheet.');
    after = after || { service: {}, ss: {} };

    const id = PropertiesService.getScriptProperties().getProperty('BULLETIN_DOC_ID');
    const doc = DocumentApp.openById(id);
    const missing = [];
    let section = null;   // outside the box: 'ss' | 'nextss' | 'next'
    for (const it of leftColumnParas_(doc)) {
      const p = it.para, t = p.getText();
      const bar = t.indexOf('|');
      const key = norm_(bar >= 0 ? t.slice(0, bar) : t);
      if (it.inBox) {
        if (key.startsWith("today's service") || key.startsWith('todays service')) setAfter_(p, bar, longDate_(date));
        else if (bar >= 0 && SERVICE_LABELS[key]) setAfter_(p, bar, today.service[SERVICE_LABELS[key]] || '');
        continue;
      }
      if (key.startsWith('last sunday')) break;
      if (key === 'sunday school') { section = 'ss'; continue; }
      if (key.startsWith('next sunday')) {
        const comma = t.indexOf(',');
        if (comma >= 0 || /\d/.test(t)) { section = 'nextss'; if (comma >= 0) setAfter_(p, comma, longDate_(next, true)); }
        else section = 'next';
        continue;
      }
      if (section === 'next' && bar >= 0 && SERVICE_LABELS[key]) setAfter_(p, bar, after.service[SERVICE_LABELS[key]] || '');
      else if (section === 'ss') fillClasses_(p, today.ss);
      else if (section === 'nextss') fillClasses_(p, after.ss);
    }
    doc.saveAndClose();
    const blanks = ORDER_.filter(k => !today.service[k]);
    MailApp.sendEmail(NOTIFY, 'Bulletin draft ready to review - ' + longDate_(date),
      'The left side of the bulletin has been filled in from the schedule spreadsheet:\n' + doc.getUrl() +
      '\n\nPlease review it, fill in Sunday School and anything missing' +
      (blanks.length ? ' (blank this week: ' + blanks.join(', ') + ')' : '') +
      ', and add the right side (dates, announcements, birthdays) as usual.' +
      '\n\nOn Saturday evening the order of service is posted to the website automatically.');
  } catch (e) {
    MailApp.sendEmail(NOTIFY, 'Bulletin draft could NOT be filled from the spreadsheet',
      'The Friday auto-fill did not run:\n\n  ' + e.message + '\n\nThe bulletin was not changed; fill it in by hand as usual.');
    throw e;
  }
}

// Replace everything after position `at` (the "|" or ",") with " value", keeping the
// formatting of the text that was there (new text takes on the style of what precedes it).
function setAfter_(p, at, value) {
  if (at < 0) return;
  const text = p.editAsText(), len = text.getText().length;
  if (len - 1 > at) text.deleteText(at + 1, len - 1);
  text.insertText(at + 1, ' ' + value);
}

// "Women's - Cherie \ Men's - Chris": replace each name after its class label, in place.
// If the sheet has nothing for a class, the name is cleared (so last week's doesn't linger).
function fillClasses_(p, ss) {
  const text = p.editAsText();
  const labels = Object.keys(CLASS_LABELS);
  let s = text.getText();
  const re = /([A-Za-z\u2019']+)\s*-\s*([^\\\/]*)/g;
  const edits = [];
  let m;
  while ((m = re.exec(s))) {
    const cls = CLASS_LABELS[norm_(m[1])];
    if (!cls) continue;
    const start = m.index + m[0].length - m[2].length;
    const end = start + m[2].replace(/\s+$/, '').length - 1;
    edits.push([start, end, ss[cls] || '']);
  }
  edits.reverse().forEach(([start, end, v]) => {        // right to left, so indexes stay valid
    if (end >= start) text.deleteText(start, end);
    if (v) text.insertText(start, v);
  });
}

// Like leftColumnItems_, but returns the paragraphs themselves (so they can be edited).
function leftColumnParas_(doc) {
  const tables = doc.getBody().getTables();
  if (!tables.length) throw new Error('The bulletin layout changed: the two-column page table is missing.');
  const out = [];
  (function walk(el, inBox) {
    for (let i = 0; i < el.getNumChildren(); i++) {
      const c = el.getChild(i), type = c.getType();
      if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
        if (c.asText().getText().trim()) out.push({ para: c, inBox });
      } else if (type === DocumentApp.ElementType.TABLE) {
        const tb = c.asTable();
        for (let r = 0; r < tb.getNumRows(); r++)
          for (let k = 0; k < tb.getRow(r).getNumCells(); k++) walk(tb.getRow(r).getCell(k), true);
      }
    }
  })(tables[0].getCell(0, 0), false);
  return out;
}

function fmt(p, o) {
  p.setAlignment(DocumentApp.HorizontalAlignment[o.align || 'CENTER'])
   .setSpacingBefore(o.before || 0).setSpacingAfter(o.after || 0).setLineSpacing(1);
  const A = DocumentApp.Attribute, at = {}; at[A.FONT_FAMILY] = o.font || SC; at[A.FONT_SIZE] = o.size || 12;
  p.setAttributes(at);   // so even blank lines have the right size
  if (p.getText()) p.editAsText().setFontFamily(o.font || SC).setFontSize(o.size || 12)
    .setForegroundColor(o.color || '#000000').setBold(!!o.bold).setItalic(!!o.italic).setUnderline(!!o.underline);
  return p;
}
function txt(container, t, o = {}) { return fmt(container.appendParagraph(t), o); }

// ---------------------------------------------------------------- reading the left side

// Returns the LEFT column as a list of {text, inBox} lines, in order. inBox = inside the
// bordered Today's Service box (everything in there is THIS Sunday).
function leftColumnItems_() {
  const id = PropertiesService.getScriptProperties().getProperty('BULLETIN_DOC_ID');
  if (!id) throw new Error('BULLETIN_DOC_ID is not set. Run createBulletinTemplate() first.');
  const tables = DocumentApp.openById(id).getBody().getTables();
  if (!tables.length) throw new Error('The bulletin layout changed: the two-column page table is missing.');
  const out = [];
  (function walk(el, inBox) {
    for (let i = 0; i < el.getNumChildren(); i++) {
      const c = el.getChild(i), type = c.getType();
      if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
        const t = c.asText().getText().replace(/\s+/g, ' ').trim();
        if (t) out.push({ text: t, inBox });
      } else if (type === DocumentApp.ElementType.TABLE) {
        const tb = c.asTable();
        for (let r = 0; r < tb.getNumRows(); r++)
          for (let k = 0; k < tb.getRow(r).getNumCells(); k++) walk(tb.getRow(r).getCell(k), true);
      }
    }
  })(tables[0].getCell(0, 0), false);
  return out;
}

function parseDate_(s, fallbackFrom) {
  const clean = String(s || '').replace(/^[^A-Za-z0-9]+/, '').replace(/^\s*(sun|sunday)\.?,?\s*/i, '')
    .replace(/\s+,/g, ',').replace(/(\d+)(st|nd|rd|th)\b/i, '$1').trim();
  if (!/\d/.test(clean)) return '';
  const d = new Date(clean);
  if (isNaN(d)) return '';
  if (!/\d{4}/.test(clean) && fallbackFrom) d.setFullYear(new Date(fallbackFrom + 'T12:00:00').getFullYear());
  return Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
}

const norm_ = s => s.trim().toLowerCase().replace(/[\u2019`]/g, "'");

// "Womens - Cherie \ Mens - Chris"  ->  [["Women's","Cherie"],["Men's","Chris"]]
function classPairs_(line) {
  const out = [];
  for (const part of line.split(/\s[\\\/]\s|\\|\//)) {
    const m = part.match(/^\s*([^-|:]+?)\s*[-|:]\s*(.*)$/);
    if (m && CLASS_LABELS[norm_(m[1])] !== undefined) out.push([CLASS_LABELS[norm_(m[1])], m[2].trim()]);
    else if (part.trim()) out.push(['', part.replace(/\s*-\s*$/, '').trim()]);
  }
  return out;
}

function parseBulletin_() {
  const out = { date: '', service: [], sunday_school: [], next: { date: '', service: [], sunday_school: [] } };
  const warnings = [];
  let section = null;   // outside the box: 'ss' | 'nextss' | 'next' | 'stop'
  for (const it of leftColumnItems_()) {
    if (section === 'stop') break;
    const [left, ...rest] = it.text.split('|');
    const key = norm_(left), val = rest.join('|').trim();
    if (key.includes('clutter rd')) continue;
    if (it.inBox) {                                   // ---- THIS Sunday ----
      if (key.startsWith("today's service") || key.startsWith('todays service')) { out.date = parseDate_(val); continue; }
      if (key.startsWith('next sunday') && !val) continue;                       // stray heading inside the box
      if (rest.length && SERVICE_LABELS[key] !== undefined) out.service.push([SERVICE_LABELS[key], val]);
      else warnings.push('Skipped (in Today\'s box): "' + it.text + '"');
      continue;
    }
    if (key.startsWith('last sunday offering') || key.startsWith("last sunday's offering")) { section = 'stop'; continue; }
    if (key === 'sunday school') { section = 'ss'; continue; }
    if (key.startsWith('next sunday')) {
      const d = parseDate_(val || left.replace(/next sunday,?/i, ''), out.date);
      if (d) { section = 'nextss'; out.next.date = d; } else section = 'next';
      continue;
    }
    if (section === 'ss') out.sunday_school.push(...classPairs_(it.text));
    else if (section === 'nextss') out.next.sunday_school.push(...classPairs_(it.text));
    else if (section === 'next' && rest.length && SERVICE_LABELS[key] !== undefined) out.next.service.push([SERVICE_LABELS[key], val]);
    else if (section) warnings.push('Skipped a line I did not recognize: "' + it.text + '"');
  }
  if (!out.next.date && out.date) {
    const d = new Date(out.date + 'T12:00:00'); d.setDate(d.getDate() + 7);
    out.next.date = Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
  }
  if (!out.date) throw new Error('Could not find the date on the "TODAY\'S SERVICE | date" line.');
  if (!out.service.some(p => p[1])) throw new Error("The Today's Service box looks empty.");
  return { bulletin: out, warnings };
}

// ---------------------------------------------------------------- posting

function previewBulletin() {
  const r = parseBulletin_();
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function postBulletin() {
  let r;
  try {
    r = parseBulletin_();
    const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
    if (!pw) throw new Error('ADMIN_PASSWORD is not set in Script properties.');
    const res = UrlFetchApp.fetch(SITE + '/.netlify/functions/admin-post-bulletin', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-admin-password': pw },
      payload: JSON.stringify(Object.assign({ by: 'bulletin Google Doc' }, r.bulletin)),
    });
    const data = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) throw new Error(data.error || ('Website error ' + res.getResponseCode()));
    if (data.changed) {
      const lines = r.bulletin.service.filter(p => p[1]).map(p => '  ' + p[0] + ': ' + p[1]).join('\n');
      MailApp.sendEmail(NOTIFY, 'Bulletin posted to the website - ' + r.bulletin.date,
        'The order of service for ' + r.bulletin.date + ' is on the website (live in about a minute):\n' +
        SITE + '/bulletins\n\n' + lines + (r.warnings.length ? '\n\nNotes:\n  ' + r.warnings.join('\n  ') : '') +
        '\n\nOnly the left side of the bulletin is posted - no announcements, birthdays, or offering amount.');
    }
    return data;
  } catch (e) {
    MailApp.sendEmail(NOTIFY, 'Bulletin was NOT posted to the website',
      'The weekly bulletin could not be posted:\n\n  ' + e.message +
      '\n\nCheck the left side of the bulletin Google Doc (the "Today\'s Service | date" line and the "Label | name" lines), ' +
      'then run postBulletin again from script.google.com - or post it from the website Admin page.');
    throw e;
  }
}

function installTrigger() {
  ScriptApp.getProjectTriggers().filter(t => ['postBulletin', 'fillBulletinFromSheet'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('fillBulletinFromSheet').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(6).inTimezone('America/New_York').create();
  ScriptApp.newTrigger('postBulletin').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(20).inTimezone('America/New_York').create();
  Logger.log('fillBulletinFromSheet: Fridays ~6 AM.  postBulletin: Saturdays ~8 PM (Eastern).');
}
