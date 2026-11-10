"use client";
import { useState } from "react";
import { GeoMap } from "@harness/components/geo-map";
import type { V } from "../types";

const PLACES = [
  { id: "ams", label: "Amsterdam Centraal", lat: 52.3791, lng: 4.9003, description: "Start: train to Lisse" },
  { id: "keu", label: "Keukenhof", lat: 52.2697, lng: 4.5466, description: "Tulip gardens, open Mar to May" },
  { id: "lis", label: "Lisse", lat: 52.2579, lng: 4.5572, description: "Bike rental near the station" },
  { id: "hrl", label: "Haarlem", lat: 52.3874, lng: 4.6462, description: "Lunch at Grote Markt" },
  { id: "lei", label: "Leiden", lat: 52.1601, lng: 4.497, description: "Hortus Botanicus" },
  { id: "zaa", label: "Zaanse Schans", lat: 52.4741, lng: 4.8167, description: "Windmills" },
];

export default function Demo({ v }: { v: V }) {
  const [selected, setSelected] = useState<string>();
  const places = PLACES.slice(0, Number(v.places));
  return (
    <div className="w-full max-w-md">
      <GeoMap
        key={String(v.height)}
        places={places}
        routes={
          v.route === "On" && places.length > 1
            ? [{ id: "trip", label: "Day trip", points: places.map((p) => [p.lat, p.lng] as const) }]
            : undefined
        }
        selectedId={selected}
        onSelect={setSelected}
        theme={v.theme as "light" | "dark" | "auto"}
        height={Number(v.height)}
      />
    </div>
  );
}
