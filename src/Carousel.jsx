// An open project's work on the directory, scrolled through a piece at a
// time. The pieces run down the page one under the next, beside the
// project's bar and description, which stay where they are over it all.
// Each is as wide as the room beside them and as tall as that makes it, up
// to 90vh, so a wide piece is not set in a tall box with nothing above and
// below it; only the grid's own gap comes between one piece and the next.
// They scroll past the edges of the window, and not of some box within it,
// so nothing is seen sliced off part way.
//
// A scroll is caught at the next piece, level with the bar, and goes no
// further, however hard the flick. A scroll anywhere on the page does the
// same, over the bar or the description as well, and so do the arrow keys.
//
// Only the piece in view plays; the others are held where they are, so a
// project of five videos is not playing five at once. Which piece is in
// view is told to `onShowing`, by its place in the list, for its caption.
//
// It is put on the page, unseen, as soon as the project is pressed, so the
// first piece is loading while the tile moves up, and it comes up once the
// tile is there. Each piece stays unseen until it has something to show,
// its first frame or the whole picture, and fades up then, rather than
// being seen to arrive a bit at a time. The first piece loads in full from
// the start, and each after it starts as soon as the one before it has
// something to show, without waiting to be scrolled to, so they do not all
// share the line at once, and each is there before it is scrolled to.

import { useEffect, useRef, useState } from "react";
import { loopAgain } from "./loopAgain.js";

// How far a scroll has to go, in pixels, to count as a step, and how long a
// pause in the scrolling ends a gesture, in milliseconds. These are for a
// scroll away from the pieces themselves, which is passed on to them.
const STEP = 40;
const GESTURE_GAP = 200;
// How much of a piece has to be in view for it to count as the one on show.
const IN_VIEW = 0.6;
// The widths a picture is asked of Sanity at, for the browser to choose
// the one that fits the room it has.
const WIDTHS = [640, 960, 1280, 1920, 2560];

// Each video's shape, once it has been seen, so the next time it is shown
// it is laid out that way from the start.
const shapes = new Map();

// A picture from Sanity's image pipeline, at a given width, in whatever
// format the browser takes best.
const sized = (url, width) => `${url}?w=${width}&auto=format&q=82`;
const fromSanity = (url) => url.includes("cdn.sanity.io/images/");

// A piece of work, unseen until it can be shown whole.
function Piece({ url, video, shape, first, width }) {
  const [ready, setReady] = useState(false);
  const shown = () => setReady(true);
  const className = `dir-carousel-piece${ready ? " dir-ready" : ""}`;

  if (video) {
    const known = shapes.get(url);
    return (
      <video
        className={className}
        style={known ? { aspectRatio: known } : undefined}
        // From just after its start, which has Safari on a phone fetch
        // and show its first frame before it is played, as it otherwise
        // leaves a video blank until then.
        src={`${url}#t=0.001`}
        muted
        loop
        playsInline
        preload={first ? "auto" : "metadata"}
        onLoadedMetadata={(e) => {
          const { videoWidth, videoHeight } = e.currentTarget;
          if (videoWidth) shapes.set(url, `${videoWidth} / ${videoHeight}`);
        }}
        onLoadedData={shown}
        onEnded={loopAgain}
      />
    );
  }

  const pipeline = fromSanity(url);
  return (
    <img
      className={className}
      style={
        shape ? { aspectRatio: `${shape.width} / ${shape.height}` } : undefined
      }
      src={pipeline ? sized(url, 1920) : url}
      srcSet={
        pipeline
          ? WIDTHS.map((w) => `${sized(url, w)} ${w}w`).join(", ")
          : undefined
      }
      sizes={pipeline ? `${Math.round(width)}px` : undefined}
      alt=""
      decoding="async"
      fetchPriority={first ? "high" : "auto"}
      onLoad={shown}
    />
  );
}

