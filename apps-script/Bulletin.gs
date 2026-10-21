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
  const doc = DocumentApp.create('Mt Zion Bulletin (editable)');
  const body = doc.getBody();
  body.setPageWidth(792).setPageHeight(612)                 // US Letter, landscape
      .setMarginTop(24).setMarginBottom(16).setMarginLeft(30).setMarginRight(30);

  const outer = body.appendTable([['', '']]);
  outer.setBorderWidth(0);
  const L = outer.getCell(0, 0).setWidth(360).setPaddingRight(22);
  const R = outer.getCell(0, 1).setPaddingLeft(22);

  // ===== LEFT (the only part the website reads) =====
  const lp = L.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  lp.appendInlineImage(UrlFetchApp.fetch(SITE + '/images/logo.png').getBlob()).setWidth(230).setHeight(105);
  txt(L, '20875 Clutter Rd Utica, OH 43080 | MtZionHouseofPrayer.org', { font: SANS, size: 10, bold: true, after: 2 });

  // Today's Service box: everything inside it is THIS Sunday
  const box = L.appendTable([['']]);
  box.setBorderWidth(1).setBorderColor('#000000');
  const B = box.getCell(0, 0).setPaddingTop(6).setPaddingBottom(6);
  const bp = B.getChild(0).asParagraph(); bp.setText("TODAY'S SERVICE | October 18, 2026");
  fmt(bp, { font: SANS, size: 13, underline: true, after: 8 });
  ['Moderator | Matt', 'Prayer & Praise | Kenlyn Miller', 'Message | Austin Miller', 'Offering | General Fund',
   'Host Family | ', 'Kingdom Family Prayer Focus | Kenlyn & Mary Sue Miller'].forEach(t => txt(B, t, { size: 12.5 }));

  txt(L, 'Sunday School', { size: 13, before: 10 });
  txt(L, "Women's - Cherie \\ Men's - Chris", { size: 11 });
  L.appendHorizontalRule();
  txt(L, 'Next Sunday, October 25th', { size: 13, before: 2 });
  txt(L, "Men's - Brandon Yoder", { size: 12 });
  txt(L, "Women's - Lisa", { size: 11 });
  txt(L, 'NEXT SUNDAY', { font: SANS, size: 13, underline: true, before: 10, after: 6 });
  ['Moderator | Larry', 'Prayer & Praise | Worship Team (Jonny)', 'Message | Brendan Miller', 'Offering | Building Fund',
   'Host Family | Joe & Elsie Miller', 'Kingdom Family Prayer Focus | '].forEach(t => txt(L, t, { size: 11.5 }));
  txt(L, 'LAST SUNDAY OFFERING - ', { font: SANS, size: 11.5, before: 10 });

  // ===== RIGHT (church-only; never read by the script) =====
  const top = R.appendTable([['', '']]);              // Dates box | Announcements, side by side
  top.setBorderWidth(0);
  const DC = top.getCell(0, 0).setWidth(190).setPaddingLeft(0).setPaddingRight(14);
  const AC = top.getCell(0, 1).setPaddingLeft(10);
  const dates = DC.appendTable([['Dates to Remember'], ['']]);
  dates.setBorderWidth(1).setBorderColor('#000000');
  const dh = dates.getCell(0, 0).setBackgroundColor(SOFTGRAY).setPaddingTop(4).setPaddingBottom(4);
  fmt(dh.getChild(0).asParagraph(), { size: 13, color: '#ffffff' });
  dates.getRow(1).setMinimumHeight(300);
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

  txt(R, 'BIRTHDAYS & ANNIVERSARIES', { font: SANS, size: 14, underline: true, before: 26, after: 14 });
  txt(R, ' ', { size: 12 });
  txt(R, ' ', { size: 12, after: 70 });
  txt(R, 'To have announcements added to the bulletin, send to ______ at ___-___-____ by Friday evening.',
      { font: SANS, size: 10.5, align: 'LEFT', before: 10 });

  const first = body.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH && !first.asParagraph().getText()) first.removeFromParent();
  doc.saveAndClose();
  PropertiesService.getScriptProperties().setProperty('BULLETIN_DOC_ID', doc.getId());
  Logger.log('Created: ' + doc.getUrl());
  return doc.getUrl();
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
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'postBulletin').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('postBulletin').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(20).inTimezone('America/New_York').create();
  Logger.log('postBulletin will run every Saturday around 8 PM Eastern.');
}
