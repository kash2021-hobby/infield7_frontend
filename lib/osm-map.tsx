"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

const TILE = 256;
const HOSTS = ["a", "b", "c"].map((s) => `https://${s}.tile.openstreetmap.org`);

export type OsmPin = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  className?: string;
};

export type OsmFence = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export type OsmMapHandle = {
  fit: () => void;
  zoomIn: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lngToWorld(lng: number, zoom: number) {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}

function latToWorld(lat: number, zoom: number) {
  const s = Math.sin((clamp(lat, -85.05, 85.05) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** zoom;
}

function worldToLng(x: number, zoom: number) {
  return (x / (TILE * 2 ** zoom)) * 360 - 180;
}

function worldToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function metersToPx(lat: number, meters: number, zoom: number) {
  return meters / (156543.03392 * Math.cos((lat * Math.PI) / 180) / 2 ** zoom);
}

function usable(points: { lat: number; lng: number }[]) {
  return points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.2 && Math.abs(p.lng) > 0.2);
}

export const OsmMap = forwardRef<OsmMapHandle, {
  pins: OsmPin[];
  fences: OsmFence[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}>(function OsmMap({ pins, fences, selectedId, onSelect }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null);
  const fitted = useRef(false);
  const wheelLock = useRef(0);
  const pinsRef = useRef(pins);
  const fencesRef = useRef(fences);
  const centerRef = useRef({ lat: 12.9716, lng: 77.5946 });
  const zoomRef = useRef(13);
  pinsRef.current = pins;
  fencesRef.current = fences;

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  centerRef.current = center;
  zoomRef.current = zoom;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const now = Date.now();
      if (now - wheelLock.current < 80) return;
      wheelLock.current = now;
      setZoom((value) => clamp(value + (event.deltaY < 0 ? 1 : -1), 11, 17));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  function fit() {
    const points = usable([...pinsRef.current, ...fencesRef.current]);
    if (!points.length) {
      setCenter({ lat: 12.9716, lng: 77.5946 });
      setZoom(13);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    if (points.length === 1 || maxLat - minLat > 1.2 || maxLng - minLng > 1.2) {
      setCenter({ lat: points[0].lat, lng: points[0].lng });
      setZoom(14);
      return;
    }
    const w = size.w || 800;
    const h = size.h || 560;
    let nextZoom = 16;
    while (nextZoom > 11) {
      const spanX = Math.abs(lngToWorld(maxLng, nextZoom) - lngToWorld(minLng, nextZoom));
      const spanY = Math.abs(latToWorld(minLat, nextZoom) - latToWorld(maxLat, nextZoom));
      if (spanX < w - 140 && spanY < h - 180) break;
      nextZoom -= 1;
    }
    setZoom(nextZoom);
    setCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
  }

  useImperativeHandle(ref, () => ({
    fit,
    zoomIn: () => setZoom((value) => clamp(value + 1, 11, 17)),
  }));

  useEffect(() => {
    if (fitted.current || !size.w) return;
    const points = usable([...fences, ...pins]);
    if (!points.length) return;
    fitted.current = true;
    setCenter({ lat: points[0].lat, lng: points[0].lng });
    setZoom(14);
  }, [pins, fences, size.w]);

  const origin = useMemo(() => {
    if (!size.w) return { x: 0, y: 0 };
    return {
      x: lngToWorld(center.lng, zoom) - size.w / 2,
      y: latToWorld(center.lat, zoom) - size.h / 2,
    };
  }, [center, zoom, size.w, size.h]);

  const tiles = useMemo(() => {
    if (!size.w || !size.h) return [];
    const max = 2 ** zoom;
    const pad = TILE;
    const x0 = Math.floor((origin.x - pad) / TILE);
    const y0 = Math.floor((origin.y - pad) / TILE);
    const x1 = Math.floor((origin.x + size.w + pad) / TILE);
    const y1 = Math.floor((origin.y + size.h + pad) / TILE);
    const out: { key: string; left: number; top: number; src: string }[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= max) continue;
        const tx = ((x % max) + max) % max;
        const host = HOSTS[Math.abs(tx + y) % HOSTS.length];
        out.push({
          key: `${zoom}-${tx}-${y}`,
          left: x * TILE - origin.x,
          top: y * TILE - origin.y,
          src: `${host}/${zoom}/${tx}/${y}.png`,
        });
      }
    }
    return out.slice(0, 48);
  }, [origin, size.w, size.h, zoom]);

  function toScreen(lat: number, lng: number) {
    return { x: lngToWorld(lng, zoom) - origin.x, y: latToWorld(lat, zoom) - origin.y };
  }

  function endDrag(event: React.PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start || !layer.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    layer.current.style.transform = "translate3d(0,0,0)";
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    setCenter({
      lat: worldToLat(latToWorld(start.lat, zoomRef.current) - dy, zoomRef.current),
      lng: worldToLng(lngToWorld(start.lng, zoomRef.current) - dx, zoomRef.current),
    });
  }

  return (
    <div
      ref={root}
      className="osm-map"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, lat: centerRef.current.lat, lng: centerRef.current.lng };
      }}
      onPointerMove={(event) => {
        if (!drag.current || !layer.current) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        layer.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div ref={layer} className="osm-layer">
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            alt=""
            draggable={false}
            src={tile.src}
            className="osm-tile"
            style={{ transform: `translate(${tile.left}px, ${tile.top}px)` }}
          />
        ))}
        <svg className="osm-svgs" width={size.w} height={size.h}>
          {fences.map((fence) => {
            const pt = toScreen(fence.lat, fence.lng);
            const r = metersToPx(fence.lat, fence.radiusM, zoom);
            return (
              <circle
                key={fence.id}
                cx={pt.x}
                cy={pt.y}
                r={Math.min(r, 240)}
                fill="rgba(61,204,90,0.14)"
                stroke="#3DCC5A"
                strokeDasharray="6 5"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        {fences.map((fence) => {
          const pt = toScreen(fence.lat, fence.lng);
          return (
            <div key={`s-${fence.id}`} className="live-site" style={{ left: pt.x, top: pt.y }}>
              ◯
            </div>
          );
        })}
        {pins.map((pin) => {
          const pt = toScreen(pin.lat, pin.lng);
          return (
            <button
              key={pin.id}
              type="button"
              className={`live-pin ${pin.className ?? ""}${pin.id === selectedId ? " on" : ""}`}
              style={{ left: pt.x, top: pt.y }}
              title={pin.label}
              onClick={() => onSelect?.(pin.id)}
            >
              {pin.label}
            </button>
          );
        })}
      </div>
      <div className="osm-copy">© OpenStreetMap</div>
    </div>
  );
});
