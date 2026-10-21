// Receives one Sunday's order of service (the LEFT side of the bulletin only) and
// saves it to data/bulletins.json. Called each week by the Google Apps Script in the
// church's Google account (apps-script/Bulletin.gs), using the admin password.
// Never accepts announcements, birthdays, or offering amounts — there are no fields for them.
import { adminHandler, isoDate, text, readJsonFile, commit, toJson, HttpError } from "../lib/shared.mjs";

const LABELS = new Set(["Moderator", "Prayer & Praise", "Message", "Offering", "Host Family",
  "Kingdom Family Prayer Focus", "Women's", "Men's", "Children's", "Youth", ""]);

function pairs(list, label) {
  if (!Array.isArray(list)) return [];
  if (list.length > 12) throw new HttpError(400, `Too many ${label} lines.`);
  return list.map(p => {
    const [k, v] = Array.isArray(p) ? p : [];
    const key = text(k, `${label} label`, { required: false, max: 40 });
    if (!LABELS.has(key)) throw new HttpError(400, `Unexpected ${label} line "${key}".`);
    const val = text(v, `${label} value`, { required: false, max: 120 });
    if (/\$\s?\d/.test(val)) throw new HttpError(400, "Offering amounts don't go on the website.");
    return [key, val];
  });
}

export default adminHandler(async body => {
  const date = isoDate(body.date, "Bulletin date");
  const entry = {
    date,
    service: pairs(body.service, "service"),
    sunday_school: pairs(body.sunday_school, "Sunday School"),
    next: {
      date: body.next?.date ? isoDate(body.next.date, "Next Sunday date") : "",
      service: pairs(body.next?.service, "next Sunday"),
      sunday_school: pairs(body.next?.sunday_school, "next Sunday School"),
    },
  };
  if (!entry.service.some(([, v]) => v)) throw new HttpError(400, "The order of service is empty.");

  // The script may run more than once for the same Sunday; only save real changes.
  const current = (await readJsonFile("data/bulletins.json")).find(b => b.date === date);
  if (current && JSON.stringify(current) === JSON.stringify(entry)) return { ok: true, date, changed: false };

  await commit(`Bulletin for ${date} — posted from the bulletin Google Doc`, async () => {
    const list = await readJsonFile("data/bulletins.json");
    const next = list.filter(b => b.date !== date).concat(entry).sort((a, b) => b.date.localeCompare(a.date));
    return [{ path: "data/bulletins.json", content: toJson(next) }];
  });
  return { ok: true, date, changed: true };
});
