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
 *   installTrigger()          one time: schedules postBulletin for Saturdays ~8 PM.
 *
 * The right side of the bulletin (Dates to Remember, announcements, birthdays) and the
 * offering amount are NEVER read or sent - only the left column is parsed.
 *
 * Settings (Project Settings -> Script properties):
 *   BULLETIN_DOC_ID   set automatically by createBulletinTemplate()
 *   ADMIN_PASSWORD    the website's Admin page password (from the church 1Password)
 */

const SITE = 'https://mtzionhouseofprayer.netlify.app';
const NOTIFY = 'mtzhop@gmail.com';
const FONT = 'Alegreya Sans SC';   // small caps, like the current bulletin
const BODY_FONT = 'Alegreya Sans';

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

function createBulletinTemplate() {
  const doc = DocumentApp.create('Mt Zion Bulletin (new template)');
  const body = doc.getBody();
  body.setPageWidth(792).setPageHeight(612)            // US Letter, landscape
      .setMarginTop(22).setMarginBottom(14).setMarginLeft(36).setMarginRight(36);

  const outer = body.appendTable([['', '']]);
  outer.setBorderWidth(0);
  const left = outer.getCell(0, 0).setWidth(350).setPaddingRight(24);
  const right = outer.getCell(0, 1).setPaddingLeft(24);

  // ---- LEFT: order of service (the part the website reads) ----
  const logo = UrlFetchApp.fetch(SITE + '/images/logo.png').getBlob();
  const lp = left.getChild(0).asParagraph();
  lp.appendInlineImage(logo).setWidth(200).setHeight(91);
  lp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  line(left, '20875 Clutter Rd Utica, OH 43080 | MtZionHouseofPrayer.org', { size: 9, font: BODY_FONT });

  const box = left.appendTable([['']]);
  box.setBorderWidth(1).setBorderColor('#000000');
  const bc = box.getCell(0, 0).setPaddingTop(6).setPaddingBottom(6);
  heading(bc.getChild(0).asParagraph(), "Today's Service | October 11, 2026", { underline: true });
  ['Moderator | Brenan', 'Prayer & Praise | Johny', 'Message | Brandon Yoder', 'Offering | Pastor Offering',
   'Host Family | Brendon & Rose Miller', 'Kingdom Family Prayer Focus | Ben & Katrina Miller']
    .forEach(t => line(bc, t));

  heading(left.appendParagraph(''), 'Sunday School', { space: 8 });
  ["Women's | Rebecca Mullett", "Men's | Lavern Eash"].forEach(t => line(left, t));
  left.appendHorizontalRule();
  heading(left.appendParagraph(''), 'Next Sunday | October 18, 2026', { underline: true, space: 2 });
  ["Men's | Chris", "Women's | Cheri", 'Moderator | Matt', 'Prayer & Praise | ', 'Message | Brendan Miller',
   'Offering | General Fund', 'Host Family | Potluck', 'Kingdom Family Prayer Focus | ']
    .forEach(t => line(left, t));
  line(left, 'Last Sunday Offering | ', { space: 6 });

  // ---- RIGHT: church-only content (never read by the script) ----
  const dates = right.appendTable([['Dates to Remember'], ['Prayer Meeting\nWednesday @ 7pm']]);
  dates.setBorderWidth(1).setBorderColor('#000000').setColumnWidth(0, 200);
  dates.getCell(0, 0).setBackgroundColor('#999999');
  styleCell(dates.getCell(0, 0), { color: '#ffffff', size: 13 });
  styleCell(dates.getCell(1, 0), { size: 11 });
  right.removeChild(right.getChild(0));
  heading(right.appendParagraph(''), 'Announcements', { space: 14 });
  line(right, '');
  heading(right.appendParagraph(''), 'Birthdays & Anniversaries', { underline: true, space: 14 });
  line(right, '');
  line(right, 'To have announcements added to the bulletin, send them in by Friday evening.',
       { size: 9, font: BODY_FONT, space: 24 });

  if (body.getNumChildren() > 1 && body.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH
      && !body.getChild(0).asParagraph().getText()) body.getChild(0).removeFromParent();

  doc.saveAndClose();
  PropertiesService.getScriptProperties().setProperty('BULLETIN_DOC_ID', doc.getId());
  Logger.log('Created: ' + doc.getUrl());
  return doc.getUrl();
}

