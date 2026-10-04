// A tap on glass whenever the pointer comes onto a tile, and whenever a
// tile is pressed. Each tap rings at a note of C major seventh, C, E, G or
// B, picked at random and never the same twice running, and the faster the
// pointer comes onto a tile the harder it is struck: louder, brighter, and
// quicker to die away.
//
// The sound is made as it is played, not recorded: a few sine tones at the
// out of tune ratios a struck glass rings at, each dying away on its own,
// the higher ones sooner, and the faintest tick of noise for the moment of
// contact.
//
// While the tiles are loose, floating or falling, each knock of one into
// another, or into the edge of the page, is heard as well: lower, shorter
// and quieter, more a knock on wood than a tap on glass, though it keeps a
// little of the glass's ring, and as hard as the knock was.
//
// The page comes in with its sound off, and the visitor turns it on. On a
// phone it stays off: there is nothing to hover over there, and nothing to
// turn it on with.
//
// A browser keeps a page quiet until it has been pressed or typed into, so
// the taps start from the first press on; passing over the tiles before
// then makes no sound.

import { PHONE } from "./open.js";

// What a strike sounds like. Its ringing tones, each as a ratio to its
// note, how loud it is struck, and how long it rings, as a share of the
// note's ring; the higher ones are only brought out by a harder strike.
// How long the note rings, in seconds, struck gently and struck hard. How
// loud the hardest strike is, of the page's full volume, and the gentlest,
// as a share of the hardest. The tick of
// contact, as noise around a pitch, how loud, and for how long. And how
// much of it is sent to the room.
const GLASS = {
  partials: [
    { ratio: 1, level: 1, ring: 1 },
    { ratio: 2.76, level: 0.5, ring: 0.6 },
    { ratio: 5.4, level: 0.28, ring: 0.35 },
    { ratio: 8.93, level: 0.14, ring: 0.2 },
  ],
  ringSoft: 0.6,
  ringHard: 0.35,
  loudest: 0.22,
  gentlest: 0.15,
  tick: {
    pitch: (note) => Math.min(12000, note * 4),
    q: 1.5,
    level: 0.35,
    length: 0.015,
  },
  room: 1,
};
// A knock: the tones a wooden bar rings at, with a trace of the glass's
// over them, all gone in a tenth of a second or so; a duller thump of
// contact; a little quieter, as there are so many; and drier.
const KNOCK = {
  partials: [
    { ratio: 1, level: 1, ring: 1 },
    { ratio: 2.76, level: 0.16, ring: 0.5 },
    { ratio: 3.93, level: 0.3, ring: 0.4 },
    { ratio: 9.2, level: 0.08, ring: 0.2 },
  ],
  ringSoft: 0.16,
  ringHard: 0.1,
  loudest: 0.22,
  gentlest: 0.55,
  tick: { pitch: () => 900, q: 0.8, level: 0.6, length: 0.02 },
  room: 0.5,
};
// The notes a tap can ring at, in hertz: C major seventh, from C5 up to
// E7, high as glass rings, with an octave under that for the deeper taps.
const NOTES = [
  523.25, 659.26, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 1975.53, 2093.0,
  2637.02,
];
// The notes a striped tile rings at when it is pressed, being work that
// cannot be shown, and the cards that are only read, the bio, the links,
// the education and the experience: C minor seventh, C, E flat, G and B flat, an octave
// under the others, from C4 up to B flat 5; two of them, one straight after
// the other, SHUT_GAP seconds apart.
const SHUT_GAP = 0.05;
export const MINOR_TILES = ".dir-striped, .dir-about, .dir-links, .dir-past";
const SHUT_NOTES = [
  261.63, 311.13, 392.0, 466.16, 523.25, 622.25, 783.99, 932.33,
];
// A knock's notes: the same chord, lower, from C4 up to E5.
const KNOCK_NOTES = [261.63, 329.63, 392.0, 493.88, 523.25, 659.26];
// Knocks come no closer together than this, in seconds, unless harder than
// the last, and no more than this many are heard at once.
const KNOCK_GAP = 0.05;
const KNOCKS_AT_ONCE = 4;
// No ringing tone above this is played, as it would be too high to be
// heard, or for the sound to carry cleanly.
const HIGHEST_TONE = 16000;
// How fast the pointer is going, in pixels a millisecond, when it strikes
// as hard as it can; and the softest strike, however slowly it comes.
const HARDEST_SPEED = 2.5;
const SOFTEST = 0.08;
// A press strikes this hard.
const PRESS = 0.75;

