// Adds a bulletin PDF. Bulletins are small, so the PDF comes straight through here
// and is saved in the site itself. Older-than-3-months ones are removed weekly.
import { adminHandler, isoDate, text, readJsonFile, commit, toJson, HttpError } from "../lib/shared.mjs";

export default adminHandler(async body => {
  const date = isoDate(body.date, "Bulletin date");
  const by = text(body.by, "Your name", { max: 60 });
  const pdf = Buffer.from(String(body.pdf || ""), "base64");
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new HttpError(400, "Please choose a PDF file.");
  if (pdf.length > 4 * 1024 * 1024) throw new HttpError(400, "That PDF is over 4 MB. Try exporting it smaller.");

  const file = `bulletins/${date}.pdf`;
  await commit(`Add bulletin for ${date} — posted by ${by}`, async () => {
    const list = (await readJsonFile("data/bulletins.json")).filter(b => b.date !== date);
    list.push({ date, file });
    list.sort((a, b) => b.date.localeCompare(a.date));
    return [{ path: file, content: pdf }, { path: "data/bulletins.json", content: toJson(list) }];
  });
  return { ok: true, date, file };
});