function heading(p, t, o = {}) {
  p.setText(t);   // note: setText returns nothing, so it can't be chained
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(o.space || 0).setSpacingAfter(3).setLineSpacing(1);
  p.editAsText().setFontFamily(FONT).setFontSize(13).setBold(false).setUnderline(!!o.underline);
  return p;
}
function line(container, t, o = {}) {
  const p = container.appendParagraph(t).setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setSpacingBefore(o.space || 0).setSpacingAfter(0).setLineSpacing(1);
  if (t) p.editAsText().setFontFamily(o.font || FONT).setFontSize(o.size || 12).setUnderline(false);
  return p;
}
function styleCell(cell, o) {
  for (let i = 0; i < cell.getNumChildren(); i++) {
    const p = cell.getChild(i).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    if (p.getText()) p.editAsText().setFontFamily(FONT).setFontSize(o.size).setForegroundColor(o.color || '#000000');
  }
}

// ---------------------------------------------------------------- reading the left side

function leftColumnLines_() {
  const id = PropertiesService.getScriptProperties().getProperty('BULLETIN_DOC_ID');
  if (!id) throw new Error('BULLETIN_DOC_ID is not set. Run createBulletinTemplate() first.');
  const body = DocumentApp.openById(id).getBody();
  const tables = body.getTables();
  if (!tables.length) throw new Error('The bulletin layout changed: the two-column table is missing.');
  return tables[0].getCell(0, 0).getText().split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseDate_(s, fallbackFrom) {
  const clean = String(s || '').replace(/\s+,/g, ',').replace(/(\d+)(st|nd|rd|th)\b/i, '$1').trim();
  let d = clean ? new Date(clean) : null;
  if ((!d || isNaN(d)) && fallbackFrom) { d = new Date(fallbackFrom); d.setDate(d.getDate() + 7); }
  if (!d || isNaN(d)) return '';
  if (clean && !/\d{4}/.test(clean) && fallbackFrom) d.setFullYear(new Date(fallbackFrom).getFullYear());
  return Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
}

function parseBulletin_() {
  const out = { date: '', service: [], sunday_school: [], next: { date: '', service: [], sunday_school: [] } };
  const warnings = [];
  let section = null;   // 'today' | 'ss' | 'next' | 'stop'
  for (const raw of leftColumnLines_()) {
    const [left, ...rest] = raw.split('|');
    const key = left.trim().toLowerCase().replace(/[\u2019`]/g, "'");
    const val = rest.join('|').trim();
    if (key.startsWith("today's service") || key.startsWith('todays service')) { section = 'today'; out.date = parseDate_(val); continue; }
    if (key === 'sunday school') { section = 'ss'; continue; }
    if (key.startsWith('next sunday')) { section = 'next'; out.next.date = parseDate_(val || left.replace(/next sunday,?/i, ''), out.date); continue; }
    if (key.startsWith('last sunday offering')) { section = 'stop'; continue; }   // amount never leaves the doc
    if (!section || section === 'stop' || key.includes('clutter rd')) continue;

    const target = section === 'next' ? out.next : out;
    if (CLASS_LABELS[key] !== undefined) target.sunday_school.push([CLASS_LABELS[key], val]);
    else if (SERVICE_LABELS[key] !== undefined) target.service.push([SERVICE_LABELS[key], val]);
    else if (section === 'ss' && rest.length === 0) out.sunday_school.push(['', raw]);       // e.g. "Prayer & Sharing"
    else warnings.push('Skipped a line I did not recognize: "' + raw + '"');
  }
  if (!out.date) throw new Error('Could not find the date on the "Today\'s Service | ..." line.');
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
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'postBulletin').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('postBulletin').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(20).inTimezone('America/New_York').create();
  Logger.log('postBulletin will run every Saturday around 8 PM Eastern.');
}