// A touch of room round the taps: how long the room rings on, in seconds,
// and how much of it is heard against the taps themselves.
const ROOM = 1.6;
const ROOM_LEVEL = 0.18;

let context = null;

// Whether the sound is off, as it is until the visitor turns it on.
let muted = true;
export const isMuted = () => muted;
let out = null;
let room = null;
let noise = null;

// A room to ring in, made rather than recorded: noise in each ear, dying
// away over ROOM seconds, a little faster at first, after a moment's
// wait as an echo would.
const roomIn = (context) => {
  const rate = context.sampleRate;
  const wait = Math.floor(rate * 0.012);
  const length = Math.floor(rate * ROOM);
  const ring = context.createBuffer(2, length, rate);
  for (let ear = 0; ear < 2; ear++) {
    const samples = ring.getChannelData(ear);
    for (let i = wait; i < length; i++) {
      const left = 1 - (i - wait) / (length - wait);
      samples[i] = (Math.random() * 2 - 1) * Math.pow(left, 3);
    }
  }
  const convolver = context.createConvolver();
  convolver.buffer = ring;
  return convolver;
};

// The sound starts at the first press, the soonest a browser allows it.
// It takes a moment to start, and gives back when it has.
const wake = () => {
  if (!context) {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    context = new Context();
    build();
  }
  return context.state === "running" ? Promise.resolve() : context.resume();
};

