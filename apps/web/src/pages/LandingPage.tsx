import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AtmosphereLayer, FocusMark, type Room } from "../components/AtmosphereLayer";
import "./atmosphere.css";

gsap.registerPlugin(ScrollTrigger);

const rooms: Array<{ id: Room; name: string; note: string; index: string }> = [
  { id: "rain-city", name: "Rain City", note: "neon / rain / city hum", index: "01" },
  { id: "night-train", name: "Night Train", note: "stars / rails / midnight", index: "02" },
  { id: "orbital-lab", name: "Orbital Lab", note: "void / systems / calm", index: "03" },
  { id: "cozy-cafe", name: "Cozy Café", note: "warm light / murmur / steam", index: "04" },
];

const knobNames: Record<Room, [string, string, string]> = {
  "rain-city": ["Rain", "Traffic", "Neon hum"],
  "night-train": ["Rails", "Cabin", "Night air"],
  "orbital-lab": ["Ventilation", "Comms", "Drone"],
  "cozy-cafe": ["Murmur", "Cups", "Vinyl"],
};

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<Room>(() => {
    const saved = window.localStorage.getItem("focusroom-room");
    return saved === "night-train" || saved === "orbital-lab" || saved === "cozy-cafe"
      ? saved
      : "rain-city";
  });
  const [controlA, setControlA] = useState(72);
  const [controlB, setControlB] = useState(46);
  const [controlC, setControlC] = useState(58);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("focusroom-room", room);
  }, [room]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((value) => (value > 0 ? value - 1 : 25 * 60));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const timeLabel = useMemo(() => {
    const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
    const seconds = (timerSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [timerSeconds]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const context = gsap.context(() => {
      gsap.set(
        [
          ".timer-object",
          ".mixer-object",
          ".scene--focus .scene-copy",
          ".scene--sound .scene-copy",
          ".spaces-heading",
          ".space-poster",
          ".progress-orbit",
          ".progress-bars i",
          ".scene--progress .scene-copy",
          ".final-lock",
        ],
        { force3D: true },
      );

      gsap.fromTo(
        ".story-progress__fill",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          transformOrigin: "top center",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: reduced ? false : 0.25,
          },
        },
      );

      if (reduced) return;

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".hero-scene",
            start: "top top",
            end: "bottom top",
            scrub: 0.35,
          },
        })
        .to(".hero-focus-frame", { scale: 0.72, opacity: 0.9, ease: "none" }, 0)
        .to(".hero-copy-block h1", { y: -14, ease: "none" }, 0)
        .to(".hero-subtitle", { opacity: 0.2, y: -20, ease: "none" }, 0)
        .to(".hero-scroll", { opacity: 0, y: 14, ease: "none" }, 0.08);

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".scene--focus",
            start: "top 78%",
            end: "center 38%",
            scrub: 0.35,
          },
        })
        .fromTo(".scene--focus .scene-copy", { x: -70, opacity: 0 }, { x: 0, opacity: 1, ease: "none" }, 0)
        .fromTo(".timer-object", { scale: 0.82, rotate: -4, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, ease: "none" }, 0.03)
        .fromTo(".timer-dial__ticks", { rotate: -10 }, { rotate: 10, ease: "none" }, 0.08);

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".scene--sound",
            start: "top 80%",
            end: "center 36%",
            scrub: 0.35,
          },
        })
        .fromTo(".sound-wave", { scaleX: 0.2, opacity: 0 }, { scaleX: 1, opacity: 0.2, transformOrigin: "left center", ease: "none" }, 0)
        .fromTo(".mixer-object", { x: -80, opacity: 0 }, { x: 0, opacity: 1, ease: "none" }, 0.06)
        .fromTo(".scene--sound .scene-copy", { x: 70, opacity: 0 }, { x: 0, opacity: 1, ease: "none" }, 0.12);

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".scene--spaces",
            start: "top 78%",
            end: "center 36%",
            scrub: 0.35,
          },
        })
        .fromTo(".spaces-heading", { y: 34, opacity: 0 }, { y: 0, opacity: 1, ease: "none" }, 0)
        .fromTo(
          ".space-poster",
          { y: 72, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.055, ease: "none" },
          0.06,
        );

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".scene--progress",
            start: "top 80%",
            end: "center 34%",
            scrub: 0.35,
          },
        })
        .fromTo(".progress-orbit", { scale: 0.72, rotate: -20, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, ease: "none" }, 0)
        .fromTo(".progress-bars i", { scaleY: 0.05, opacity: 0.1 }, { scaleY: 1, opacity: 1, stagger: 0.035, ease: "none" }, 0.1)
        .fromTo(".scene--progress .scene-copy", { x: 60, opacity: 0 }, { x: 0, opacity: 1, ease: "none" }, 0.16);

      gsap.fromTo(
        ".final-lock",
        { scale: 0.88, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".scene--final",
            start: "top 76%",
            end: "center 52%",
            scrub: 0.35,
          },
        },
      );
    }, root);

    ScrollTrigger.refresh();

    return () => {
      context.revert();
    };
  }, []);

  const labels = knobNames[room];
  const controls = [
    { label: labels[0], value: controlA, setter: setControlA },
    { label: labels[1], value: controlB, setter: setControlB },
    { label: labels[2], value: controlC, setter: setControlC },
  ];

  return (
    <div className={`landing-alive landing-alive--${room}`} ref={rootRef}>
      <AtmosphereLayer
        room={room}
        rainIntensity={room === "rain-city" ? controlA / 100 : 0}
      />

      <div className="story-progress" aria-hidden="true">
        <div className="story-progress__track">
          <i className="story-progress__fill" />
        </div>
      </div>

      <header className="alive-nav">
        <Link className="alive-brand" to="/">
          <FocusMark />
          <span>FOCUSROOM</span>
        </Link>
        <nav className="alive-nav__links" aria-label="Primary navigation">
          <a href="#focus">Focus</a>
          <a href="#sound">Sound</a>
          <a href="#spaces">Spaces</a>
          <a href="#progress">Progress</a>
        </nav>
        <div className="alive-nav__actions">
          <Link to={`/auth?mode=sign-in&room=${room}`}>Sign in</Link>
          <Link className="alive-cta" to={`/auth?mode=sign-up&room=${room}`}>Create account</Link>
        </div>
      </header>

      <main>
        <section className="scene hero-scene">
          <div className="hero-focus-frame" aria-hidden="true">
            <span /><span /><span /><span /><i />
          </div>

          <div className="hero-copy-block">
            <p className="micro-label">FOCUSROOM</p>
            <h1><span>Quiet</span> <em>intensity.</em></h1>
            <p className="hero-subtitle">A digital space for deep work, sound and flow.</p>
          </div>

          <a className="hero-scroll" href="#focus">
            <span>Enter focus</span>
            <i />
          </a>
        </section>

        <section className="scene scene--focus" id="focus">
          <div className="scene-copy scene-copy--left">
            <p className="micro-label">FOCUS / 01</p>
            <h2>Less noise.<br />More signal.</h2>
            <p>Start a session and let everything else recede.</p>
          </div>

          <div className="timer-object">
            <div className="timer-dial">
              <div className="timer-dial__ticks" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
              </div>
              <strong>{timeLabel}</strong>
              <span>{timerRunning ? "session active" : "ready when you are"}</span>
            </div>

            <div className="timer-actions">
              <button
                className="timer-button timer-button--primary"
                type="button"
                onClick={() => setTimerRunning((value) => !value)}
              >
                <span className="timer-button__icon">{timerRunning ? "Ⅱ" : "▶"}</span>
                <span>{timerRunning ? "Pause" : "Start"}</span>
              </button>

              <button
                className="timer-button timer-button--quiet"
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(25 * 60);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="scene scene--sound" id="sound">
          <div className="sound-wave" aria-hidden="true">
            {Array.from({ length: 44 }, (_, index) => (
              <i key={index} style={{ "--bar": index } as React.CSSProperties} />
            ))}
          </div>

          <div className="mixer-object">
            <div className="mixer-heading">
              <p className="micro-label">SOUND / 02</p>
              <span>{rooms.find((item) => item.id === room)?.name}</span>
            </div>

            {controls.map((control) => (
              <label className="alive-slider" key={control.label}>
                <span>{control.label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={control.value}
                  onChange={(event) => control.setter(Number(event.target.value))}
                />
                <b>{control.value}</b>
              </label>
            ))}
          </div>

          <div className="scene-copy scene-copy--right">
            <h2>Shape the room<br />with sound.</h2>
            <p>Move the controls. The atmosphere should answer back.</p>
          </div>
        </section>

        <section className="scene scene--spaces" id="spaces">
          <div className="spaces-heading">
            <p className="micro-label">SPACES / 03</p>
            <h2>Choose your state.</h2>
          </div>

          <div className="space-poster-grid">
            {rooms.map((item) => (
              <button
                type="button"
                className={`space-poster ${room === item.id ? "is-active" : ""}`}
                data-room={item.id}
                key={item.id}
                onMouseEnter={() => setRoom(item.id)}
                onFocus={() => setRoom(item.id)}
                onClick={() => setRoom(item.id)}
              >
                <span>{item.index}</span>
                <strong>{item.name}</strong>
                <small>{item.note}</small>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section className="scene scene--progress" id="progress">
          <div className="progress-visual">
            <div className="progress-orbit">
              <i /><i /><i />
              <strong>12h 48m</strong>
              <span>focused this week</span>
            </div>

            <div className="progress-bars" aria-label="Weekly focus preview">
              {[42, 68, 51, 84, 63, 73, 91].map((height, index) => (
                <i
                  key={index}
                  style={{ "--height": `${height}%` } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          <div className="scene-copy scene-copy--right">
            <p className="micro-label">PROGRESS / 04</p>
            <h2>See the work<br />accumulate.</h2>
            <p>Progress without turning focus into a scoreboard.</p>
          </div>
        </section>

        <section className="scene scene--final">
          <div className="final-lock">
            <FocusMark className="final-mark" />
            <h2>Make space.<br />Do the work.</h2>
            <div className="final-actions">
              <Link className="alive-cta alive-cta--large" to={`/auth?mode=sign-up&room=${room}`}>
                Create your room
              </Link>
              <Link to={`/auth?mode=sign-in&room=${room}`}>Already have an account</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
