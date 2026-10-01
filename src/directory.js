// What the directory shows, read from Sanity: the projects, one tile each,
// and the profile, which is everything about the person rather than the
// work. Both are edited in mk-port's studio.
//
// The projects come newest first, by their dates, leaving out any hidden
// in the studio; on the dev server, where they can be looked over before
// they go up, the hidden ones are shown as well. Any without a date yet come
// after all those with one, and
// the studio's sort order settles between projects in the same month, or
// with no date at all.

import { query } from "./sanity.js";

const SHOWN = import.meta.env.DEV ? "" : " && hidden != true";

const QUERY = `{
  "projects": *[_type == "project"${SHOWN}]
    | order(defined(date) desc, date desc, order asc) {
    _id, name, "slug": slug.current, client, kind, description, services,
    link, status, striped,
    selected, darkBackground,
    "media": showcaseMedia[] {
      _type, "url": asset->url,
      "shape": asset->metadata.dimensions { width, height }
    }
  },
  "profile": *[_id == "profile"][0] {
    name, about, links, education, experience, mixes, releases, quotes
  }
}`;

// On the dev server the projects are made up to this many, by repeating
// them in order, to see how the page takes a long list. Each copy has an
// id and an address of its own, so it opens as a project of its own. Zero
// leaves them as they are.
const DEV_PROJECTS = 20;

const madeUpTo = (projects, count) =>
  Array.from({ length: Math.max(projects.length, count) }, (_, i) => {
    const project = projects[i % projects.length];
    const copy = Math.floor(i / projects.length);
    return copy
      ? {
          ...project,
          _id: `${project._id}-${copy}`,
          slug: `${project.slug}-${copy}`,
        }
      : project;
  });

// One of the profile's quotes, for the float button: picked once, as the
// page is read in, so it holds while the page is open and changes each time
// it is opened again.
const anyOf = (items) =>
  items?.length ? items[Math.floor(Math.random() * items.length)] : null;

export async function fetchDirectory(signal) {
  const { projects: read, profile } = await query(QUERY, signal);
  const projects =
    import.meta.env.DEV && read?.length ? madeUpTo(read, DEV_PROJECTS) : read;
  return {
    // A project's media as the showcase wants them: a video if it was
    // uploaded as a file, and a picture otherwise, with its shape, which
    // Sanity knows for a picture though not for a video.
    projects: (projects ?? []).map((project) => ({
      ...project,
      media: (project.media ?? [])
        .filter((item) => item.url)
        .map(({ _type, url, shape }) => ({
          url,
          video: _type === "file",
          shape: shape ?? null,
        })),
    })),
    profile: profile ?? {},
    quote: anyOf(profile?.quotes),
  };
}
