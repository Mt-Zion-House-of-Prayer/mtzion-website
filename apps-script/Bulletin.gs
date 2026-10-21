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

const INK = '#000000', SOFT = '#555555';
const H = 'Marcellus SC', TXT = 'Lato';

function createBulletinTemplate() {
  const doc = DocumentApp.create('Mt Zion Bulletin (new design)');
  const body = doc.getBody();
  body.setPageWidth(792).setPageHeight(612)                 // US Letter, landscape
      .setMarginTop(24).setMarginBottom(18).setMarginLeft(30).setMarginRight(30);

  const outer = body.appendTable([['', '']]);
  outer.setBorderWidth(0);
  const L = outer.getCell(0, 0).setWidth(354).setPaddingLeft(6).setPaddingRight(26);
  const R = outer.getCell(0, 1).setPaddingLeft(26).setPaddingRight(6);

  // ===== LEFT: order of service (the only part the website reads) =====
  const lp = L.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  lp.appendInlineImage(UrlFetchApp.fetch(SITE + '/images/logo.png').getBlob()).setWidth(180).setHeight(82);
  para(L, '20875 Clutter Rd, Utica, OH 43080  \u00b7  MtZionHouseofPrayer.org', { font: TXT, size: 8, color: SOFT, after: 4 });
  L.appendHorizontalRule();

  para(L, "Today's Service", { font: H, size: 11, color: SOFT, before: 4 });
  para(L, 'Sunday, October 11, 2026', { font: 'Marcellus', size: 19, after: 6 });
  rows(L, [['Moderator', 'Brenan'], ['Prayer & Praise', 'Johny'], ['Message', 'Brandon Yoder'],
           ['Offering', 'Pastor Offering'], ['Host Family', 'Brendon & Rose Miller'],
           ['Kingdom Family Prayer Focus', 'Ben & Katrina Miller']]);

  para(L, 'Sunday School  \u00b7  9:30 AM', { font: H, size: 11, color: SOFT, before: 8 });
  rows(L, [["Women's", 'Rebecca Mullett'], ["Men's", 'Lavern Eash']]);

  const box = L.appendTable([['']]);
  box.setBorderWidth(1).setBorderColor(INK);
  const B = box.getCell(0, 0).setPaddingTop(6).setPaddingBottom(4).setPaddingLeft(8).setPaddingRight(8);
  const bp = B.getChild(0).asParagraph(); bp.setText('Next Sunday');
  style(bp, { font: H, size: 11, color: SOFT });
  para(B, 'October 18, 2026', { font: 'Marcellus', size: 14, after: 3 });
  rows(B, [["Men's", 'Chris'], ["Women's", 'Cheri'], ['Moderator', 'Matt'], ['Prayer & Praise', ''],
           ['Message', 'Brendan Miller'], ['Offering', 'General Fund'], ['Host Family', 'Potluck'],
           ['Kingdom Family Prayer Focus', '']], 10);

  para(L, "Last Sunday's offering:  ", { font: TXT, size: 8.5, color: SOFT, before: 6, align: 'LEFT' });

  // ===== RIGHT: church-only (never read by the script) =====
  // Three boxes with space reserved, so lines can be added to one without moving the
  // others (until a box is completely full). The left side is a separate column and
  // never moves.
  reservedBox(R, 'Dates to Remember', 170, [['Prayer Meeting', 'Wednesday @ 7:00 PM'], ['Communion', 'Sunday, November 1']]);
  R.removeChild(R.getChild(0));   // drop the cell's empty starter line (now that the box is in)
  reservedBox(R, 'Announcements', 120, [], 10);
  reservedBox(R, 'Birthdays & Anniversaries', 92, [], 10);
  para(R, 'To have announcements added to the bulletin, send them in by Friday evening.',
       { font: TXT, size: 8.5, color: SOFT, italic: true, before: 8 });
  para(R, '\u201cMine house shall be called an house of prayer for all people.\u201d  Isaiah 56:7',
       { font: 'Marcellus', size: 9, color: SOFT, before: 6 });

  const first = body.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH && !first.asParagraph().getText()) first.removeFromParent();
  doc.saveAndClose();
  PropertiesService.getScriptProperties().setProperty('BULLETIN_DOC_ID', doc.getId());
  Logger.log('Created: ' + doc.getUrl());
  return doc.getUrl();
}

function style(p, o) {
  const al = DocumentApp.HorizontalAlignment[o.align || 'CENTER'];
  p.setAlignment(al).setSpacingBefore(o.before || 0).setSpacingAfter(o.after || 0).setLineSpacing(1);
  if (p.getText()) p.editAsText().setFontFamily(o.font || TXT).setFontSize(o.size || 11)
    .setForegroundColor(o.color || INK).setBold(!!o.bold).setItalic(!!o.italic).setUnderline(false);
  return p;
}
function para(container, t, o = {}) { return style(container.appendParagraph(t), o); }
// A box with a black header bar and a body row that reserves `height` points of space.
function reservedBox(container, title, height, items, gapBefore) {
  if (gapBefore) para(container, ' ', { size: 4 });
  const t = container.appendTable([[title], ['']]);
  t.setBorderWidth(1).setBorderColor(INK);
  const h = t.getCell(0, 0).setBackgroundColor(INK).setPaddingTop(4).setPaddingBottom(4);
  style(h.getChild(0).asParagraph(), { font: H, size: 13, color: '#ffffff' });
  t.getRow(1).setMinimumHeight(height);
  const b = t.getCell(1, 0).setPaddingTop(6).setPaddingLeft(8).setPaddingRight(8);
  const first = b.getChild(0).asParagraph();
  if (!items.length) { first.setText(' '); style(first, { font: TXT, size: 11 }); return t; }
  items.forEach(([what, when], i) => {
    const p = i === 0 ? first : b.appendParagraph('');
    p.setText(what); style(p, { font: TXT, size: 11, bold: true, before: i ? 6 : 0 });
    para(b, when, { font: TXT, size: 10.5, italic: true });
  });
  return t;
}
function section(container, t) {
  para(container, t, { font: H, size: 14, before: 14, after: 2 });
  container.appendHorizontalRule();
}
// Two-column rows: role (small caps, right-aligned) | name. Names are typed in the right column.
function rows(container, pairs, size) {
  const t = container.appendTable(pairs);
  t.setBorderWidth(0).setColumnWidth(0, 150);
  for (let r = 0; r < t.getNumRows(); r++) {
    const k = t.getCell(r, 0).setPaddingTop(2).setPaddingBottom(2).setPaddingRight(10);
    const v = t.getCell(r, 1).setPaddingTop(2).setPaddingBottom(2);
    style(k.getChild(0).asParagraph(), { font: H, size: (size || 11) - 0.5, color: SOFT, align: 'RIGHT' });
    style(v.getChild(0).asParagraph(), { font: TXT, size: size || 11.5, align: 'LEFT' });
  }
  return t;
}

