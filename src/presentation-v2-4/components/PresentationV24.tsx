"use client";

import "../styles/presentation-v2-4.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { CORE_SLIDES_V24 } from "../data/core-story";
import CoreSlide24Dispatcher from "./CoreSlide24Dispatcher";

interface PresentationV24Props {
  initialCoreSlide?: number;
  exportMode?: boolean;
}

export function PresentationV24({
  initialCoreSlide = 0,
  exportMode = false,
}: PresentationV24Props) {
  const [slideIndex, setSlideIndex] = useState<number>(
    Math.max(0, Math.min(initialCoreSlide, CORE_SLIDES_V24.length - 1))
  );
  const [scale, setScale] = useState<number>(1);
  const [showAppendixBack, setShowAppendixBack] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [navOpen, setNavOpen] = useState<boolean>(false);
  const outerRef = useRef<HTMLDivElement>(null);

  const totalSlides = CORE_SLIDES_V24.length;

  // Scale the 1920x1080 slide canvas to fit the viewport
  useEffect(() => {
    function updateScale() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScale(Math.min(w / 1920, h / 1080));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goToSlide = useCallback((index: number) => {
    setSlideIndex(Math.max(0, Math.min(index, CORE_SLIDES_V24.length - 1)));
  }, []);

  const handleGoToAppendix = useCallback(
    (_appendixId: string, _fromCoreIndex: number) => {
      setShowAppendixBack(true);
    },
    []
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "r":
        case "R":
          // Replay: go back to slide 0
          goToSlide(0);
          break;
        case "m":
        case "M":
          setPaused((p) => !p);
          break;
        case "a":
        case "A":
        case "c":
        case "C":
          setShowAppendixBack((v) => !v);
          break;
        case "d":
        case "D":
          // Download menu placeholder; no implementation yet
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrev, goToSlide]);

  const currentSlide = CORE_SLIDES_V24[slideIndex];
  if (currentSlide === undefined) {
    return null;
  }

  return (
    <div
      ref={outerRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "var(--pv24-canvas)",
        position: "relative",
      }}
    >
      {/* Hover slide navigation: left edge trigger strip */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: navOpen ? 300 : 8,
          overflow: "hidden",
          transition: "width 0.2s ease",
          zIndex: 300,
          background: navOpen ? "rgba(255,255,255,0.97)" : "transparent",
          borderRight: navOpen ? "1px solid #e2e2e2" : "none",
          boxShadow: navOpen ? "4px 0 20px rgba(0,0,0,0.08)" : "none",
        }}
        onMouseEnter={() => setNavOpen(true)}
        onMouseLeave={() => setNavOpen(false)}
      >
        <div
          style={{
            padding: "20px 0",
            overflowY: "auto",
            height: "100%",
            width: 300,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "0 20px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              color: "var(--pv24-accent)",
              textTransform: "uppercase",
              borderBottom: "1px solid #e2e2e2",
              marginBottom: 8,
              fontFamily: "var(--pv24-font-family)",
              flexShrink: 0,
            }}
          >
            Slides
          </div>
          {CORE_SLIDES_V24.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => {
                setSlideIndex(i);
                setNavOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderLeft: i === slideIndex ? "3px solid var(--pv24-accent)" : "3px solid transparent",
                cursor: "pointer",
                fontFamily: "var(--pv24-font-family)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--pv24-accent)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                {String(i + 1).padStart(2, "0")} {slide.section}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: i === slideIndex ? "var(--pv24-text)" : "var(--pv24-text-secondary)",
                  fontWeight: i === slideIndex ? 700 : 400,
                  lineHeight: 1.4,
                }}
              >
                {slide.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      {showAppendixBack && (
        <button
          onClick={() => setShowAppendixBack(false)}
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 100,
            padding: "8px 16px",
            background: "var(--pv24-accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--pv24-font-mono)",
            fontSize: "14px",
          }}
          type="button"
        >
          Back to core
        </button>
      )}
      <div
        className="pv24-slide"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: `calc(50vh - ${540 * scale}px)`,
          left: `calc(50vw - ${960 * scale}px)`,
        }}
      >
        <CoreSlide24Dispatcher
          slide={currentSlide}
          exportMode={exportMode}
          slideIndex={slideIndex + 1}
          totalSlides={totalSlides}
          onGoToAppendix={handleGoToAppendix}
        />
      </div>
    </div>
  );
}
