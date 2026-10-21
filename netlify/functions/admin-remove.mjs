// Takes a sermon or bulletin back off the site (for mistakes). A removed sermon's
// MP3 stays in audio storage, so it can be re-added; it just isn't listed.
import { adminHandler, isoDate, text, readJsonFile, commit, toJson, HttpError } from "../lib/shared.mjs";

export default adminHandler(async body => {
  const by = text(body.by, "Your name", { max: 60 });
  if (body.kind === "bulletin") {
    const date = isoDate(body.date);
    await commit(`Remove bulletin for ${date} — by ${by}`, async () => {
      const list = await readJsonFile("data/bulletins.json");
      const hit = list.find(b => b.date === date);
      if (!hit) throw new HttpError(404, "That bulletin is already gone.");
      return [...(hit.file ? [{ path: hit.file, delete: true }] : []),
              { path: "data/bulletins.json", content: toJson(list.filter(b => b !== hit)) }];
    });
    return { ok: true };
  }
  if (body.kind === "sermon") {
    const audio = String(body.audio || "");
    let title = "";
    await commit(`Remove sermon — by ${by}`, async () => {
      const list = await readJsonFile("data/sermons.json");
      const hit = list.find(s => s.audio === audio);
      if (!hit) throw new HttpError(404, "That sermon is already gone.");
      title = hit.title;
      return [{ path: "data/sermons.json", content: toJson(list.filter(s => s !== hit)) }];
    });
    return { ok: true, title };
  }
  throw new HttpError(400, "Unknown item.");
});