// What every strike is played through.
function build() {
  // Many taps at once are held together rather than let clip.
  out = context.createDynamicsCompressor();
  out.connect(context.destination);
  // Every tap is sent to the room as well, quietly.
  const reverb = roomIn(context);
  room = context.createGain();
  room.gain.value = ROOM_LEVEL;
  room.connect(reverb).connect(out);
  // A twentieth of a second of noise, kept for every tick.
  noise = context.createBuffer(1, context.sampleRate / 20, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  if (import.meta.hot) window.__glassSound = { context, out, muted };
}

// On the dev server, where this file is run again each time it is edited,
// the new one takes over the old one's sound, already woken, so it is not
// lost to the browser's rule until the page is pressed again; only what it
// is played through is made anew, as that may be what was edited. It is
// kept on the window, as this file is run again by the page that brings it
// in, not swapped for itself, so nothing is handed over to it otherwise.
if (import.meta.hot && window.__glassSound) {
  window.__glassSound.out.disconnect();
  context = window.__glassSound.context;
  muted = window.__glassSound.muted ?? true;
  build();
}

// Any of the notes but the last one played.
// Of `notes`, the glass's unless told otherwise.
const lastNotes = new Map();
const anyNote = (notes = NOTES) => {
  const lastNote = lastNotes.get(notes) ?? -1;
  const choices = lastNote < 0 ? notes.length : notes.length - 1;
  let i = Math.floor(Math.random() * choices);
  if (lastNote >= 0 && i >= lastNote) i += 1;
  lastNotes.set(notes, i);
  return notes[i];
};
const anyKnockNote = () =>
  KNOCK_NOTES[Math.floor(Math.random() * KNOCK_NOTES.length)];

// Strikes the glass at `note`, as hard as `force`, from 0 to 1, or
// whatever else `voice` says is struck, `after` so many seconds from now;
// and gives back when it has rung out.
function tap(note, force, voice = GLASS, after = 0) {
  if (muted || !context || window.matchMedia(PHONE).matches) return 0;
  // Safari stops a page's sound when something else takes it over, or the
  // machine sleeps, and lets it start again once that is over; so if it has
  // stopped, it is started again, and heard from the next tap.
  if (context.state !== "running") {
    context.resume().catch(() => {});
    return 0;
  }
  const now = context.currentTime + after;
  const ring = voice.ringSoft + (voice.ringHard - voice.ringSoft) * force;
  const strike = context.createGain();
  strike.gain.value =
    voice.loudest * (voice.gentlest + (1 - voice.gentlest) * force);
  strike.connect(out);
  const send = context.createGain();
  send.gain.value = voice.room;
  strike.connect(send).connect(room);

  voice.partials.forEach(({ ratio, level, ring: share }, i) => {
    if (note * ratio > HIGHEST_TONE) return;
    const tone = context.createOscillator();
    // The note itself in tune, and the tones over it a hair out each time,
    // as no two taps are quite the same.
    const off = i === 0 ? 0 : (Math.random() - 0.5) * 0.006;
    tone.frequency.value = note * ratio * (1 + off);
    const loud = context.createGain();
    const peak = level * (i === 0 ? 1 : Math.pow(force, 0.6 * i));
    const end = now + ring * share;
    loud.gain.setValueAtTime(0, now);
    loud.gain.linearRampToValueAtTime(peak, now + 0.002);
    loud.gain.exponentialRampToValueAtTime(0.0001, end);
    tone.connect(loud).connect(strike);
    tone.start(now);
    tone.stop(end + 0.02);
  });

  // The tick of contact: noise, brief, louder the harder it is.
  const { pitch, q, level, length } = voice.tick;
  const tick = context.createBufferSource();
  tick.buffer = noise;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = pitch(note);
  band.Q.value = q;
  const loud = context.createGain();
  loud.gain.setValueAtTime(Math.max(0.0001, level * force), now);
  loud.gain.exponentialRampToValueAtTime(0.0001, now + length);
  tick.connect(band).connect(loud).connect(strike);
  tick.start(now);
  tick.stop(now + 0.05);
  return now + ring;
}

// Turns the sound off, or on again, which is heard as a tap.
export function setMuted(off) {
  muted = off;
  if (import.meta.hot && window.__glassSound) window.__glassSound.muted = off;
  if (!off) tap(anyNote(), PRESS);
}

// A knock of one tile into another, or into the edge of the page, as hard
// as `force`, from 0 to 1. A soft one too close after the last, or one
// more than can be heard at once, is let go unheard.
let lastKnock = { at: -1, force: 0 };
let knocking = [];
export function knock(force) {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  knocking = knocking.filter((end) => end > now);
  if (knocking.length >= KNOCKS_AT_ONCE) return;
  if (now - lastKnock.at < KNOCK_GAP && force <= lastKnock.force) return;
  lastKnock = { at: now, force };
  knocking.push(tap(anyKnockNote(), force, KNOCK));
}

// The tick of a bike's freewheel, for an open project's tile as it moves:
// a click every CHAIN_STEP pixels it goes, so they come thick and fast as
// it sets off and space out as it slows, as a wheel coasting to a stop
// does. Each is a snap of noise, high and short, with a blip of a note in
// it, the two sides of the chain a little apart in pitch, and every one a
// hair different from the last.
const CHAIN_STEP = 14;
const CHAIN_LOUDEST = 0.16;
const CHAIN_NOTES = [2400, 2050];
// No two ticks closer than this, in seconds, where it moves fastest.
const CHAIN_GAP = 0.008;

// How far through a move it is, eased, at a share of its time, and the
// reverse: when it has got a share of the way. `curve` is a cubic-bezier's
// four numbers.
const bezier = (a, b, u) =>
  3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
const whenAt = ([x1, y1, x2, y2], share) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const u = (low + high) / 2;
    if (bezier(y1, y2, u) < share) low = u;
    else high = u;
  }
  return bezier(x1, x2, (low + high) / 2);
};

function tick(at, i) {
  const note = CHAIN_NOTES[i % 2] * (1 + (Math.random() - 0.5) * 0.08);
  const strike = context.createGain();
  strike.gain.value = CHAIN_LOUDEST * (0.7 + Math.random() * 0.3);
  strike.connect(out);
  const send = context.createGain();
  send.gain.value = 0.25;
  strike.connect(send).connect(room);
  // The snap.
  const snap = context.createBufferSource();
  snap.buffer = noise;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = note * 1.8;
  band.Q.value = 4;
  const snapLoud = context.createGain();
  snapLoud.gain.setValueAtTime(1, at);
  snapLoud.gain.exponentialRampToValueAtTime(0.0001, at + 0.006);
  snap.connect(band).connect(snapLoud).connect(strike);
  snap.start(at);
  snap.stop(at + 0.02);
  // The blip.
  const blip = context.createOscillator();
  blip.type = "triangle";
  blip.frequency.value = note;
  const blipLoud = context.createGain();
  blipLoud.gain.setValueAtTime(0.5, at);
  blipLoud.gain.exponentialRampToValueAtTime(0.0001, at + 0.014);
  blip.connect(blipLoud).connect(strike);
  blip.start(at);
  blip.stop(at + 0.03);
}

