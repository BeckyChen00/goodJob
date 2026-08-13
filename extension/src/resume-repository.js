import { importResumeDocument, resumeValues } from "./resume-schema.js";

export const REPOSITORY_RESUME_PATH = "resume-data/resume-profile.json";
export const MAX_REPOSITORY_RESUME_BYTES = 2_000_000;

function byteLength(source) {
  return typeof TextEncoder === "function"
    ? new TextEncoder().encode(source).byteLength
    : source.length * 2;
}

/** Parse repository text at the browser/runtime boundary before it reaches storage. */
export function loadRepositoryResume(source) {
  if (typeof source !== "string") throw new TypeError("repository resume must be JSON text");
  if (byteLength(source) > MAX_REPOSITORY_RESUME_BYTES) {
    throw new TypeError(`repository resume exceeds ${MAX_REPOSITORY_RESUME_BYTES} bytes`);
  }
  if (source.charCodeAt(0) === 0xfeff) throw new TypeError("repository resume must not contain a byte-order mark");
  return importResumeDocument(source);
}

/** Return the flat key-value shape consumed by the existing field matcher. */
export function repositoryResumeValues(source) {
  return resumeValues(loadRepositoryResume(source));
}

/** Fetch is injected so this module remains testable and works in extension pages. */
export async function fetchRepositoryResume(fetchLike, url = REPOSITORY_RESUME_PATH) {
  if (typeof fetchLike !== "function") throw new TypeError("fetchLike must be a function");
  const response = await fetchLike(url, { cache: "no-store" });
  if (!response || response.ok !== true || typeof response.text !== "function") {
    throw new Error(`unable to load repository resume from ${url}`);
  }
  return loadRepositoryResume(await response.text());
}
