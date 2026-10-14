// Step 1 of adding a sermon: hand the browser a one-hour link to upload the MP3
// straight to audio storage (the file is too big to pass through this function).
import { adminHandler, isoDate, text, slugify, presignPut, mediaUrl, HttpError } from "../lib/shared.mjs";

export default adminHandler(async body => {
  const date = isoDate(body.date, "Sermon date");
  const title = text(body.title, "Title");
  if (!/\.mp3$/i.test(body.filename || "")) throw new HttpError(400, "Please choose an MP3 file.");
  const key = `sermons/${date.slice(0, 4)}/${date}-${slugify(title)}.mp3`;
  return { key, uploadUrl: presignPut(key), publicUrl: mediaUrl(key) };
});