// Ticks along with a move `distance` pixels long, taking `ms`, eased by
// `curve`, starting now.
export function chain(distance, ms, curve) {
  if (muted || !context || window.matchMedia(PHONE).matches) return;
  if (context.state !== "running") return;
  const steps = Math.floor(distance / CHAIN_STEP);
  if (!steps || !ms) return;
  const start = context.currentTime + 0.01;
  let last = -Infinity;
  for (let k = 1; k <= steps; k++) {
    const at = start + (whenAt(curve, k / steps) * ms) / 1000;
    if (at - last < CHAIN_GAP) continue;
    tick(at, k);
    last = at;
  }
}

// Listens on the page for the pointer coming onto tiles and pressing them,
// and gives back a function to stop.
export function glassTaps(root) {
  // How fast the pointer is going, kept up to date as it moves, a little
  // smoothed so one jumpy reading does not decide it.
  let last = null;
  let speed = 0;
  const moved = (e) => {
    if (last) {
      const time = e.timeStamp - last.time;
      if (time > 0) {
        const now = Math.hypot(e.clientX - last.x, e.clientY - last.y) / time;
        speed = speed * 0.4 + now * 0.6;
      }
    }
    last = { x: e.clientX, y: e.clientY, time: e.timeStamp };
  };

  // Only a mouse or a pen comes onto a tile; a finger only presses it.
  const over = (e) => {
    if (e.pointerType === "touch") return;
    const tile = e.target.closest?.(".dir-tile");
    if (!tile || !root.contains(tile)) return;
    if (e.relatedTarget?.closest?.(".dir-tile") === tile) return;
    const force = Math.max(
      SOFTEST,
      Math.pow(Math.min(1, speed / HARDEST_SPEED), 0.7),
    );
    tap(anyNote(), force);
  };

  // A press of a tile. The press that wakes the sound is heard too, once
  // it has started.
  // A striped tile, pressed, rings twice, in a minor key, and lower; and so
  // do the cards that are only read.
  const strike = (e) => {
    const tile = e.target.closest?.(".dir-tile");
    const woken = wake();
    if (!tile || !root.contains(tile)) return;
    const shut = tile.matches(MINOR_TILES);
    const notes = shut
      ? [anyNote(SHUT_NOTES), anyNote(SHUT_NOTES)]
      : [anyNote()];
    const ring = () =>
      notes.forEach((note, i) => tap(note, PRESS, GLASS, i * SHUT_GAP));
    if (context?.state === "running") ring();
    else woken?.then(ring, () => {});
  };
  // A mouse or a pen strikes as its button goes down, not as it comes up
  // again, which would be late by however long it was held. A finger
  // strikes as the tap lands, as only then can it wake the sound, and so
  // does a key.
  let pointer = null;
  const down = (e) => {
    pointer = e.pointerType;
    if (pointer !== "touch") strike(e);
  };
  const clicked = (e) => {
    const byKey = e.detail === 0;
    if (byKey || pointer === "touch") strike(e);
  };

  document.addEventListener("pointermove", moved, { passive: true });
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerdown", down, { capture: true });
  root.addEventListener("click", clicked, { capture: true });
  // A key, or a press anywhere, wakes the sound as well.
  document.addEventListener("keydown", wake);
  document.addEventListener("pointerdown", wake);
  document.addEventListener("touchend", wake);
  return () => {
    document.removeEventListener("pointermove", moved);
    root.removeEventListener("pointerover", over);
    root.removeEventListener("pointerdown", down, { capture: true });
    root.removeEventListener("click", clicked, { capture: true });
    document.removeEventListener("keydown", wake);
    document.removeEventListener("pointerdown", wake);
    document.removeEventListener("touchend", wake);
  };
}
