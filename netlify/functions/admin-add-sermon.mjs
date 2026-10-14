// Step 2 of adding a sermon: after the MP3 is uploaded, add it to data/sermons.json.
// The commit makes Netlify rebuild the site and podcast feed (about a minute).
import { adminHandler, isoDate, text, slugify, mediaUrl, readJsonFile, commit, toJson, HttpError } from "../lib/shared.mjs";

export default adminHandler(async body => {
  const date = isoDate(body.date, "Sermon date");
  const title = text(body.title, "Title");
  const speaker = text(body.speaker, "Speaker", { max: 80 });
  const passage = text(body.passage, "Scripture", { required: false, max: 120 });
  const by = text(body.by, "Your name", { max: 60 });
  const key = String(body.key || "");
  if (!/^sermons\/\d{4}\/[\w.-]+\.mp3$/.test(key)) throw new HttpError(400, "Upload the audio file first.");

  const audio = mediaUrl(key);
  const head = await fetch(audio, { method: "HEAD" });
  if (!head.ok) throw new HttpError(400, "The audio file didn't finish uploading. Please try again.");
  const size = Number(head.headers.get("content-length")) || Number(body.size) || 0;
  const secs = Math.round(Number(body.duration) || 0);
  const length = secs ? new Date(secs * 1000).toISOString().slice(11, 19) : "";

  // guid = the episode's permanent ID in podcast apps; it must never change.
  const guid = `mtzion-${date}-${slugify(title)}`;
  const entry = { date, title, speaker, type: "Sunday Message", passage, length, audio, size, guid };
  await commit(`Add sermon: ${title} (${speaker}, ${date}) — posted by ${by}`, async () => {
    const list = (await readJsonFile("data/sermons.json")).filter(s => s.audio !== audio);
    list.push(entry);
    list.sort((a, b) => b.date.localeCompare(a.date));
    return [{ path: "data/sermons.json", content: toJson(list) }];
  });
  return { ok: true, entry };
});
