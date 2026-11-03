"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import { Search, Mic } from "lucide-react";

// Clean, high-fidelity SVGs sourced and optimized from SVG Repo
function MicrochipSvg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
    </svg>
  );
}

function TelemetryPulseSvg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function QuantumFluxSvg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function TerminalProtocolSvg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="m4 17 6-6-6-6M12 19h8" />
    </svg>
  );
}

function CommandKeySvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 5a3 3 0 1 0-2 2.83V10H10V7.83a3 3 0 1 0-2 0V10H5.83a3 3 0 1 0 0 2H8v4H5.83a3 3 0 1 0 0 2H8v2.17a3 3 0 1 0 2 0V16h4v2.17a3 3 0 1 0 2 0V16h2.17a3 3 0 1 0 0-2H14v-4h2.17a3 3 0 1 0 0-2H14V7.83A3 3 0 0 0 16 5zm0 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1zM7 7a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm1 10a1 1 0 1 1-1-1 1 1 0 0 1 1 1zm8 0a1 1 0 1 1-1-1 1 1 0 0 1 1 1zm-5-6h4v4h-4z" />
    </svg>
  );
}

interface SearchSuggestion {
  id: string;
  category: string;
  title: string;
  shortcutKey: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const SUGGESTIONS: SearchSuggestion[] = [
  { id: "1", category: "System", title: "Deploy Autonomous Neural Core", shortcutKey: "D", icon: MicrochipSvg },
  { id: "2", category: "Telemetry", title: "Stream Live Cluster Metrics", shortcutKey: "T", icon: TelemetryPulseSvg },
  { id: "3", category: "Execution", title: "Execute Quantum Flux Calculation", shortcutKey: "E", icon: QuantumFluxSvg },
  { id: "4", category: "Protocol", title: "Synchronize Edge Node Bandwidth", shortcutKey: "S", icon: TerminalProtocolSvg },
];

type FluidTheme = "mercury-chrome" | "electric-cyan" | "solar-plasma" | "emerald-flux";

interface ThemeConfig {
  id: FluidTheme;
  name: string;
  glowColor: string;
  secondaryColor: string;
  gradient: string;
  accentText: string;
}

const THEMES: Record<FluidTheme, ThemeConfig> = {
  "mercury-chrome": {
    id: "mercury-chrome",
    name: "Mercury Chrome",
    glowColor: "#E2E8F0",
    secondaryColor: "#94A3B8",
    gradient: "linear-gradient(90deg, #FFFFFF, #94A3B8, #F8FAFC, #64748B, #FFFFFF)",
    accentText: "#E2E8F0"
  },
  "electric-cyan": {
    id: "electric-cyan",
    name: "Electric Cyan",
    glowColor: "#00F2FE",
    secondaryColor: "#4FACFE",
    gradient: "linear-gradient(90deg, #00F2FE, #4FACFE, #00c6ff, #0072ff, #00F2FE)",
    accentText: "#38BDF8"
  },
  "solar-plasma": {
    id: "solar-plasma",
    name: "Solar Plasma",
    glowColor: "#FF8A00",
    secondaryColor: "#E52E71",
    gradient: "linear-gradient(90deg, #FF8A00, #E52E71, #FF5E3A, #FF2A6D, #FF8A00)",
    accentText: "#FB923C"
  },
  "emerald-flux": {
    id: "emerald-flux",
    name: "Emerald Flux",
    glowColor: "#00FFA3",
    secondaryColor: "#00B894",
    gradient: "linear-gradient(90deg, #00FFA3, #00B894, #55EFC4, #00CEC9, #00FFA3)",
    accentText: "#34D399"
  }
};

export default function FluidCommandBarWidget() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTheme] = useState<FluidTheme>("mercury-chrome");
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = THEMES[activeTheme];

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 24, stiffness: 160 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const toggleMic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isListening;
    setIsListening(next);
    if (next) {
      setQuery("listening for voice stream...");
      setTimeout(() => {
        setQuery("query system performance --cluster titan");
        setIsListening(false);
      }, 2500);
    }
  };

  const filteredSuggestions = SUGGESTIONS.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full h-full col-span-1 md:col-span-2 text-white flex flex-col items-center justify-center p-6 select-none transition-colors duration-700 font-sans antialiased min-h-[400px]">
      
      {/* 3D Main Stage */}
      <div 
        style={{ perspective: 1200 }}
        className="relative w-full max-w-[620px] flex flex-col items-center justify-center"
      >
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative w-full flex flex-col items-center"
        >

          {/* PRIMARY FLOATING SLAB WITH REFINED SHADOW */}
          <div 
            onClick={() => inputRef.current?.focus()}
            className="relative w-full p-[2px] rounded-xl group cursor-text"
          >
            
            {/* Dynamic Fluid in Border */}
            <div className="absolute -inset-[1.5px] rounded-xl overflow-hidden pointer-events-none">
              <motion.div
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: isFocused || isListening ? 3 : 7,
                }}
                className="w-[250%] h-[600%] -top-[250%] -left-[75%] absolute"
                style={{
                  background: `conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    ${currentTheme.glowColor} 45deg,
                    ${currentTheme.secondaryColor} 90deg,
                    transparent 150deg,
                    ${currentTheme.glowColor} 225deg,
                    ${currentTheme.secondaryColor} 270deg,
                    transparent 360deg
                  )`
                }}
              />

              <div 
                className={`absolute inset-0 rounded-xl blur-[12px] transition-opacity duration-300 ${
                  isFocused || isListening ? "opacity-90" : "opacity-40"
                }`}
                style={{
                  background: currentTheme.gradient
                }}
              />
            </div>

            {/* Slab Inner Body with Natural, Layered Depth */}
            <div className="relative w-full h-[62px] sm:h-[68px] rounded-[10px] bg-[#16181D] px-4 sm:px-5 flex items-center justify-between border border-white/10 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.35),0_4px_12px_-2px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.12)] overflow-hidden">
              
              <motion.div
                animate={{
                  x: ["-100%", "200%"]
                }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: 5
                }}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none skew-x-12"
              />

              {/* Search Input */}
              <div className="relative z-10 flex-1 flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                  placeholder="Search commands, protocols, or node telemetry..."
                  className="w-full bg-transparent text-white font-sans text-base sm:text-lg font-medium outline-none placeholder:text-zinc-500 tracking-tight"
                />

                {isFocused && (
                  <motion.span
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-2 h-5 rounded-[1px] ml-0.5 -translate-y-0.5 flex-shrink-0"
                    style={{ backgroundColor: currentTheme.glowColor }}
                  />
                )}
              </div>

              {/* Action Icons */}
              <div className="relative z-10 flex items-center gap-2 flex-shrink-0 pl-2 border-l border-white/10">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition-all relative group ${
                    isListening 
                      ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/50" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                  title="Voice command input"
                >
                  {isListening ? (
                    <div className="flex items-center gap-1">
                      <Mic className="w-5 h-5 text-red-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                    </div>
                  ) : (
                    <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => inputRef.current?.focus()}
                  className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors group"
                  title="Search or execute"
                >
                  <Search className="w-5 h-5 stroke-[2.2] transition-transform group-hover:scale-110" />
                </button>
              </div>

            </div>

          </div>

          {/* Suggestions Dropdown with Refined, Clean Shadow (No Muddy Smear) */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-3 w-full rounded-xl bg-[#16181D]/98 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_24px_-4px_rgba(0,0,0,0.35),0_4px_8px_-2px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.06)] p-2 z-20 flex flex-col gap-1 overflow-hidden"
              >
                <div className="px-3 py-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <span>SUGGESTED ACTIONS</span>
                  <span className="text-[9px] font-semibold text-zinc-400">NAVIGATION</span>
                </div>

                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = selectedSuggestion === idx;

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setSelectedSuggestion(idx)}
                        onClick={() => setQuery(item.title)}
                        className={`px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                            <Icon className="w-4 h-4" style={{ color: currentTheme.glowColor }} />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-white">{item.title}</span>
                            <span className="text-[10px] font-mono text-zinc-500 ml-2">[{item.category}]</span>
                          </div>
                        </div>

                        {/* Clean Keyboard Shortcut with SVG Command Icon (No Weird Unicode Glyphs) */}
                        <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-mono text-zinc-400 border border-white/10 shadow-2xs group-hover:text-zinc-200 group-hover:border-white/20 transition-colors">
                          <CommandKeySvg className="w-2.5 h-2.5 fill-current opacity-70" />
                          <span className="font-semibold text-zinc-300">{item.shortcutKey}</span>
                        </kbd>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-xs text-zinc-500 font-mono text-center">
                    No matching actions for &quot;{query}&quot;
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

    </div>
  );
}
