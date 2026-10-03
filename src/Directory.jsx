// A directory of the work and the person behind it, laid out as grey tiles
// on a four column grid. The grid follows the reference: the columns are
// its own widths, the tiles stand 4px apart, and the projects stack down the
// first column before the about, links and history rows open out across the
// page. The small releases along the foot are one tile to a line.
//
// What it says comes from Sanity, edited in mk-port's studio: a document to
// each project, and one profile for everything about the person. Until that
// has come there is nothing on the page but its ground.
//
// The icons are plain circles for now, until the real ones are drawn.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchDirectory } from "./directory.js";
import { float } from "./float.js";
import { arrange } from "./arrange.js";
import { glassTaps, isMuted, setMuted } from "./glass.js";
import { lookAt } from "./eye.js";
import { stripeSteps } from "./stripes.js";
import { openTile, closeTile, PHONE } from "./open.js";
import Carousel from "./Carousel.jsx";
import bioIcon from "./assets/icons/bio.svg?raw";
import linksIcon from "./assets/icons/links.svg?raw";
import educationIcon from "./assets/icons/education.svg?raw";
import experienceIcon from "./assets/icons/experience.svg?raw";
import floatIcon from "./assets/icons/float.svg?raw";

// The rows' heights are the layout's own, not any project's: they are the
// reference's, by place down the page, and whichever projects come in that
// order fill them. The projects stacking down the left go tall, then as tall
// as their words, then middling twice. The about row is tall as well.
// Everything else
// is as tall as its words. The numbers are the rows' heights in the
// reference, in pixels, the first taken down a touch from its 181.
const PROJECT_ROWS = [165, null, 88, 52];
const ABOUT_ROW = 248;
const rowFor = (i) => PROJECT_ROWS[i];

// The rows down the page on a wide screen, one to each tile down the first
// column. A tall row is given a share of the height in proportion to how
// tall it is in the reference, and never less than its words need; every
// other row is as tall as what is in it. At the reference's own window that
// comes to its heights exactly. At any other, the tall rows give or take
// the difference between them, so the page ends as far above the foot of
// the window as it starts below the top, rather than running off the
// bottom.
const share = (height) =>
  height ? `minmax(min-content, ${height}fr)` : "auto";
const rowsFor = (stacked) =>
  [
    ...stacked.map((_, i) => share(rowFor(i))),
    "auto", // the last two projects, side by side
    share(ABOUT_ROW), // about, and the links beside it
    "auto", // education, experience and the button
    "auto", // mixes and releases
  ].join(" ");

// A tile's own style: the height of its row, for a narrow screen, where the
// page scrolls and a tall row's tile keeps the reference's height as it is;
// and its turn to fade in when the page arrives. A turn is how many rows the
// tile is from the about row, which comes first, and how many rows out its
// side of the page goes, so the last two on each side can ease off.
const tileStyle = (turn, height) => ({
  ...(height ? { "--tall": `${height}px` } : {}),
  ...(turn ? { "--in": turn.at } : {}),
  ...(turn?.last !== undefined ? { "--in-last": turn.last } : {}),
  ...(turn?.down !== undefined ? { "--down": turn.down } : {}),
});

// The about text, a paragraph to a block, with its bold runs picked out.
// Only paragraphs and bold can be written in the studio, so that is all
// there is to draw.
function Blocks({ value }) {
  return (value ?? []).map((block) => (
    <p key={block._key}>
      {(block.children ?? []).map((span) =>
        span.marks?.includes("strong") ? (
          <strong key={span._key}>{span.text}</strong>
        ) : (
          span.text
        ),
      )}
    </p>
  ));
}

// A link out, with the arrow the reference puts after it. Anything without
// somewhere to go keeps the arrow but is left as plain text. Its words are
// kept apart from the arrow, so where the link has to stay on one line they
// can be cut short while the arrow stays at the end.
function Out({ href, children }) {
  const inner = (
    <>
      <span className="dir-out-words">{children}</span>{" "}
      <span className="dir-arrow">↘</span>
    </>
  );
  return href ? (
    <a className="dir-out" href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <span className="dir-out">{inner}</span>
  );
}

