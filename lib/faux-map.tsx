"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MapPin = {
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

export type MapFence = {
  id?: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export type MapLine = { lat: number; lng: number }[];

export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

function ring(lng: number, lat: number, radiusM: number): [number, number][] {
  const coords: [number, number][] = [];
  const latR = radiusM / 111_320;
  const lngR = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    coords.push([lng + lngR * Math.cos(angle), lat + latR * Math.sin(angle)]);
  }
  return coords;
}

function combinedPins(pins: MapPin[] | undefined, lat?: number, lng?: number): MapPin[] {
  if (pins && pins.length) return pins;
  if (lat != null && lng != null) return [{ lat, lng }];
  return [];
}

function combinedFences(geofences: MapFence[] | undefined, lat?: number, lng?: number, radiusM?: number): MapFence[] {
  if (geofences && geofences.length) return geofences;
  if (lat != null && lng != null && radiusM != null) return [{ lat, lng, radiusM }];
  return [];
}

export function FauxMap({
  width,
  height,
  lat,
  lng,
  radiusM,
  pins,
  geofences,
  polylines,
  interactive = true,
  onPinDrop,
  onPinClick,
  onDrop,
}: {
  width?: number | string;
  height: number;
  lat?: number;
  lng?: number;
  radiusM?: number;
  pins?: MapPin[];
  geofences?: MapFence[];
  polylines?: MapLine[];
  interactive?: boolean;
  onPinDrop?: (lat: number, lng: number) => void;
  onPinClick?: (pin: MapPin) => void;
  onDrop?: (lat: number, lng: number) => void;
}) {
  const drop = onPinDrop ?? onDrop;
  const [fallback, setFallback] = useState(false);
  const allPins = useMemo(() => combinedPins(pins, lat, lng), [pins, lat, lng]);
  const allFences = useMemo(() => combinedFences(geofences, lat, lng, radiusM), [geofences, lat, lng, radiusM]);

  if (fallback) {
    return (
      <SvgFauxMap
        width={width}
        height={height}
        pins={allPins}
        geofences={allFences}
        polylines={polylines}
        onDrop={interactive ? drop : undefined}
        onPinClick={onPinClick}
      />
    );
  }

  return (
    <LibreFauxMap
      width={width}
      height={height}
      pins={allPins}
      geofences={allFences}
      polylines={polylines}
      interactive={interactive}
      onDrop={drop}
      onPinClick={onPinClick}
      onFail={() => setFallback(true)}
    />
  );
}

