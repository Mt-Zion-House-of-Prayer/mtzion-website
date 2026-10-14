// Shared helpers for the admin functions in netlify/functions/.
//
// Settings come from Netlify environment variables (Project configuration →
// Environment variables). None of them are ever sent to the browser.
//   ADMIN_PASSWORD        shared password for the Admin page
//   GITHUB_TOKEN          fine-grained token: Contents read/write on mtzion-website only
//   GITHUB_REPO           optional, default "Mt-Zion-House-of-Prayer/mtzion-website"
//   GITHUB_BRANCH         optional, default "main" (use another branch to test safely)
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//                         Cloudflare R2 bucket that holds sermon audio
//   MEDIA_BASE_URL        public address of that bucket, e.g. https://media.mtzionhouseofprayer.org

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const env = name => process.env[name] || "";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Wraps a handler: POST only, checks the password, turns errors into JSON.
export function adminHandler(fn) {
  return async req => {
    try {
      if (req.method !== "POST") throw new HttpError(405, "Use POST.");
      await checkPassword(req.headers.get("x-admin-password") || "");
      const body = await req.json().catch(() => ({}));
      return json(await fn(body));
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong on the server. Try again, or ask for help." }, 500);
    }
  };
}

async function checkPassword(given) {
  const real = env("ADMIN_PASSWORD");
  if (!real) throw new HttpError(500, "The admin password hasn't been set up yet.");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(real).digest();
  if (!timingSafeEqual(a, b)) {
    await new Promise(r => setTimeout(r, 1000)); // slow down guessing
    throw new HttpError(401, "Wrong password.");
  }
}

// ---------- validation ----------

export function isoDate(value, label = "Date") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || isNaN(Date.parse(value)))
    throw new HttpError(400, `${label} is missing or not a real date.`);
  return value;
}

export function text(value, label, { required = true, max = 200 } = {}) {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !s) throw new HttpError(400, `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} is too long.`);
  return s;
}

export function slugify(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "sermon";
}

// ---------- GitHub: read a file, commit several files at once ----------

const repo = () => env("GITHUB_REPO") || "Mt-Zion-House-of-Prayer/mtzion-website";
const branch = () => env("GITHUB_BRANCH") || "main";

async function gh(path, opts = {}) {
  const token = env("GITHUB_TOKEN");
  if (!token) throw new HttpError(500, "The GitHub connection hasn't been set up yet.");
  const res = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
    ...opts,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`GitHub ${opts.method || "GET"} ${path} → ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function readJsonFile(path) {
  const f = await gh(`/contents/${path}?ref=${encodeURIComponent(branch())}`);
  return JSON.parse(Buffer.from(f.content, "base64").toString("utf8"));
}

// files: [{ path, content: string|Buffer } | { path, delete: true }]
// `build` is called with fresh data each attempt so a concurrent edit isn't lost.
export async function commit(message, build) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh(`/git/ref/heads/${branch()}`);
    const parent = ref.object.sha;
    const base = await gh(`/git/commits/${parent}`);
    const files = await build();
    const tree = [];
    for (const f of files) {
      if (f.delete) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
      const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, "utf8");
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }) });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] }) });
    try {
      await gh(`/git/refs/heads/${branch()}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
      return c.sha;
    } catch (err) {
      if (err.status !== 422) throw err; // 422 = someone else committed first; rebuild and retry
    }
  }
  throw new HttpError(409, "The site was busy saving another change. Please try again.");
}

export const toJson = data => JSON.stringify(data, null, 1) + "\n";

// ---------- Cloudflare R2: presigned upload links (AWS Signature V4) ----------

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const sha256hex = s => createHash("sha256").update(s).digest("hex");
const hmac = (key, s) => createHmac("sha256", key).update(s).digest();

export function presignPut(key, expiresSeconds = 3600) {
  for (const n of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"])
    if (!env(n)) throw new HttpError(500, "Audio storage hasn't been set up yet.");
  const host = `${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const path = `/${env("R2_BUCKET")}/${key.split("/").map(enc).join("/")}`;
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${env("R2_ACCESS_KEY_ID")}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ].map(([k, v]) => `${enc(k)}=${enc(v)}`).sort().join("&");
  const canonical = ["PUT", path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonical)].join("\n");
  let k = hmac("AWS4" + env("R2_SECRET_ACCESS_KEY"), day);
  for (const part of ["auto", "s3", "aws4_request"]) k = hmac(k, part);
  const sig = createHmac("sha256", k).update(toSign).digest("hex");
  return `https://${host}${path}?${query}&X-Amz-Signature=${sig}`;
}

export function mediaUrl(key) {
  const base = env("MEDIA_BASE_URL").replace(/\/+$/, "");
  if (!base) throw new HttpError(500, "Audio storage hasn't been set up yet.");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