// `frame` is where the pieces go: how far down the first starts, which is
// also where each is caught, and how far in from the left and right they
// run, and, if it is not where the first starts, where each is caught.
// `gap` is the space between them. `shown` is whether it has come up.
function Carousel({ project, frame, gap, shown, onShowing }) {
  const media = project.media ?? [];
  const scroller = useRef(null);

  useEffect(() => {
    const list = scroller.current;
    if (!list) return undefined;

    const pieces = [...list.querySelectorAll(".dir-carousel-piece")];

    // Each piece in turn is loaded in full, and once it has something to
    // show, or cannot be loaded, the next one is started. A video told to
    // load in full after it was told not to is set loading again, which
    // Safari will not do by itself.
    const ready = (piece) =>
      piece.tagName === "VIDEO" ? piece.readyState >= 2 : piece.complete;
    const load = (i) => {
      const piece = pieces[i];
      if (!piece) return;
      if (piece.tagName === "VIDEO" && piece.preload !== "auto") {
        piece.preload = "auto";
        if (piece.readyState < 2) piece.load();
      }
      if (ready(piece)) {
        load(i + 1);
        return;
      }
      const then = () => {
        piece.removeEventListener("error", then);
        piece.removeEventListener(
          piece.tagName === "VIDEO" ? "loadeddata" : "load",
          then,
        );
        load(i + 1);
      };
      piece.addEventListener(
        piece.tagName === "VIDEO" ? "loadeddata" : "load",
        then,
      );
      piece.addEventListener("error", then);
    };
    load(0);

    // Whichever piece is mostly in view plays, and the rest wait. This
    // goes on while it is still unseen, so the first is already running
    // when it comes up.
    const watching = new IntersectionObserver(
      (entries) => {
        // Counted by how much is in view, not whether any is, so the next
        // piece showing its top under this one does not start as well.
        for (const { target, intersectionRatio } of entries) {
          const inView = intersectionRatio >= IN_VIEW;
          if (target.tagName !== "VIDEO") continue;
          if (inView) target.play().catch(() => {});
          else target.pause();
        }
      },
      // Measured against the window, which clips the pieces wherever
      // they scroll: within the list over the page, or with the page
      // itself on a phone.
      { threshold: IN_VIEW },
    );
    for (const piece of pieces) watching.observe(piece);
    return () => watching.disconnect();
  }, []);

  // Which piece is on show: the one nearest to where pieces are caught, as
  // the list is scrolled, told to `onShowing`. Only the list itself is
  // watched, which is what scrolls where the caption is shown.
  useEffect(() => {
    const list = scroller.current;
    if (!list || !onShowing) return undefined;
    let frame = 0;
    const pick = () => {
      frame = 0;
      const pieces = [...list.querySelectorAll(".dir-carousel-piece")];
      if (!pieces.length) return;
      const top = parseFloat(getComputedStyle(list).paddingTop);
      const off = (piece) => Math.abs(piece.offsetTop - top - list.scrollTop);
      let at = 0;
      pieces.forEach((piece, i) => {
        if (off(piece) < off(pieces[at])) at = i;
      });
      onShowing(at);
    };
    const scrolled = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    list.addEventListener("scroll", scrolled, { passive: true });
    pick();
    return () => {
      list.removeEventListener("scroll", scrolled);
      cancelAnimationFrame(frame);
    };
    // `onShowing` is a state setter, the same from one draw to the next.
  }, [onShowing]);

  useEffect(() => {
    const list = scroller.current;
    if (!list || !shown) return undefined;
    const pieces = [...list.querySelectorAll(".dir-carousel-piece")];

    // The piece nearest to being caught, and on to the next or the last.
    const go = (by) => {
      const top = parseFloat(getComputedStyle(list).paddingTop);
      const caughtAt = (piece) => piece.offsetTop - top;
      let at = 0;
      pieces.forEach((piece, i) => {
        const off = Math.abs(caughtAt(piece) - list.scrollTop);
        if (off < Math.abs(caughtAt(pieces[at]) - list.scrollTop)) at = i;
      });
      const next = pieces[Math.min(Math.max(at + by, 0), pieces.length - 1)];
      list.scrollTo({ top: caughtAt(next), behavior: "smooth" });
    };

    // Scrolling over what lies over the pieces, the bar and the
    // description, is passed on to them a step at a time: once for each
    // gesture, and a new gesture starts after a pause, so a trackpad's long
    // run of scrolling after a flick does not carry on through the pieces.
    const gesture = { sum: 0, last: 0, spent: false };
    const passOn = (e) => {
      if (list.contains(e.target)) return;
      if (e.timeStamp - gesture.last > GESTURE_GAP) {
        gesture.sum = 0;
        gesture.spent = false;
      }
      gesture.last = e.timeStamp;
      if (gesture.spent) return;
      gesture.sum += e.deltaY;
      if (Math.abs(gesture.sum) > STEP) {
        go(Math.sign(gesture.sum));
        gesture.spent = true;
      }
    };
    const keys = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") go(1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("wheel", passOn, { passive: true });
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("wheel", passOn);
      window.removeEventListener("keydown", keys);
    };
  }, [shown]);

  if (media.length === 0) return null;

  return (
    <div
      ref={scroller}
      className={`dir-carousel${shown ? " dir-carousel-shown" : ""}`}
      style={{
        "--top": `${frame.top}px`,
        "--catch": `${frame.catchAt ?? frame.top}px`,
        "--left": `${frame.left}px`,
        "--right": `${frame.right}px`,
        "--gap": `${gap}px`,
      }}
    >
      {/* Where each piece is caught somewhere other than where the first
          starts, as on a phone, the start is caught as well, which is
          where the page is scrolled back up to what is over the work. */}
      {frame.catchAt != null && <div className="dir-carousel-start" />}
      {media.map(({ url, video, shape }, i) => (
        <Piece
          key={url}
          url={url}
          video={video}
          shape={shape}
          first={i === 0}
          width={window.innerWidth - frame.left - frame.right}
        />
      ))}
    </div>
  );
}

export default Carousel;
