// Confirms the admin password. The Admin page calls this when someone signs in.
import { adminHandler } from "../lib/shared.mjs";

export default adminHandler(async () => ({ ok: true }));
