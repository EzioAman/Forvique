"use client";
import { useState } from "react";
import { MapAnswer, type MapPin } from "@harness/components/map-answer";
import type { V } from "../types";

const PINS: MapPin[] = [
  { id: "a", label: "Blue Bottle Coffee", detail: "4 min walk", x: 20, y: 30 },
  { id: "b", label: "Ferry Building", detail: "9 min walk", x: 48, y: 55 },
  { id: "c", label: "Exploratorium", detail: "18 min walk", x: 76, y: 25 },
  { id: "d", label: "Coit Tower", detail: "22 min walk", x: 62, y: 80 },
  { id: "e", label: "Lombard Street", detail: "31 min walk", x: 88, y: 62 },
];

export default function Demo({ v }: { v: V }) {
  const [active, setActive] = useState("a");
  return (
    <MapAnswer
      pins={PINS.slice(0, Number(v.pins))}
      activeId={active}
      route={v.route === "On"}
      onSelect={v.select === "On" ? setActive : undefined}
    />
  );
}