// Keeps a project's words inside its tile, where the tile is held to a
// height and cuts off what will not fit: the services are let go from the
// last up until the rest fit. Looked at again whenever the tile changes
// size, every service shown first, and once the type has come in.
function useServicesThatFit(tile) {
  useLayoutEffect(() => {
    const el = tile.current;
    let gone = false;
    const fit = () => {
      if (gone) return;
      const services = [...el.querySelectorAll(".dir-service")];
      for (const service of services) service.style.display = "";
      if (getComputedStyle(el).overflowY !== "hidden") return;
      for (let i = services.length - 1; i >= 0; i--) {
        if (el.scrollHeight <= el.clientHeight + 1) break;
        services[i].style.display = "none";
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    const watcher = new ResizeObserver(fit);
    watcher.observe(el);
    return () => {
      gone = true;
      watcher.disconnect();
    };
  });
}

// An "i", before a piece's caption title, to say it tells you about the
// piece: the letter in a ring, both in the ink of the words. The letter is
// the one on an information sign, a round dot over a stem with a flag at
// its head and a slab at its foot.
function Info() {
  return (
    <svg className="dir-info" viewBox="0 0 16 16" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8" cy="5.11" r="1.23" fill="currentColor" />
      <path
        fill="currentColor"
        d="M6.15 6.77H9.31V11.58H9.85V12.19H6.15V11.58H6.67V7.26H6.15Z"
      />
    </svg>
  );
}

// The mark on a select work's tile. Neither of the page's typefaces has a
// star, and one borrowed from whatever the system has would look different
// on every machine, so it is drawn, in the ink of the words about it.
function Star() {
  return (
    <svg className="dir-star" viewBox="0 0 24 24" role="img">
      <title>Select work</title>
      <path
        fill="currentColor"
        d="M12 1.8l3.1 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1-5.4-4.9 7.2-.8z"
      />
    </svg>
  );
}

// A project's kind in two: up to the first "+" or "/", and from there on,
// which a phone leaves off. "Data Maison + Fashion Editorial" is "Data
// Maison" there.
function Kind({ text }) {
  const at = text?.search(/\s*[+/]/) ?? -1;
  if (at <= 0) return <p className="dir-kind">{text}</p>;
  return (
    <p className="dir-kind">
      {text.slice(0, at)}
      <span className="dir-kind-rest">{text.slice(at)}</span>
    </p>
  );
}

// A project: who it was for down the left half, what it was and what was
// done down the right, each with its last lines held to the foot.
function Project({
  name,
  slug,
  client,
  kind,
  services,
  link,
  status,
  striped,
  selected,
  turn,
  height,
  chosen,
  onPress,
  place,
  className = "",
}) {
  const tile = useRef(null);
  useServicesThatFit(tile);
  return (
    <article
      ref={tile}
      className={`dir-tile dir-project ${striped ? "dir-striped" : ""} ${selected ? "dir-selected" : ""} ${chosen ? "dir-chosen" : ""} ${className}`}
      style={{ ...tileStyle(turn, height), ...place }}
      data-slug={slug}
      // Pressing a tile opens it; pressing its link follows the link. A
      // striped tile is work that cannot be shown, so it does not open.
      onClick={(e) =>
        !striped && !e.target.closest("a") && onPress?.(e.currentTarget)
      }
    >
      {/* A striped tile's stripes, on a layer of their own behind the
          words, so they can be stepped along (see stripes.js). */}
      {striped && <span className="dir-stripes" aria-hidden="true" />}
      {selected && <Star />}
      <div className="dir-half">
        <div>
          <h2 className="dir-name">
            {/* Out of sight until the tile is open, when it says that
                pressing the tile goes back. */}
            <span className="dir-arrow dir-back" aria-hidden="true">
              {"\u2190\u00a0"}
            </span>
            {name}
          </h2>
          {client && <p className="dir-soft dir-fades">{client}</p>}
        </div>
        <p className="dir-foot dir-fades">
          {link?.label ? <Out href={link.url}>{link.label}</Out> : status}
        </p>
      </div>
      <div className="dir-half">
        <Kind text={kind} />
        <div className="dir-foot dir-soft dir-fades">
          {(services ?? []).map((service) => (
            <p key={service} className="dir-service">
              {service}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}

// The white tiles: an icon over a heading, then whatever the tile holds.
// One that does something when it is pressed is a button, so it can be
// reached and pressed from the keyboard as well.
// Its icon, if it has one, sits at the top, and its heading, if it has one,
// under that.
function Card({
  title,
  icon,
  turn,
  height,
  className = "",
  children,
  ...press
}) {
  const Tile = press.onClick ? "button" : "section";
  // A heading cannot go inside a button, so a button's is plain text.
  const Heading = press.onClick ? "span" : "h2";
  return (
    <Tile
      {...(press.onClick ? { type: "button", ...press } : {})}
      className={`dir-tile dir-card ${className}`}
      style={tileStyle(turn, height)}
    >
      {icon && (
        <span
          className="dir-icon"
          aria-hidden="true"
          // The drawing itself, rather than a picture of it, so its pale
          // marks can take the tile's colour as it changes.
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      )}
      {title && <Heading className="dir-heading">{title}</Heading>}
      {children}
    </Tile>
  );
}

// The links, a column of three at a time.
const LINKS_DOWN = 3;
const inThrees = (links) =>
  Array.from({ length: Math.ceil(links.length / LINKS_DOWN) }, (_, i) =>
    links.slice(i * LINKS_DOWN, (i + 1) * LINKS_DOWN),
  );

// A column of links. One with fewer than three is made up with empty
// places, so its links stand level with those in the column before it.
function LinkList({ links, style }) {
  const empty = LINKS_DOWN - links.length;
  return (
    <ul style={style}>
      {links.map(({ _key, label, url }) => (
        <li key={_key}>
          <Out href={url}>{label}</Out>
        </li>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li key={`empty-${i}`} className="dir-link-empty" aria-hidden="true" />
      ))}
    </ul>
  );
}

function History({ entries }) {
  return (
    <div className="dir-history">
      {(entries ?? []).map(({ _key, name, lines, years }) => (
        <div key={_key}>
          <strong>{name}</strong>
          {(lines ?? []).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="dir-muted">{years}</p>
        </div>
      ))}
    </div>
  );
}

// The panel under an open project's bar, with what the studio says about
// it: a paragraph to a block, its bold picked out, as the about card has.
// One written before the studio could bold it is plain text, a paragraph
// to each run between blank lines. It sits a gap under the bar and is as
// wide as it.
// The project's link, if it has one, comes at the foot, as it does on the
// tile.
function Description({ text, link, bar, onMeasure }) {
  const box = useRef(null);
  // How tall it is, for what goes under it on a phone.
  useEffect(() => {
    const watcher = new ResizeObserver(() =>
      onMeasure(box.current.offsetHeight),
    );
    watcher.observe(box.current);
    return () => {
      watcher.disconnect();
      onMeasure(0);
    };
  }, [onMeasure]);
  // Whether the page has been scrolled on past it, into the work, as it
  // can be on a phone, where it fades away until the page is back up.
  const [past, setPast] = useState(false);
  useEffect(() => {
    const look = () => setPast(window.scrollY > PAST);
    look();
    window.addEventListener("scroll", look, { passive: true });
    return () => window.removeEventListener("scroll", look);
  }, []);
  const paragraphs = Array.isArray(text)
    ? null
    : (text ?? "")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
  return (
    <section
      ref={box}
      className={`dir-tile dir-description${past ? " dir-past-by" : ""}`}
      style={{
        top: bar.top + bar.height + bar.gap,
        left: bar.left,
        width: bar.width,
      }}
    >
      {!paragraphs && <Blocks value={text} />}
      {paragraphs?.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {link?.label && (
        <p className="dir-description-link">
          <Out href={link.url}>{link.label}</Out>
        </p>
      )}
    </section>
  );
}

// A column of lines along the foot. Each line reads as a row of its own, so
// each takes the turn after the one above it. A line with somewhere to go
// is a link from end to end, with its arrow at the far end; one without
// keeps the arrow but goes nowhere.
// Anything `after` the lines is drawn as one more of them, and given its
// style, which takes its turn after theirs.
function Lines({ items, turn, after, className = "" }) {
  const styleAt = (i) =>
    tileStyle({
      ...turn,
      at: turn.at + i,
      ...(turn.down !== undefined ? { down: turn.down + i } : {}),
    });
  return (
    <div className={`dir-lines ${className}`}>
      {(items ?? []).map(({ _key, tag, title, with: others, date, url }, i) => {
        const Line = url ? "a" : "p";
        return (
          <Line
            key={_key}
            className="dir-tile dir-line"
            style={styleAt(i)}
            {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
          >
            <span>
              <span className="dir-muted">{tag}</span> <strong>{title}</strong>
              {others && ` ${others}`} <span className="dir-date">{date}</span>
            </span>
            <span className="dir-arrow dir-line-arrow" aria-hidden="true">
              ↘
            </span>
          </Line>
        );
      })}
      {after?.(styleAt(items?.length ?? 0))}
    </div>
  );
}

// A speaker, for the sound line: with its sound coming out of it, or
// crossed out. Drawn, as the star is, in the ink of the words beside it.
function Speaker({ off }) {
  return (
    <svg className="dir-speaker" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M1.5 5.5h3l4-3.5v12l-4-3.5h-3z" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {off ? (
          <path d="M11 6l4 4M15 6l-4 4" />
        ) : (
          <>
            <path d="M11 5.5a3.5 3.5 0 0 1 0 5" />
            <path d="M13 3.5a6.5 6.5 0 0 1 0 9" />
          </>
        )}
      </g>
    </svg>
  );
}

// The line that turns the page's sound off and on, saying which it will
// do, with a speaker to match: crossed out to mute it, sounding to unmute
// it.
function SoundLine({ style }) {
  const [off, setOff] = useState(isMuted);
  return (
    <button
      type="button"
      className="dir-tile dir-line dir-sound"
      style={style}
      onClick={() => {
        setMuted(!off);
        setOff(!off);
      }}
    >
      <Speaker off={!off} />
      <strong>
        {off ? "Unmute sound" : "Mute sound"}
        {/* Unseen, but the line is as tall as one with an arrow. */}
        <span className="dir-arrow dir-sound-strut" aria-hidden="true">
          ↘
        </span>
      </strong>
    </button>
  );
}

// A project's address is its slug, as a path of the site's own, so an open
// project can be linked to, kept in the history, and come back to: /atm.
// The window's title names it while it is open.
const slugInAddress = () =>
  decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ""));
const SITE_TITLE = document.title;

// A press that moves further than this, in pixels, was a drag of the tile
// rather than a press of it.
const PRESS_SLOP = 5;
// What the float button can do with the tiles, each in turn.
const MODES = ["float", "gravity", "arrange"];
// How far the page is scrolled past an open project's description, in
// pixels, before it fades.
const PAST = 8;

function Directory() {
  const [content, setContent] = useState(null);
  // Whether the tiles have been let go, and how: to float about the page,
  // to fall to the foot of it, or to be shuffled into a new arrangement.
  // Each time they go it is the next of them, round and round.
  const [floating, setFloating] = useState(false);
  const nextMode = useRef(0);
  const root = useRef(null);
  const pressedAt = useRef(null);
  const grabbedAt = useRef(null);
  // The project that is open, if one is, and whether its work is up yet,
  // which is once its tile has reached the top of the page. Opening and
  // closing take a moment, and a press in the middle of one is let pass.
  const [opened, setOpened] = useState(null);
  // Once the work is up, where the open tile has come to rest, for what is
  // set under it; nothing while it is not.
  const [showing, setShowing] = useState(null);
  // Where the open tile is going to rest, known from the moment it is
  // pressed, so its work can start loading, unseen, while the tile moves.
  const [bar, setBar] = useState(null);
  // How tall the open project's description is, while it is up.
  const [said, setSaid] = useState(0);
  // Which of the open project's pieces is on show, for its caption.
  const [piece, setPiece] = useState(0);
  const openedTile = useRef(null);
  const moving = useRef(false);
  // Whether the page has gone dark behind an open project that asks for it:
  // from the moment it is pressed until the moment it is closed.
  const [dark, setDark] = useState(false);
  // Whether the page was arrived at by a project's address, which it opens
  // at once, the page's own coming in left out; and, until it is open,
  // everything but that project is kept out of sight.
  const [landed, setLanded] = useState(() => Boolean(slugInAddress()));
  const [landing, setLanding] = useState(landed);

  // Opening and closing put the project's address in the history, unless
  // it was the address that asked for it, which is already there.
  const open = async (
    project,
    tile,
    { fromAddress = false, atOnce = false } = {},
  ) => {
    if (moving.current || floating) return;
    moving.current = true;
    if (!fromAddress) window.history.pushState(null, "", `/${project.slug}`);
    setOpened(project);
    setPiece(0);
    setDark(Boolean(project.darkBackground));
    openedTile.current = await openTile(root.current, tile, setBar, {
      atOnce,
    });
    setShowing(openedTile.current.bar);
    setLanding(false);
    moving.current = false;
  };
  const close = async ({ fromAddress = false } = {}) => {
    if (moving.current || !openedTile.current) return;
    moving.current = true;
    if (!fromAddress) window.history.pushState(null, "", "/");
    setShowing(null);
    setBar(null);
    setDark(false);
    await closeTile(openedTile.current);
    openedTile.current = null;
    setOpened(null);
    moving.current = false;
  };
  // Pressing the open tile again closes it, as Escape does.
  const press = (project, tile) =>
    opened ? opened._id === project._id && close() : open(project, tile);

  // Opens the project an address names, if there is one to open: a striped
  // one cannot be, and an address for nothing is put back to the page's own.
  const openFromAddress = ({ atOnce = false } = {}) => {
    const slug = slugInAddress();
    if (!slug) return;
    const project = content.projects.find((p) => p.slug === slug);
    const tile = root.current?.querySelector(
      `[data-slug="${CSS.escape(slug)}"]`,
    );
    if (!project || project.striped || !tile) {
      window.history.replaceState(null, "", "/");
      // Nothing to open after all, so the page comes in as it would.
      setLanding(false);
      setLanded(false);
      return;
    }
    open(project, tile, { fromAddress: true, atOnce });
  };

  // On a phone, where the page scrolls through an open project's work, it
  // starts at the description once it is up, however the page was moved
  // while the tile was on its way. The page only catches each piece as it
  // is scrolled from the first touch on, so nothing catches it on the way
  // down to a piece by itself in the meantime, as the work loads in and
  // takes its shape.
  useEffect(() => {
    if (!showing || !window.matchMedia(PHONE).matches) return undefined;
    window.scrollTo({ top: 0 });
    const page = document.documentElement;
    const snap = () => page.classList.add("dir-snapping");
    window.addEventListener("touchstart", snap, { once: true, passive: true });
    window.addEventListener("wheel", snap, { once: true, passive: true });
    return () => {
      window.removeEventListener("touchstart", snap);
      window.removeEventListener("wheel", snap);
      page.classList.remove("dir-snapping");
    };
  }, [showing]);

  // The window's title names the open project, if one is.
  useEffect(() => {
    document.title = opened
      ? `${opened.name} \u2014 ${SITE_TITLE}`
      : SITE_TITLE;
  }, [opened]);

  // Arriving at a project's address opens it, once the page has been drawn.
  const arrived = useRef(false);
  useEffect(() => {
    if (!content || arrived.current) return undefined;
    arrived.current = true;
    const frame = requestAnimationFrame(() =>
      openFromAddress({ atOnce: true }),
    );
    return () => cancelAnimationFrame(frame);
  });

  // The browser's back and forward go between the page and the projects
  // opened on it.
  useEffect(() => {
    if (!content) return undefined;
    const moved = async () => {
      if (opened && opened.slug === slugInAddress()) return;
      if (opened) await close({ fromAddress: true });
      openFromAddress();
    };
    window.addEventListener("popstate", moved);
    return () => window.removeEventListener("popstate", moved);
  });

  useEffect(() => {
    if (!opened) return undefined;
    const escape = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  });

  // A striped tile's stripes step along as it is come onto or pressed.
  useEffect(() => {
    if (!content) return undefined;
    return stripeSteps(root.current);
  }, [content]);

  // The eye on the about card looks towards the pointer.
  useEffect(() => {
    if (!content) return undefined;
    return lookAt(root.current.querySelector(".dir-about .dir-pupil"));
  }, [content]);

  // A tap on glass as the pointer comes onto a tile, and as one is pressed.
  useEffect(() => {
    if (!content) return undefined;
    return glassTaps(root.current);
  }, [content]);

  useEffect(() => {
    if (!floating) return undefined;
    if (floating === "arrange") return arrange(root.current);
    return float(root.current, { gravity: floating === "gravity" });
  }, [floating]);

  // A browser can leave a tile marked as under the pointer when the page
  // loses the pointer without it moving: a link opened in a new tab, a
  // switch to another window, the pointer leaving the window. It only puts
  // that right when the pointer next moves. So as soon as the page loses
  // the pointer it is marked as resting, which holds every hover off, and
  // the mark comes off at the pointer's next move, by when the browser has
  // caught up.
  useEffect(() => {
    const page = root.current;
    if (!page) return undefined;
    const rest = () => page.classList.add("dir-idle");
    const wake = () => page.classList.remove("dir-idle");
    const hidden = () => document.hidden && rest();
    const left = (e) => !e.relatedTarget && rest();
    window.addEventListener("blur", rest);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("mouseout", left);
    document.addEventListener("pointermove", wake);
    return () => {
      window.removeEventListener("blur", rest);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("mouseout", left);
      document.removeEventListener("pointermove", wake);
    };
  }, [content]);

  // The float button floats with the rest, and can be picked up and thrown
  // like them, so letting go of it at the end of a throw is not taken for a
  // press of it.
  // A tile that is a link, picked up and thrown while the tiles are
  // floating, would be followed as it is let go. So any press that moved
  // further than a press does is kept from reaching whatever it was on.
  const dragIsNotAClick = {
    onPointerDownCapture: (e) => {
      grabbedAt.current = [e.clientX, e.clientY];
    },
    onClickCapture: (e) => {
      const at = grabbedAt.current;
      grabbedAt.current = null;
      if (at && Math.hypot(e.clientX - at[0], e.clientY - at[1]) > PRESS_SLOP) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  const floatButton = {
    onPointerDown: (e) => {
      pressedAt.current = [e.clientX, e.clientY];
    },
    onClick: (e) => {
      const at = pressedAt.current;
      pressedAt.current = null;
      const moved = at && Math.hypot(e.clientX - at[0], e.clientY - at[1]);
      if (moved > PRESS_SLOP) return;
      if (floating) {
        setFloating(false);
        return;
      }
      setFloating(MODES[nextMode.current]);
      nextMode.current = (nextMode.current + 1) % MODES.length;
    },
    "aria-pressed": Boolean(floating),
  };

  useEffect(() => {
    const stop = new AbortController();
    fetchDirectory(stop.signal)
      .then(setContent)
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("The directory could not be read", error);
        }
      });
    return () => stop.abort();
  }, []);

  if (!content) {
    return <div className="directory" />;
  }

  // The projects stack down the first column, four of them, and the next
  // goes under them, so no column has more than five. The rest go beside
  // them, filling each column after the first from its foot up: the second
  // first, beside the fifth and then up past the fourth to the top, then
  // the third, then the fourth, which makes room for twenty. The page keeps
  // its rows whatever the count, so with too few to fill the stacked rows,
  // the projects take the rows in order, at their own heights. Only the
  // first six have a say in how tall the rows are, as in the reference;
  // any after them fill the rows they are given, whatever is in them.
  const { projects, profile, quote } = content;
  const stacked = projects.slice(0, PROJECT_ROWS.length);
  const left = projects[PROJECT_ROWS.length];
  const beside = projects.slice(PROJECT_ROWS.length + 1);
  const perColumn = PROJECT_ROWS.length + 1;
  const placeBeside = (i) => ({
    "--col": 2 + Math.floor(i / perColumn),
    "--row": perColumn - (i % perColumn),
  });

  // The rows, counted down the page, and how many each is from the about
  // row, which fades in first; the rest follow it outwards, a row at a time
  // either way.
  const aboutRow = stacked.length + 2;
  // Above the about row the rows are the projects, the top one furthest
  // out. Below it are the history row and then the lines along the foot,
  // a row each, the longer column's last line furthest out.
  // The releases' column has the sound line at its foot as well.
  const lines = Math.max(
    profile.mixes?.length ?? 0,
    (profile.releases?.length ?? 0) + 1,
  );
  const above = (row) => ({ at: aboutRow - row, last: aboutRow - 1 });
  const below = (at) => ({ at, last: 1 + lines });
  // On a phone, where the page is one column, they come in from the top
  // down instead, each tile after the one above it: the about card, the
  // projects, the education and experience, the lines along the foot, a
  // column after the other, and the links last. The float button is not
  // shown there.
  const mixes = profile.mixes?.length ?? 0;
  const releases = (profile.releases?.length ?? 0) + 1;
  const pastAt = 1 + projects.length;
  const footAt = pastAt + 2;
  const down = (turn, at) => ({ ...turn, down: at });

  // The open project's link goes at the foot of its description on a phone,
  // where its tile has drawn down to a bar without it; on a wider screen
  // the tile keeps it, and the description goes without.
  const { title: pieceTitle, caption } = opened?.media?.[piece] ?? {};
  const saysLink = Boolean(
    opened?.link?.label && window.matchMedia(PHONE).matches,
  );

  return (
    <div
      ref={root}
      className={`directory ${opened ? "dir-open" : ""} ${showing ? "dir-shown" : ""} ${dark ? "dir-dark" : ""} ${landed ? "dir-landed" : ""} ${landing ? "dir-landing" : ""}`}
    >
      <div
        className="dir-grid"
        style={{ "--dir-rows": rowsFor(stacked) }}
        {...dragIsNotAClick}
      >
        {stacked.map((project, i) => (
          <Project
            key={project._id}
            {...project}
            turn={down(above(i + 1), 1 + i)}
            height={rowFor(i)}
            chosen={opened?._id === project._id}
            onPress={(tile) => press(project, tile)}
          />
        ))}
        {left && (
          <Project
            {...left}
            turn={down(above(aboutRow - 1), 1 + stacked.length)}
            chosen={opened?._id === left._id}
            onPress={(tile) => press(left, tile)}
          />
        )}
        {beside.map((project, i) => (
          <Project
            key={project._id}
            {...project}
            turn={down(above(placeBeside(i)["--row"]), 2 + stacked.length + i)}
            chosen={opened?._id === project._id}
            onPress={(tile) => press(project, tile)}
            place={placeBeside(i)}
            className={`dir-placed ${i > 0 ? "dir-fitted" : ""}`}
          />
        ))}

        <Card
          title={profile.name}
          icon={bioIcon}
          turn={{ at: 0, down: 0 }}
          height={ABOUT_ROW}
          className="dir-about"
        >
          <div className="dir-about-note">
            <Blocks value={profile.about} />
          </div>
        </Card>
        {/* An icon but no heading: the links say what they are, with their
            arrows after them, as the others on the page have. Three to a
            column, and any more in the next, over the float button's. */}
        <Card
          icon={linksIcon}
          turn={{ at: 0, down: footAt + mixes + releases }}
          className="dir-links"
        >
          {inThrees(profile.links ?? []).map((links, i) => (
            <LinkList
              key={links[0]._key}
              links={links}
              style={{ "--col": i + 1 }}
            />
          ))}
        </Card>

        <Card
          title="Education"
          icon={educationIcon}
          turn={down(below(1), pastAt)}
          className="dir-past"
        >
          <History entries={profile.education} />
        </Card>
        <Card
          title="Experience"
          icon={experienceIcon}
          turn={down(below(1), pastAt + 1)}
          className="dir-col-2 dir-past"
        >
          <History entries={profile.experience} />
        </Card>
        <Card
          title={quote ? `“${quote.text}”` : "#floatbutton"}
          icon={floatIcon}
          turn={below(1)}
          className="dir-col-3 dir-float"
          {...floatButton}
        >
          {quote?.by && (
            <span className="dir-muted dir-quote-by">— {quote.by}</span>
          )}
        </Card>

        <Lines items={profile.mixes} turn={down(below(2), footAt)} />
        <Lines
          items={profile.releases}
          turn={down(below(2), footAt + mixes)}
          after={(style) => <SoundLine style={style} />}
          className="dir-col-2"
        />

        {/* In the grid, though placed by hand rather than by it, so it is
            sized and set as every other tile is. */}
        {opened && showing && (opened.description || saysLink) && (
          <Description
            text={opened.description}
            link={saysLink ? opened.link : null}
            bar={showing}
            onMeasure={setSaid}
          />
        )}
        {/* The title and caption of the piece on show, under the
            description, on a screen wide enough; it comes up again as each
            piece does. */}
        {opened &&
          showing &&
          (pieceTitle || caption) &&
          !window.matchMedia(PHONE).matches && (
            <section
              key={piece}
              className="dir-tile dir-description dir-caption"
              style={{
                top:
                  showing.top +
                  showing.height +
                  showing.gap +
                  (said && said + showing.gap),
                left: showing.left,
                width: showing.width,
              }}
            >
              {pieceTitle && (
                <h3 className="dir-caption-title">
                  <Info />
                  {pieceTitle}
                </h3>
              )}
              {Array.isArray(caption) ? (
                <Blocks value={caption} />
              ) : (
                caption && <p>{caption}</p>
              )}
            </section>
          )}
      </div>
      {/* The open project's work, scrolled through a piece at a time,
          under the description on a phone,
          put in the moment the tile is pressed so it loads as the tile
          moves, and shown once it is there, beside the bar and description, a gap to their right and out to
          the page's right margin, each caught level with the bar. */}
      {opened && bar && (
        <Carousel
          project={opened}
          frame={
            window.matchMedia(PHONE).matches
              ? {
                  top:
                    bar.top + bar.height + bar.gap + (said && said + bar.gap),
                  left: bar.left,
                  right: bar.left,
                  // The description scrolls away, and each piece is caught
                  // under the bar, which stays.
                  catchAt: bar.top + bar.height + bar.gap,
                }
              : {
                  top: bar.top,
                  left: bar.left + bar.width + bar.gap,
                  right: bar.left,
                }
          }
          gap={bar.gap}
          shown={Boolean(showing)}
          onShowing={setPiece}
        />
      )}
    </div>
  );
}

export default Directory;
