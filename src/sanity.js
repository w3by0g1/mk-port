// Reads from the Sanity dataset the site's content lives in, the same one
// mk-port's studio edits. The dataset is published, so this is a plain read
// with no key and nothing to keep secret; @sanity/client would make the same
// request, and this saves carrying it for a query or two.

const PROJECT = "sgenxzel";
const DATASET = "production";
const API = "2024-01-01";

const BASE = `https://${PROJECT}.apicdn.sanity.io/v${API}/data/query/${DATASET}`;

// What a GROQ query comes back with.
export async function query(groq, signal) {
  const response = await fetch(`${BASE}?query=${encodeURIComponent(groq)}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Sanity answered ${response.status}`);
  }
  const { result } = await response.json();
  return result;
}