function LibreFauxMap({
  width,
  height,
  pins,
  geofences,
  polylines,
  interactive,
  onDrop,
  onPinClick,
  onFail,
}: {
  width?: number | string;
  height: number;
  pins: MapPin[];
  geofences: MapFence[];
  polylines?: MapLine[];
  interactive: boolean;
  onDrop?: (lat: number, lng: number) => void;
  onPinClick?: (pin: MapPin) => void;
  onFail: () => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    remove: () => void;
    resize: () => void;
    getSource: (id: string) => { setData: (d: unknown) => void } | undefined;
    addSource: (id: string, spec: object) => void;
    addLayer: (spec: object) => void;
    getLayer: (id: string) => unknown;
    fitBounds: (b: object, o?: object) => void;
    flyTo: (o: object) => void;
    on: (ev: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => void;
  } | null>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);
  const ready = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const dropRef = useRef(onDrop);
  const failRef = useRef(onFail);
  dropRef.current = onDrop;
  failRef.current = onFail;

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    let cancelled = false;
    const failTimer = window.setTimeout(() => {
      if (!ready.current) failRef.current();
    }, 5000);
    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !node.current) return;
        const center = pins[0] ?? geofences[0] ?? { lat: 12.9716, lng: 77.5946 };
        const created = new maplibregl.Map({
          container: node.current,
          style: OSM_STYLE,
          center: [center.lng, center.lat],
          zoom: 13,
          interactive,
          attributionControl: false,
        });
        created.on("error", () => {
          if (!ready.current) failRef.current();
        });
        created.on("load", () => {
          if (cancelled) {
            created.remove();
            return;
          }
          ready.current = true;
          window.clearTimeout(failTimer);
          created.addSource("fences", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          created.addLayer({
            id: "fences-fill",
            type: "fill",
            source: "fences",
            paint: { "fill-color": "#3DDC6A", "fill-opacity": 0.18 },
          });
          created.addLayer({
            id: "fences-line",
            type: "line",
            source: "fences",
            paint: { "line-color": "#0E7A3D", "line-width": 2, "line-dasharray": [2, 2] },
          });
          created.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          created.addLayer({
            id: "lines",
            type: "line",
            source: "lines",
            paint: { "line-color": "#0E7A3D", "line-width": 3, "line-dasharray": [2, 1] },
          });
          created.resize();
          mapRef.current = created as typeof mapRef.current;
          setLoaded(true);
        });
        created.on("click", (event) => {
          dropRef.current?.(Number(event.lngLat.lat.toFixed(6)), Number(event.lngLat.lng.toFixed(6)));
        });
      } catch {
        failRef.current();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // pins/geofences used only for initial center
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    map.getSource("fences")?.setData({
      type: "FeatureCollection",
      features: geofences.map((fence) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring(fence.lng, fence.lat, fence.radiusM)] },
      })),
    });
    map.getSource("lines")?.setData({
      type: "FeatureCollection",
      features: (polylines ?? [])
        .filter((line) => line.length > 1)
        .map((line) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: line.map((pt) => [pt.lng, pt.lat]) },
        })),
    });
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    void import("maplibre-gl").then((maplibregl) => {
      const next: { remove: () => void }[] = [];
      const bounds = new maplibregl.LngLatBounds();
      for (const pin of pins) {
        const el = document.createElement("div");
        el.className = "faux-pin";
        el.title = pin.label ?? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`;
        el.style.background = pin.color ?? "var(--if-ink)";
        if (pin.label) el.textContent = pin.label;
        if (onPinClick) {
          el.style.cursor = "pointer";
          el.onclick = (event) => {
            event.stopPropagation();
            onPinClick(pin);
          };
        }
        next.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map as never));
        bounds.extend([pin.lng, pin.lat]);
      }
      markersRef.current = next;
      const points = [...pins, ...geofences];
      if (points.length === 1) {
        map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14 });
      } else if (points.length > 1) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
      }
    });
  }, [loaded, pins, geofences, polylines, onPinClick]);

  return (
    <div
      ref={node}
      className="faux-map"
      style={{
        width: width ?? "100%",
        height,
        position: "relative",
        overflow: "hidden",
        cursor: onDrop ? "crosshair" : "default",
      }}
    />
  );
}

function SvgFauxMap({
  width,
  height,
  pins,
  geofences,
  polylines,
  onDrop,
  onPinClick,
}: {
  width?: number | string;
  height: number;
  pins: MapPin[];
  geofences: MapFence[];
  polylines?: MapLine[];
  onDrop?: (lat: number, lng: number) => void;
  onPinClick?: (pin: MapPin) => void;
}) {
  const boxW = typeof width === "number" ? width : 380;
  const points = [...pins, ...geofences, ...(polylines ?? []).flat()];
  const fallback = points[0] ?? { lat: 12.9716, lng: 77.5946 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = 0.04;
  const minLat = (lats.length ? Math.min(...lats) : fallback.lat) - pad;
  const maxLat = (lats.length ? Math.max(...lats) : fallback.lat) + pad;
  const minLng = (lngs.length ? Math.min(...lngs) : fallback.lng) - pad;
  const maxLng = (lngs.length ? Math.max(...lngs) : fallback.lng) + pad;
  const spanLat = Math.max(maxLat - minLat, 0.02);
  const spanLng = Math.max(maxLng - minLng, 0.02);

  function xy(lat: number, lng: number) {
    return {
      x: ((lng - minLng) / spanLng) * boxW,
      y: ((maxLat - lat) / spanLat) * height,
    };
  }

  function fromClick(clientX: number, clientY: number, target: HTMLElement) {
    const box = target.getBoundingClientRect();
    const x = (clientX - box.left) / box.width;
    const y = (clientY - box.top) / box.height;
    return {
      lat: Number((maxLat - y * spanLat).toFixed(6)),
      lng: Number((minLng + x * spanLng).toFixed(6)),
    };
  }

  return (
    <div
      className="faux-map"
      style={{
        width: width ?? "100%",
        height,
        position: "relative",
        overflow: "hidden",
        background: "oklch(96% 0.02 145)",
        cursor: onDrop ? "crosshair" : "default",
      }}
      onClick={(event) => {
        if (!onDrop) return;
        const next = fromClick(event.clientX, event.clientY, event.currentTarget);
        onDrop(next.lat, next.lng);
      }}
    >
      <svg width="100%" height={height} viewBox={`0 0 ${boxW} ${height}`} style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M0 ${height * 0.7} Q${boxW * 0.3} ${height * 0.55} ${boxW * 0.7} ${height * 0.72} T ${boxW} ${height * 0.8} L ${boxW} ${height} L 0 ${height} Z`}
          fill="oklch(90% 0.05 220)"
          opacity="0.6"
        />
        <circle cx={boxW * 0.2} cy={height * 0.3} r="40" fill="oklch(88% 0.09 140)" opacity="0.55" />
        {[0.2, 0.45, 0.7].map((y) => (
          <line key={y} x1="0" y1={height * y} x2={boxW} y2={height * y} stroke="oklch(88% 0.01 260)" strokeWidth="3" />
        ))}
        {[0.25, 0.55, 0.8].map((x) => (
          <line key={x} x1={boxW * x} y1="0" x2={boxW * x} y2={height} stroke="oklch(88% 0.01 260)" strokeWidth="3" />
        ))}
        {(polylines ?? []).map((line, index) => {
          const d = line.map((pt, i) => {
            const p = xy(pt.lat, pt.lng);
            return `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
          }).join(" ");
          return <path key={index} d={d} fill="none" stroke="var(--if-green-deep)" strokeWidth="3" strokeDasharray="6 4" />;
        })}
        {geofences.map((fence, index) => {
          const c = xy(fence.lat, fence.lng);
          const rx = Math.min(120, Math.max(28, fence.radiusM / 8));
          return (
            <circle
              key={fence.id ?? index}
              cx={c.x}
              cy={c.y}
              r={rx}
              fill="color-mix(in oklch, var(--if-green) 18%, transparent)"
              stroke="var(--if-green)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          );
        })}
        {pins.map((pin, index) => {
          const c = xy(pin.lat, pin.lng);
          return (
            <g
              key={pin.id ?? index}
              onClick={(event) => {
                if (!onPinClick) return;
                event.stopPropagation();
                onPinClick(pin);
              }}
              style={{ cursor: onPinClick ? "pointer" : "default" }}
            >
              <circle cx={c.x} cy={c.y} r="8" fill="var(--if-paper)" />
              <circle cx={c.x} cy={c.y} r="5" fill={pin.color ?? "var(--if-ink)"} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
