"use client";

import React from "react";

interface LiquidLogoProps {
  size?: number;
  className?: string;
}

export function LiquidLogo({ size = 44, className = "" }: LiquidLogoProps) {
  return (
    <div
      className={`relative rounded-full flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: `
          0 10px 25px -4px rgba(20, 50, 36, 0.25),
          0 4px 10px -2px rgba(20, 50, 36, 0.15),
          inset 0 1.5px 2px rgba(255, 255, 255, 0.95),
          inset 0 -2px 4px rgba(10, 35, 25, 0.55)
        `,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full rounded-full overflow-hidden"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Calming Green & Earthy Caustic Base Gradient */}
          <radialGradient
            id="liquidChromeBg"
            cx="48%"
            cy="32%"
            r="65%"
            fx="46%"
            fy="25%"
          >
            <stop offset="0%" stopColor="#e8f3ec" />
            <stop offset="22%" stopColor="#b7d7c4" />
            <stop offset="46%" stopColor="#52796f" />
            <stop offset="68%" stopColor="#2d6a4f" />
            <stop offset="85%" stopColor="#1b4332" />
            <stop offset="100%" stopColor="#0c1f17" />
          </radialGradient>

          {/* Liquid Ripple Wave Distortion at Bottom */}
          <linearGradient id="waveReflection" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="45%" stopColor="rgba(20, 60, 42, 0.15)" />
            <stop offset="70%" stopColor="rgba(12, 35, 25, 0.75)" />
            <stop offset="100%" stopColor="rgba(6, 20, 14, 0.95)" />
          </linearGradient>

          {/* Liquid Rim Luster */}
          <linearGradient id="rimGleam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#b7d5c5" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.9" />
          </linearGradient>

          {/* Top Specular Crescent Arc */}
          <linearGradient id="topGleam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0c1f17" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. Base Spherical Liquid Orb */}
        <circle cx="50" cy="50" r="49" fill="url(#liquidChromeBg)" />

        {/* 2. Fluid Wave Lower Layer */}
        <path
          d="M 2 55 Q 25 46 50 54 T 98 52 L 98 98 L 2 98 Z"
          fill="url(#waveReflection)"
          opacity="0.8"
        />

        {/* 3. Top Curved Specular Flare */}
        <ellipse
          cx="50"
          cy="26"
          rx="36"
          ry="14"
          fill="url(#topGleam)"
          opacity="0.45"
        />

        {/* 4. Outer Razor Rim Ring */}
        <circle
          cx="50"
          cy="50"
          r="48.5"
          stroke="url(#rimGleam)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* 5. Center Monogram: 'C' Outer + 'n' Inner */}
        <g filter="url(#logoGlow)">
          {/* Outer 'C' Ring (Oval with right-side opening) */}
          <path
            d="
              M 69 41
              L 64 41
              C 62 29 55 24 50 24
              C 38 24 31 35 31 50
              C 31 65 38 76 50 76
              C 55 76 62 71 64 59
              L 69 59
              C 67 74 58 81 50 81
              C 34 81 25 68 25 50
              C 25 32 34 19 50 19
              C 58 19 67 26 69 41
              Z
            "
            fill="#ffffff"
          />

          {/* Inner 'n' Arch (Vertical legs with top curved dome and rounded bottom caps) */}
          <path
            d="
              M 42 64
              V 43
              C 42 39 45 36 50 36
              C 55 36 58 39 58 43
              V 64
            "
            stroke="#ffffff"
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
