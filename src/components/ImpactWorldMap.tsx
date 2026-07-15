"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Minus, Plus, RotateCcw } from "lucide-react";
import worldAtlas from "world-atlas/countries-110m.json";
import { countryCodeForName } from "@/lib/countries";
import { alpha2ToNumeric } from "@/lib/isoNumeric";

type NamedCount = { name: string; count: number };

type Props = {
  countries: NamedCount[];
  totalAnalyses: number;
  listLimit?: number;
};

type CountryFeature = Feature<Geometry, Record<string, unknown>> & {
  id?: string | number;
};

type MapTransform = { k: number; x: number; y: number };

const MAP_W = 960;
const MAP_H = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.35;

function fillForCount(count: number, maxCount: number, active: boolean) {
  if (count <= 0) {
    return active
      ? "rgb(var(--accent-200-rgb, 187 247 208) / 0.55)"
      : "var(--impact-map-empty)";
  }
  const t = Math.sqrt(count / Math.max(1, maxCount));
  const alpha = 0.28 + t * 0.72;
  if (active) {
    return `rgb(var(--accent-500-rgb, 16 185 129) / ${Math.min(1, alpha + 0.15)})`;
  }
  return `rgb(var(--accent-600-rgb, 5 150 105) / ${alpha})`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clampTransform(t: MapTransform): MapTransform {
  const k = clamp(t.k, MIN_ZOOM, MAX_ZOOM);
  if (k <= 1.001) return { k: 1, x: 0, y: 0 };
  const maxX = 0;
  const minX = MAP_W - MAP_W * k;
  const maxY = 0;
  const minY = MAP_H - MAP_H * k;
  return {
    k,
    x: clamp(t.x, minX, maxX),
    y: clamp(t.y, minY, maxY),
  };
}

function clientToSvg(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * MAP_W,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * MAP_H,
  };
}

