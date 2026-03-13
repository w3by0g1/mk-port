import { useState, useCallback, useRef, useEffect } from "react";
import RingSketch from "./RingSketch";
import SymmetricalPattern from "./SymmetricalPattern";
import rprprpSvg from "./assets/rprprp.svg";
import { client, urlFor } from "./sanityClient";

import "./App.css";

function tintColor(hex, amount = 0.75) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c) => Math.round(c + (255 - c) * amount);
  return `#${[blend(r), blend(g), blend(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const PROJECTS_QUERY =
  '*[_type == "project"] | order(order asc) { name, displayName, url, "image": image.asset->url, "showcaseMedia": showcaseMedia[] { _type, "url": asset->url }, color, type, date, description }';

const status = true;

function App() {
  const [projects, setProjects] = useState([]);
  const [hoveredProject, setHoveredProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [imageFocused, setImageFocused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const blobCache = {};

    const preload = async (url) => {
      if (!url) return url;
      if (blobCache[url]) return blobCache[url];
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        blobCache[url] = objectUrl;
        return objectUrl;
      } catch {
        return url;
      }
    };

    client.fetch(PROJECTS_QUERY).then(async (data) => {
      const mapped = data.map((p) => ({
        ...p,
        showcaseImages: (p.showcaseMedia || []).map((m) => ({
          url: m.url,
          isVideo: m._type === "file",
        })),
      }));
      setProjects(mapped);

      // Preload all media in background, then update with cached blob URLs
      const cached = await Promise.all(
        mapped.map(async (p) => ({
          ...p,
          image: await preload(p.image),
          showcaseImages: await Promise.all(
            p.showcaseImages.map(async (item) => ({
              ...item,
              url: await preload(item.url),
            })),
          ),
        })),
      );
      setProjects(cached);
    });

    return () => {
      Object.values(blobCache).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    setCarouselIndex(0);
    setImageFocused(false);
    document.body.style.setProperty(
      "--bg-edge",
      selectedProject ? "#c3c3c3" : "#dbdbdb",
    );
  }, [selectedProject?.displayName]);

  useEffect(() => {
    const WMO_CODES = {
      0: "Clear",
      1: "Mostly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Rime Fog",
      51: "Light Drizzle",
      53: "Drizzle",
      55: "Heavy Drizzle",
      61: "Light Rain",
      63: "Rain",
      65: "Heavy Rain",
      71: "Light Snow",
      73: "Snow",
      75: "Heavy Snow",
      80: "Light Showers",
      81: "Showers",
      82: "Heavy Showers",
      95: "Thunderstorm",
    };

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const [weatherRes, geoRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
          ),
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          ),
        ]);
        const weather = await weatherRes.json();
        const geo = await geoRes.json();
        const city =
          geo.address?.city || geo.address?.town || geo.address?.village || "";
        const country = geo.address?.country_code?.toUpperCase() || "";
        setWeatherInfo({
          timezone: weather.timezone_abbreviation,
          location: city + (country ? `, ${country}` : ""),
          temperature: `${Math.round(weather.current_weather.temperature)}°C`,
          weather: WMO_CODES[weather.current_weather.weathercode] || "Unknown",
        });
      } catch {
        // silently fail
      }
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleHover = useCallback((project) => {
    setHoveredProject(project);
  }, []);

  const handleSelect = useCallback(
    (displayName) => {
      setCarouselIndex(0);
      setImageFocused(false);
      if (displayName) {
        const proj = projects.find((p) => p.displayName === displayName);
        setSelectedProject(proj || null);
      } else {
        setSelectedProject(null);
      }
    },
    [projects],
  );

  const gridRef = useRef(null);
  const ringRef = useRef(null);
  const selectedRef = useRef(null);
  const carouselItemsRef = useRef([]);
  const [carouselOffset, setCarouselOffset] = useState(0);

  useEffect(() => {
    const items = carouselItemsRef.current;
    if (!items.length || !items[carouselIndex]) return;

    const measure = () => {
      const el = items[carouselIndex];
      if (!el) return;
      let offset = 0;
      for (let i = 0; i < carouselIndex; i++) {
        if (items[i]) offset += items[i].offsetWidth + 10; // 10px gap
      }
      offset += el.offsetWidth / 2;
      setCarouselOffset(offset);
    };

    // Wait for all images/videos in carousel items to load before measuring
    const media = items
      .filter(Boolean)
      .flatMap((el) => [
        ...el.querySelectorAll("img"),
        ...el.querySelectorAll("video"),
      ]);
    const unloaded = media.filter(
      (el) =>
        (el.tagName === "IMG" && !el.complete) ||
        (el.tagName === "VIDEO" && el.readyState < 1),
    );

    if (unloaded.length === 0) {
      requestAnimationFrame(measure);
    } else {
      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded >= unloaded.length) measure();
      };
      unloaded.forEach((el) => {
        const event = el.tagName === "VIDEO" ? "loadeddata" : "load";
        el.addEventListener(event, onLoad, { once: true });
      });
      return () =>
        unloaded.forEach((el) => {
          const event = el.tagName === "VIDEO" ? "loadeddata" : "load";
          el.removeEventListener(event, onLoad);
        });
    }
  }, [carouselIndex, selectedProject]);

  useEffect(() => {
    selectedRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    let targetX = 0,
      targetY = 0,
      currentX = 0,
      currentY = 0,
      ringX = 0,
      ringY = 0;
    let rafId;
    const LERP = 0.05;
    const RING_LERP = 0.12;
    const TILT_AMOUNT = 10;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const handleMouseMove = (e) => {
      if (selectedRef.current || isMobile) return;
      targetX = (e.clientX / window.innerWidth - 0.5) * -20;
      targetY = (e.clientY / window.innerHeight - 0.5) * -20;
    };

    const animate = () => {
      if (selectedRef.current) {
        targetX = 0;
        targetY = 0;
      }
      currentX += (targetX - currentX) * LERP;
      currentY += (targetY - currentY) * LERP;
      ringX += (targetX - ringX) * RING_LERP;
      ringY += (targetY - ringY) * RING_LERP;
      if (gridRef.current) {
        gridRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
      if (ringRef.current) {
        const rotateY = (-currentX / 20) * TILT_AMOUNT;
        const rotateX = (currentY / 20) * TILT_AMOUNT;
        ringRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    rafId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const isMobile = window.innerWidth <= 768;
  const GRID_SPACING = isMobile ? 120 : 260;
  const cols = Math.ceil(window.innerWidth / GRID_SPACING) + 1;
  const rows = Math.ceil(window.innerHeight / GRID_SPACING) + 1;

  return (
    <>
      <div
        ref={gridRef}
        className="guide-grid"
        style={{
          "--grid-cols": cols,
          "--grid-rows": rows,
          "--grid-spacing": `${GRID_SPACING}px`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols);
          return (
            <svg
              key={i}
              className="grid-plus"
              style={{ animationDelay: `${row * 0.15}s` }}
              width="10"
              height="10"
              viewBox="0 0 20 20"
            >
              <line
                x1="10"
                y1="3"
                x2="10"
                y2="17"
                stroke="#8e8e8e"
                strokeWidth="1"
              />
              <line
                x1="3"
                y1="10"
                x2="17"
                y2="10"
                stroke="#8e8e8e"
                strokeWidth="1"
              />
            </svg>
          );
        })}
      </div>
      {weatherInfo && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            gap: "50px",
            top: "20px",
            right: "40px",
            fontFamily: "NeueBit",
            fontSize: "15px",
            color: selectedProject ? "#ffffff" : "#A8ADAB",
            textAlign: "center",
            lineHeight: "1.4",
            transition: "color 0.4s ease",
          }}
        >
          <div style={{ textAlign: "center" }}>{weatherInfo.location}</div>
          <div style={{ width: "100px" }}>
            {weatherInfo.timezone}
            {"+"}
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div style={{ textAlign: "center" }}>
            {weatherInfo.temperature}, {weatherInfo.weather}
          </div>
        </div>
      )}
      <div
        className="center-gradient"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "var(--gradient-size)",
          height: "var(--gradient-size)",
          borderRadius: "50%",
          background: selectedProject?.color
            ? `radial-gradient(circle, ${selectedProject.color} 0%, ${tintColor(selectedProject.color)} 80%)`
            : "radial-gradient(circle, #c6fc5000 0%, #f5fcc700 100%)",
          pointerEvents: "none",
          opacity: selectedProject ? 1 : 0,
          transition: "opacity 0.4s ease",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />
      <div ref={ringRef} className="ring-container" style={{ zIndex: 1 }}>
        <RingSketch
          projects={projects}
          onHover={handleHover}
          onSelect={handleSelect}
          isSelected={!!selectedProject}
        />
      </div>
      <div
        className="footer"
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          fontSize: "17px",
          zIndex: 3,
        }}
      >
        <div
          style={{
            paddingTop: "5px",
            paddingLeft: "7px",
            width: "115px",
            height: "55px",
            backgroundColor: "#ff005a",
            color: "#A8ADAB",
            border: "1px solid #DADBDA",
            transition: "background-color 0.4s ease",
            cursor: "pointer",
          }}
          onClick={() => {
            setSelectedProject(null);
          }}
        >
          <img
            src={rprprpSvg}
            style={{ width: "19px", filter: "brightness(0) invert(1)" }}
            alt=""
          />
        </div>
        <div
          style={{
            paddingTop: "0px",
            paddingLeft: "7px",
            width: "115px",
            height: "55px",
            backgroundColor: "#EFEFEF",
            color: "#A8ADAB",
            border: "1px solid #DADBDA",
          }}
        >
          <span
            style={{
              fontFamily: "NeueBit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              paddingTop: "7px",
              textAlign: "left",
              width: "115px",
            }}
          >
            <span
              style={{ color: status ? "#7bcfad" : "#f86778", width: "115px" }}
            >
              {status ? "receiving comms." : "comms. closed"}
            </span>
            <span style={{ width: "115px" }}>
              {`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`}
            </span>
          </span>
        </div>
        <div
          style={{
            paddingTop: "0px",
            paddingLeft: "7px",
            width: "115px",
            height: "55px",
            backgroundColor: "#EFEFEF",
            color: "#A8ADAB",
            border: "1px solid #DADBDA",
          }}
        >
          <span style={{ fontFamily: "NeueBit" }}>contact</span>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100vw",

          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          pointerEvents: "none",
          zIndex: 2,
          opacity: selectedProject ? 1 : 0,
          transition: "opacity 0.3s ease-in-out 0.1s ",

          padding: "5px",
          gap: "10px",
        }}
      >
        {selectedProject?.showcaseImages && (
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              transform: imageFocused ? "scale(1.3)" : "scale(1)",
              transition: "transform 0.45s ease",
            }}
          >
            <div
              style={{
                overflow: "hidden",
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  transform: `translateX(calc(50% - ${carouselOffset}px))`,
                  transition: "transform 0.45s ease",
                  alignItems: "center",
                }}
              >
                {selectedProject.showcaseImages.map((item, i) => {
                  const focused = i === carouselIndex;
                  const src = item.url || item;
                  const isVideo = item.isVideo;

                  return (
                    <div
                      key={i}
                      ref={(el) => (carouselItemsRef.current[i] = el)}
                      style={{
                        position: "relative",
                        height: "var(--carousel-height)",
                        flexShrink: 0,
                      }}
                    >
                      {isVideo ? (
                        <video
                          ref={(el) => {
                            if (!el) return;
                            if (focused) {
                              el.play().catch(() => {});
                            } else {
                              el.pause();
                              el.currentTime = 0;
                            }
                          }}
                          src={src}
                          loop
                          muted
                          playsInline
                          disablePictureInPicture
                          controlsList="nodownload nofullscreen noremoteplayback"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (focused) {
                              setImageFocused((f) => !f);
                            } else {
                              setCarouselIndex(i);
                              setImageFocused(false);
                            }
                          }}
                          style={{
                            height: "var(--carousel-height)",
                            objectFit: "contain",
                            display: "block",
                            opacity: focused ? 1 : 0,
                            pointerEvents: "auto",
                            cursor: focused ? "pointer" : "default",
                            transition:
                              "opacity 0.45s ease, transform 0.45s ease",
                            border: "1px solid #dddddd",
                          }}
                        />
                      ) : (
                        <img
                          src={src}
                          alt=""
                          onClick={(e) => {
                            e.stopPropagation();
                            if (focused) {
                              setImageFocused((f) => !f);
                            } else {
                              setCarouselIndex(i);
                              setImageFocused(false);
                            }
                          }}
                          style={{
                            height: "var(--carousel-height)",
                            objectFit: "contain",
                            display: "block",
                            opacity: focused ? 1 : 0,
                            pointerEvents: "auto",
                            cursor: focused ? "pointer" : "default",
                            transition:
                              "opacity 0.45s ease, transform 0.45s ease",
                            border: "1px solid #DADBDA",
                          }}
                        />
                      )}

                      {/* white mask */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "#ffffff",
                          opacity: focused || imageFocused ? 0 : 0.3,
                          transition: "opacity 0.45s ease",
                          pointerEvents: "none",
                          border: "1px solid #DADBDA",
                        }}
                      />

                      {/* corner pluses */}
                      {[
                        "top-left",
                        "top-right",
                        "bottom-left",
                        "bottom-right",
                      ].map((corner) => (
                        <span
                          key={corner}
                          style={{
                            position: "absolute",
                            ...(corner.includes("top")
                              ? { top: "6px" }
                              : { bottom: "6px" }),
                            ...(corner.includes("left")
                              ? { left: "10px" }
                              : { right: "10px" }),
                            fontFamily: "NeueBit",
                            fontSize: "15px",
                            color: "#8e8e8e",
                            lineHeight: 1,
                            pointerEvents: "none",
                            opacity: focused || imageFocused ? 0 : 1,
                            transition: "opacity 0.45s ease",
                          }}
                        >
                          +
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* left arrow */}
            {selectedProject.showcaseImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setCarouselIndex(
                    (carouselIndex -
                      1 +
                      selectedProject.showcaseImages.length) %
                      selectedProject.showcaseImages.length,
                  );
                }}
                style={{
                  fontFamily: "NeueBit",
                  color: "#8e8e8e",
                  position: "absolute",
                  left: isMobile ? "5px" : "30px",
                  cursor: "pointer",
                  fontSize: "40px",
                  userSelect: "none",
                  pointerEvents: imageFocused ? "none" : "auto",
                  opacity: imageFocused ? 0 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                ←
              </div>
            )}

            {/* right arrow */}
            {selectedProject.showcaseImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setCarouselIndex(
                    (carouselIndex + 1) % selectedProject.showcaseImages.length,
                  );
                }}
                style={{
                  fontFamily: "NeueBit",
                  color: "#8e8e8e",

                  position: "absolute",
                  right: isMobile ? "5px" : "40px",
                  cursor: "pointer",
                  height: "20px",
                  width: "20px",
                  fontSize: "40px",
                  userSelect: "none",
                  pointerEvents: imageFocused ? "none" : "auto",
                  opacity: imageFocused ? 0 : 1,
                  transition: "opacity 0.3s ease",
                  zIndex: "1000",
                }}
              >
                →
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {selectedProject && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "4px",
                flexWrap: "wrap",
                pointerEvents: imageFocused ? "none" : "auto",
                opacity: imageFocused ? 0 : 1,
                transition: "opacity 0.3s ease",
              }}
            >
              {/* project name tag */}
              {selectedProject.url ? (
                <a
                  href={selectedProject.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "FraktionBold",
                    fontSize: "10px",
                    lineHeight: "1",
                    color: "#545454",
                    textTransform: "uppercase",
                    padding: "4px 6px",
                    border: "1px solid #DADBDA",
                    backgroundColor: "#ffffff",
                    textDecoration: "none",
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                >
                  {selectedProject.name} ↗
                </a>
              ) : (
                <div
                  style={{
                    fontFamily: "FraktionBold",
                    fontSize: "10px",
                    lineHeight: "1",
                    color: "#545454",
                    textTransform: "uppercase",
                    padding: "4px 6px",
                    border: "1px solid #DADBDA",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {selectedProject.name}
                </div>
              )}

              {/* type tags */}
              {selectedProject.type?.map((type) => (
                <div
                  key={type}
                  style={{
                    fontFamily: "Fraktion",
                    fontSize: "10px",
                    lineHeight: "1",
                    letterSpacing: "-0.3px",
                    color: "#999",
                    textTransform: "uppercase",
                    padding: "4px 6px",
                    border: "1px solid #DADBDA",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {hoveredProject && (
        <div
          key={hoveredProject.displayName}
          className="center-label"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {hoveredProject.type && (
            <div
              style={{
                fontFamily: "Fraktion",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#999",
              }}
            >
              {hoveredProject.type.length > 1
                ? hoveredProject.type.slice(0, -1).join(", ") +
                  " + " +
                  hoveredProject.type[hoveredProject.type.length - 1]
                : hoveredProject.type[0]}
            </div>
          )}

          <div
            style={{
              fontFamily: "NeueBit",
              fontSize: "20px",
              color: "#6c6c6c",
              whiteSpace: "nowrap",
            }}
          >
            {hoveredProject.displayName}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
