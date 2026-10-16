"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Hit = { label: string; lat: number; lng: number };

export function Geocoder({
  token,
  value,
  onChange,
  onPick,
  onCoords,
  id,
  placeholder,
}: {
  token: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (hit: Hit) => void;
  onCoords?: (lat: number, lng: number) => void;
  id?: string;
  placeholder?: string;
}) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [offline, setOffline] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (value.trim().length < 3) {
      setHits([]);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void api<{ results: Hit[]; source?: string }>(`/geocode?q=${encodeURIComponent(value.trim())}`, {}, token)
        .then((body) => {
          setHits(body.results);
          setOffline(body.source === "offline");
          if (body.results[0]) onCoords?.(body.results[0].lat, body.results[0].lng);
        })
        .catch(() => setHits([]));
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [token, value]);

  return (
    <div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Search address or drop pin"}
      />
      {offline && hits.length === 0 ? (
        <p className="muted" style={{ margin: "8px 0 0" }}>Address search is offline. Drop a pin on the map instead.</p>
      ) : null}
      {hits.length > 0 ? (
        <div className="addr-hits">
          {hits.map((hit) => (
            <button
              key={hit.label}
              type="button"
              onClick={() => {
                onPick(hit);
                setHits([]);
              }}
            >
              {hit.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