export default function ImpactWorldMap({
  countries,
  totalAnalyses,
  listLimit = 10,
}: Props) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    count: number;
  } | null>(null);
  const [transform, setTransform] = useState<MapTransform>({ k: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  const maxCount = useMemo(
    () => Math.max(1, ...countries.map((c) => c.count)),
    [countries]
  );

  const byNumeric = useMemo(() => {
    const map = new Map<string, NamedCount>();
    for (const row of countries) {
      const alpha2 = countryCodeForName(row.name);
      if (!alpha2) continue;
      const numeric = alpha2ToNumeric(alpha2);
      if (!numeric) continue;
      const prev = map.get(numeric);
      if (prev) {
        map.set(numeric, { name: prev.name, count: prev.count + row.count });
      } else {
        map.set(numeric, row);
      }
    }
    return map;
  }, [countries]);

  const paths = useMemo(() => {
    const topology = worldAtlas as unknown as Topology<{
      countries: GeometryCollection;
    }>;
    const collection = feature(
      topology,
      topology.objects.countries
    ) as FeatureCollection;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [8, 12],
        [MAP_W - 8, MAP_H - 8],
      ],
      collection
    );
    const pathGen = geoPath(projection);

    return (collection.features as CountryFeature[]).map((f) => {
      const id = String(f.id ?? "").padStart(3, "0");
      const entry = byNumeric.get(id);
      return {
        id,
        d: pathGen(f) || "",
        name: entry?.name ?? null,
        count: entry?.count ?? 0,
      };
    });
  }, [byNumeric]);

  const list = countries.slice(0, listLimit);
  const canZoomOut = transform.k > MIN_ZOOM + 0.01;
  const canZoomIn = transform.k < MAX_ZOOM - 0.01;

  const zoomAt = useCallback((svgX: number, svgY: number, factor: number) => {
    setTransform((prev) => {
      const nextK = clamp(prev.k * factor, MIN_ZOOM, MAX_ZOOM);
      if (nextK === prev.k) return prev;
      const worldX = (svgX - prev.x) / prev.k;
      const worldY = (svgY - prev.y) / prev.k;
      return clampTransform({
        k: nextK,
        x: svgX - worldX * nextK,
        y: svgY - worldY * nextK,
      });
    });
  }, []);

  const zoomByButton = useCallback(
    (direction: 1 | -1) => {
      const svg = svgRef.current;
      const cx = MAP_W / 2;
      const cy = MAP_H / 2;
      if (!svg) {
        zoomAt(cx, cy, direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
        return;
      }
      zoomAt(cx, cy, direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    [zoomAt]
  );

  const resetZoom = useCallback(() => {
    setTransform({ k: 1, x: 0, y: 0 });
    setTooltip(null);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onWheel = (event: WheelEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      event.preventDefault();
      const point = clientToSvg(event.clientX, event.clientY, svg);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(point.x, point.y, factor);
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function activate(name: string | null) {
    setActiveName(name);
  }

  function onMapEnter(
    event: MouseEvent<SVGPathElement>,
    name: string | null,
    count: number
  ) {
    if (dragRef.current?.moved) return;
    if (!name || count <= 0) {
      activate(null);
      setTooltip(null);
      return;
    }
    activate(name);
    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      name,
      count,
    });
  }

  function onMapMove(event: MouseEvent<SVGPathElement>) {
    if (!tooltip || dragRef.current) return;
    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTooltip((prev) =>
      prev
        ? {
            ...prev,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }
        : null
    );
  }

  function clearHover() {
    if (dragRef.current) return;
    activate(null);
    setTooltip(null);
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    svg.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !svg) return;

    const dxClient = event.clientX - drag.lastX;
    const dyClient = event.clientY - drag.lastY;
    if (!drag.moved && Math.hypot(dxClient, dyClient) < 3) return;

    drag.moved = true;
    setIsPanning(true);
    setTooltip(null);
    activate(null);

    const rect = svg.getBoundingClientRect();
    const dx = (dxClient / Math.max(1, rect.width)) * MAP_W;
    const dy = (dyClient / Math.max(1, rect.height)) * MAP_H;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;

    setTransform((prev) => {
      if (prev.k <= 1.001) return prev;
      return clampTransform({
        k: prev.k,
        x: prev.x + dx,
        y: prev.y + dy,
      });
    });
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }

  function onDoubleClick(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = clientToSvg(event.clientX, event.clientY, svg);
    zoomAt(point.x, point.y, ZOOM_STEP);
  }

  return (
    <div className="impact-geo">
      <div
        ref={wrapRef}
        className={`impact-geo-map-wrap${isPanning ? " is-panning" : ""}${
          transform.k > 1.001 ? " is-zoomed" : ""
        }`}
        onMouseLeave={clearHover}
      >
        <div className="impact-geo-zoom" role="group" aria-label="Map zoom">
          <button
            type="button"
            className="impact-geo-zoom-btn"
            aria-label="Zoom in"
            disabled={!canZoomIn}
            onClick={() => zoomByButton(1)}
          >
            <Plus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="impact-geo-zoom-btn"
            aria-label="Zoom out"
            disabled={!canZoomOut}
            onClick={() => zoomByButton(-1)}
          >
            <Minus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="impact-geo-zoom-btn"
            aria-label="Reset map"
            disabled={!canZoomOut}
            onClick={resetZoom}
          >
            <RotateCcw size={13} aria-hidden />
          </button>
        </div>

        <svg
          ref={svgRef}
          className="impact-geo-svg"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          role="img"
          aria-label="Users by country map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onDoubleClick={onDoubleClick}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {paths.map((p) => {
              const isActive = Boolean(p.name && p.name === activeName);
              const hasUsers = p.count > 0;
              return (
                <path
                  key={p.id}
                  d={p.d}
                  className={`impact-geo-country${hasUsers ? " has-users" : ""}${
                    isActive ? " is-active" : ""
                  }`}
                  fill={fillForCount(p.count, maxCount, isActive)}
                  stroke={
                    isActive
                      ? "var(--accent-700, #15803d)"
                      : "var(--impact-map-stroke)"
                  }
                  strokeWidth={isActive ? 1.35 : 0.45}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={(e) => onMapEnter(e, p.name, p.count)}
                  onMouseMove={onMapMove}
                  onFocus={() => activate(p.name)}
                  onBlur={clearHover}
                  tabIndex={hasUsers ? 0 : undefined}
                  aria-label={
                    hasUsers && p.name
                      ? `${p.name}: ${p.count} analyses`
                      : undefined
                  }
                />
              );
            })}
          </g>
        </svg>
        {tooltip ? (
          <div
            className="impact-geo-tooltip"
            style={{
              left: tooltip.x + 12,
              top: Math.max(8, tooltip.y - 8),
            }}
          >
            <strong>{tooltip.name}</strong>
            <span>
              {tooltip.count}
              {totalAnalyses > 0 ? (
                <em>
                  {" "}
                  · {Math.round((tooltip.count / totalAnalyses) * 100)}%
                </em>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <ul className="impact-geo-list" aria-label="Top countries">
        {list.map((country) => {
          const pct = Math.round(
            (country.count / Math.max(1, totalAnalyses)) * 100
          );
          const isActive = country.name === activeName;
          return (
            <li key={country.name}>
              <button
                type="button"
                className={`impact-geo-row${isActive ? " is-active" : ""}`}
                onMouseEnter={() => activate(country.name)}
                onMouseLeave={clearHover}
                onFocus={() => activate(country.name)}
                onBlur={clearHover}
              >
                <div className="about-flat-bar-label">
                  <span>{country.name}</span>
                  <span>
                    {country.count}
                    <em> · {pct}%</em>
                  </span>
                </div>
                <div className="about-flat-bar-track">
                  <div
                    className="about-flat-bar-fill"
                    style={{
                      width: `${Math.max(6, (country.count / maxCount) * 100)}%`,
                    }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