// ---------------------------------------------------------------- reading the left side

// Walks the LEFT column in order and returns lines like {text} for paragraphs and
// {label, value} for two-column rows. Works with the new design (row tables) and
// with plain "Label | Name" lines.
function leftColumnItems_() {
  const id = PropertiesService.getScriptProperties().getProperty('BULLETIN_DOC_ID');
  if (!id) throw new Error('BULLETIN_DOC_ID is not set. Run createBulletinTemplate() first.');
  const tables = DocumentApp.openById(id).getBody().getTables();
  if (!tables.length) throw new Error('The bulletin layout changed: the two-column page table is missing.');
  const out = [];
  (function walk(el) {
    for (let i = 0; i < el.getNumChildren(); i++) {
      const c = el.getChild(i), type = c.getType();
      if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
        const t = c.asText().getText().replace(/\s+/g, ' ').trim();
        if (t) out.push({ text: t });
      } else if (type === DocumentApp.ElementType.TABLE) {
        const tb = c.asTable();
        for (let r = 0; r < tb.getNumRows(); r++) {
          const row = tb.getRow(r);
          if (row.getNumCells() >= 2) out.push({ label: row.getCell(0).getText().replace(/\s+/g, ' ').trim(),
                                                 value: row.getCell(1).getText().replace(/\s+/g, ' ').trim() });
          else walk(row.getCell(0));
        }
      }
    }
  })(tables[0].getCell(0, 0));
  return out;
}

function parseDate_(s, fallbackFrom) {
  const clean = String(s || '').replace(/^\s*(sun|sunday)\.?,?\s*/i, '').replace(/\s+,/g, ',')
    .replace(/(\d+)(st|nd|rd|th)\b/i, '$1').trim();
  if (!/\d/.test(clean)) return '';
  let d = new Date(clean);
  if (isNaN(d)) return '';
  if (!/\d{4}/.test(clean) && fallbackFrom) d.setFullYear(new Date(fallbackFrom + 'T12:00:00').getFullYear());
  return Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
}

function parseBulletin_() {
  const out = { date: '', service: [], sunday_school: [], next: { date: '', service: [], sunday_school: [] } };
  const warnings = [];
  let section = null;   // 'today' | 'ss' | 'next' | 'stop'
  const add = (label, val, raw) => {
    const key = label.trim().toLowerCase().replace(/[\u2019`]/g, "'");
    const target = section === 'next' ? out.next : out;
    if (CLASS_LABELS[key] !== undefined) target.sunday_school.push([CLASS_LABELS[key], val]);
    else if (SERVICE_LABELS[key] !== undefined) target.service.push([SERVICE_LABELS[key], val]);
    else if (section === 'ss' && !label) out.sunday_school.push(['', val]);
    else warnings.push('Skipped a line I did not recognize: "' + raw + '"');
  };
  for (const it of leftColumnItems_()) {
    if (section === 'stop') break;
    if (it.text !== undefined) {
      const [left, ...rest] = it.text.split('|');
      const key = left.trim().toLowerCase().replace(/[\u2019`]/g, "'");
      const val = rest.join('|').trim();
      if (key.startsWith("today's service") || key.startsWith('todays service')) { section = 'today'; if (val) out.date = parseDate_(val); continue; }
      if (key.startsWith('sunday school')) { section = 'ss'; continue; }
      if (key.startsWith('next sunday')) { section = 'next'; out.next.date = parseDate_(val || left.replace(/next sunday,?/i, ''), out.date); continue; }
      if (key.startsWith('last sunday') || key.includes('offering:')) { section = 'stop'; continue; }   // amount never leaves the doc
      if (!section || key.includes('clutter rd')) continue;
      if (section === 'today' && !out.date && parseDate_(it.text)) { out.date = parseDate_(it.text); continue; }
      if (section === 'next' && !out.next.date && parseDate_(it.text, out.date)) { out.next.date = parseDate_(it.text, out.date); continue; }
      if (rest.length) add(left, val, it.text);
      else if (section === 'ss') out.sunday_school.push(['', it.text]);
      else warnings.push('Skipped a line I did not recognize: "' + it.text + '"');
    } else if (section && section !== 'stop') {
      add(it.label, it.value, it.label + ' | ' + it.value);
    }
  }
  if (!out.date) throw new Error("Could not find the date under \"Today's Service\".");
  if (!out.service.some(p => p[1])) throw new Error("The Today's Service rows look empty.");
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
