// Retired Oct 2026: the church decided not to post bulletin PDFs (they include
// birthdays, announcements, and offering totals). Bulletins are now the service
// details only, stored as data in data/bulletins.json. Kept as a stub so an old
// cached Admin page gets a clear message instead of publishing a PDF.
import { adminHandler, HttpError } from "../lib/shared.mjs";

export default adminHandler(async () => {
  throw new HttpError(410, "Bulletin PDFs are no longer posted. The service details are added automatically from the weekly bulletin email.");
});
