"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Compass,
  Expand,
  Fuel,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  RotateCcw,
  ShieldCheck,
  Truck,
  Warehouse,
  ZoomIn,
  ZoomOut,
  Bed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Shipment, RouteStop } from "./shipment-data";

type MapTileStyle = "streets" | "light" | "dark" | "satellite";

const TILE_LAYERS: Record<MapTileStyle, { url: string; attribution: string; label: string }> = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    label: "Street",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    label: "Light",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    label: "Dark",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    label: "Satellite",
  },
};

type ShipmentRouteMapProps = {
  shipment: Shipment | null;
};

export function ShipmentRouteMap({ shipment }: ShipmentRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);

  const [tileStyle, setTileStyle] = useState<MapTileStyle>("streets");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(5);

  // Initialize Leaflet map
  useEffect(() => {
    let isCancelled = false;

    if (!mapContainerRef.current) return;

    import("leaflet").then((L) => {
      if (isCancelled || !mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default US center
      const defaultCenter: [number, number] = [39.8283, -98.5795];
      const defaultZoom = 4;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      // Add Tile Layer
      const currentLayerCfg = TILE_LAYERS[tileStyle];
      const tileLayer = L.tileLayer(currentLayerCfg.url, {
        maxZoom: 19,
        attribution: currentLayerCfg.attribution,
      }).addTo(map);

      // Create LayerGroup for route & markers
      const routeLayerGroup = L.layerGroup().addTo(map);

      tileLayerRef.current = tileLayer;
      routeLayerGroupRef.current = routeLayerGroup;
      mapInstanceRef.current = map;

      map.on("zoomend", () => {
        setCurrentZoom(map.getZoom());
      });

      setLeafletLoaded(true);

      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 400);

      // Handle container resize
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update tile layer when tileStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    import("leaflet").then((L) => {
      const cfg = TILE_LAYERS[tileStyle];
      if (mapInstanceRef.current.hasLayer(tileLayerRef.current)) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const newLayer = L.tileLayer(cfg.url, {
        maxZoom: 19,
        attribution: cfg.attribution,
      }).addTo(mapInstanceRef.current);
      newLayer.bringToBack();
      tileLayerRef.current = newLayer;
    });
  }, [tileStyle]);

  // Fit bounds helper
  const fitRouteBounds = useCallback(() => {
    if (!mapInstanceRef.current || !shipment) return;

    import("leaflet").then((L) => {
      const poly = shipment.planData?.route?.polyline_coordinates;
      const latLngs: [number, number][] = [];

      if (poly && poly.length > 0) {
        poly.forEach(([lat, lon]) => {
          if (!isNaN(lat) && !isNaN(lon)) latLngs.push([lat, lon]);
        });
      } else {
        // Fallback to origin and destination
        latLngs.push([shipment.origin.coordinates[1], shipment.origin.coordinates[0]]);
        latLngs.push([shipment.destination.coordinates[1], shipment.destination.coordinates[0]]);
      }

      if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 14,
          animate: true,
        });
      }
    });
  }, [shipment]);

  // Render route polyline and markers when shipment changes
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerGroupRef.current || !leafletLoaded) return;

    import("leaflet").then((L) => {
      const group = routeLayerGroupRef.current;
      group.clearLayers();

      if (!shipment) {
        // Reset to full US view
        mapInstanceRef.current.setView([39.8283, -98.5795], 4, { animate: true });
        return;
      }

      const plan = shipment.planData;
      const poly = plan?.route?.polyline_coordinates;

      // 1. Draw Polyline
      let routeLatLngs: [number, number][] = [];
      if (poly && poly.length > 1) {
        routeLatLngs = poly.map(([lat, lon]) => [lat, lon]);
      } else {
        routeLatLngs = [
          [shipment.origin.coordinates[1], shipment.origin.coordinates[0]],
          [shipment.destination.coordinates[1], shipment.destination.coordinates[0]],
        ];
      }

      // Outer glow polyline
      const glowPoly = L.polyline(routeLatLngs, {
        color: "#2563eb",
        weight: 8,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      });

      // Core route polyline
      const corePoly = L.polyline(routeLatLngs, {
        color: "#3b82f6",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });

      corePoly.bindPopup(`
        <div class="p-3 text-xs">
          <div class="font-bold text-sm mb-1 text-primary">Dispatched Route</div>
          <div class="text-muted-foreground mb-1">From: <strong>${shipment.currentLocation}</strong></div>
          <div class="text-muted-foreground mb-1">To: <strong>${shipment.dropoffLocation}</strong></div>
          <div class="border-t pt-1.5 mt-1.5 flex justify-between gap-4 font-semibold">
            <span>Total Miles: ${plan.summary?.total_miles?.toFixed(0) || shipment.planData?.route?.total_distance_miles} mi</span>
            <span>Est. Drive: ${plan.summary?.total_driving_hours?.toFixed(1) || ""}h</span>
          </div>
        </div>
      `);

      group.addLayer(glowPoly);
      group.addLayer(corePoly);

      // Helper to create HTML pin marker
      const createCustomIcon = (
        iconHtml: string,
        bgClass: string,
        pulseClass = "",
      ) => {
        return L.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div class="relative flex items-center justify-center cursor-pointer select-none">
              ${pulseClass ? `<div class="absolute -inset-1.5 rounded-full ${pulseClass} opacity-75 animate-ping"></div>` : ""}
              <div class="relative flex size-8 items-center justify-center rounded-full ${bgClass} text-white shadow-lg border-2 border-white">
                ${iconHtml}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });
      };

      // 2. Add Origin / Current Location Marker
      const originLat = shipment.origin.coordinates[1];
      const originLon = shipment.origin.coordinates[0];
      const originIcon = createCustomIcon(
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>`,
        "bg-emerald-600",
        "bg-emerald-400",
      );

      const originMarker = L.marker([originLat, originLon], { icon: originIcon });
      originMarker.bindTooltip(`Start: ${shipment.currentLocation}`, { direction: "top", offset: [0, -12] });
      originMarker.bindPopup(`
        <div class="p-3 text-xs">
          <div class="flex items-center gap-1.5 font-bold text-sm text-emerald-600 mb-1">
            <span>●</span> Current Location (Origin)
          </div>
          <div class="font-medium text-foreground text-sm mb-1">${shipment.currentLocation}</div>
          <div class="text-[11px] text-muted-foreground font-mono mb-2">${originLat.toFixed(4)}, ${originLon.toFixed(4)}</div>
          <div class="rounded bg-muted/60 p-1.5 text-[11px]">
            Trip departure point. Pre-trip equipment inspected.
          </div>
        </div>
      `);
      group.addLayer(originMarker);

      // 3. Add Pickup Marker
      const stops: RouteStop[] = plan.route?.stops || [];
      const pickupStop = stops.find((s) => s.type === "pickup");
      if (pickupStop && !isNaN(pickupStop.lat) && !isNaN(pickupStop.lon)) {
        const pickupIcon = createCustomIcon(
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
          "bg-blue-600",
        );
        const pMarker = L.marker([pickupStop.lat, pickupStop.lon], { icon: pickupIcon });
        pMarker.bindTooltip(`Pickup: ${pickupStop.location}`, { direction: "top", offset: [0, -12] });
        pMarker.bindPopup(`
          <div class="p-3 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-sm text-blue-600 mb-1">
              <span>●</span> Shipper Facility (Pickup)
            </div>
            <div class="font-medium text-foreground text-sm mb-1">${pickupStop.location}</div>
            <div class="text-[11px] text-muted-foreground font-mono mb-2">${pickupStop.lat.toFixed(4)}, ${pickupStop.lon.toFixed(4)}</div>
            <div class="rounded border border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 p-2 text-[11px] text-blue-900 dark:text-blue-200">
              <strong>HOS On-Duty:</strong> 1.0 hr cargo loading required by FMCSA rules.
            </div>
          </div>
        `);
        group.addLayer(pMarker);
      }

      // 4. Add Fuel Stop Markers
      const fuelStops = stops.filter((s) => s.type === "fuel_stop");
      fuelStops.forEach((fs, idx) => {
        if (isNaN(fs.lat) || isNaN(fs.lon)) return;
        const fuelIcon = createCustomIcon(
          `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`,
          "bg-amber-500",
        );
        const fMarker = L.marker([fs.lat, fs.lon], { icon: fuelIcon });
        fMarker.bindTooltip(`Fuel Stop #${idx + 1} (${fs.miles_into_trip || (idx + 1) * 1000} mi)`, {
          direction: "top",
          offset: [0, -12],
        });
        fMarker.bindPopup(`
          <div class="p-3 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-sm text-amber-600 mb-1">
              <span>⛽</span> Fuel Stop #${idx + 1}
            </div>
            <div class="font-medium text-foreground mb-1">Interstate Travel Center</div>
            <div class="text-[11px] text-muted-foreground font-mono mb-2">${fs.lat.toFixed(4)}, ${fs.lon.toFixed(4)}</div>
            <div class="space-y-1 rounded bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-900 dark:text-amber-200">
              <div><strong>Trip Distance:</strong> ~${fs.miles_into_trip || (idx + 1) * 1000} miles into route</div>
              <div><strong>Duration:</strong> 30 min on-duty fueling</div>
              <div class="text-[10px] text-muted-foreground">FMCSA Equipment Requirement: Fuel at least every 1,000 miles</div>
            </div>
          </div>
        `);
        group.addLayer(fMarker);
      });

      // 5. Add Rest Stop Markers
      const restStops = stops.filter((s) => s.type === "rest_stop");
      restStops.forEach((rs, idx) => {
        if (isNaN(rs.lat) || isNaN(rs.lon)) return;
        const restIcon = createCustomIcon(
          `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
          "bg-purple-600",
        );
        const rMarker = L.marker([rs.lat, rs.lon], { icon: restIcon });
        rMarker.bindTooltip(`10h Rest Stop #${idx + 1}`, { direction: "top", offset: [0, -12] });
        rMarker.bindPopup(`
          <div class="p-3 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-sm text-purple-600 mb-1">
              <span>🛏</span> Mandatory 10-Hour HOS Rest
            </div>
            <div class="font-medium text-foreground mb-1">Designated Truck Stop Rest Area</div>
            <div class="text-[11px] text-muted-foreground font-mono mb-2">${rs.lat.toFixed(4)}, ${rs.lon.toFixed(4)}</div>
            <div class="space-y-1 rounded bg-purple-50 dark:bg-purple-950/30 p-2 text-[11px] text-purple-900 dark:text-purple-200">
              <div><strong>HOS Rule:</strong> 10 consecutive hours off-duty</div>
              <div><strong>Reset:</strong> Resets 11-hour driving / 14-hour duty window</div>
            </div>
          </div>
        `);
        group.addLayer(rMarker);
      });

      // 6. Add Dropoff Destination Marker
      const destLat = shipment.destination.coordinates[1];
      const destLon = shipment.destination.coordinates[0];
      const destIcon = createCustomIcon(
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>`,
        "bg-red-600",
        "bg-red-400",
      );

      const destMarker = L.marker([destLat, destLon], { icon: destIcon });
      destMarker.bindTooltip(`Dropoff: ${shipment.dropoffLocation}`, { direction: "top", offset: [0, -12] });
      destMarker.bindPopup(`
        <div class="p-3 text-xs">
          <div class="flex items-center gap-1.5 font-bold text-sm text-red-600 mb-1">
            <span>●</span> Receiver Facility (Dropoff)
          </div>
          <div class="font-medium text-foreground text-sm mb-1">${shipment.dropoffLocation}</div>
          <div class="text-[11px] text-muted-foreground font-mono mb-2">${destLat.toFixed(4)}, ${destLon.toFixed(4)}</div>
          <div class="rounded border border-red-200 bg-red-50/50 dark:bg-red-950/30 p-2 text-[11px] text-red-900 dark:text-red-200">
            <strong>HOS On-Duty:</strong> 1.0 hr cargo unloading at delivery destination.
          </div>
        </div>
      `);
      group.addLayer(destMarker);

      // Auto-fit bounds
      fitRouteBounds();
    });
  }, [shipment, leafletLoaded, fitRouteBounds]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const toggleTileStyle = () => {
    const styles: MapTileStyle[] = ["streets", "light", "dark", "satellite"];
    const nextIdx = (styles.indexOf(tileStyle) + 1) % styles.length;
    setTileStyle(styles[nextIdx]);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        fitRouteBounds();
      }
    }, 200);
  };

  return (
    <div
      className={`w-full h-full min-h-[300px] overflow-hidden bg-muted/20 select-none ${
        isFullscreen ? "fixed inset-0 z-[9999] min-h-screen bg-background" : "relative z-0 isolate"
      }`}
    >
      {/* Real Leaflet Interactive Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Control Buttons: Top Right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        {/* Zoom In */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-8 rounded-md shadow-md bg-background/90 backdrop-blur-xs hover:bg-background border"
              onClick={handleZoomIn}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom In (+)</TooltipContent>
        </Tooltip>

        {/* Zoom Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-8 rounded-md shadow-md bg-background/90 backdrop-blur-xs hover:bg-background border"
              onClick={handleZoomOut}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom Out (−)</TooltipContent>
        </Tooltip>

        {/* Fit Bounds / Recenter */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-8 rounded-md shadow-md bg-background/90 backdrop-blur-xs hover:bg-background border"
              onClick={fitRouteBounds}
              disabled={!shipment}
              aria-label="Fit route bounds"
            >
              <RotateCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Recenter Route</TooltipContent>
        </Tooltip>

        {/* Map Tile Style Switcher */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-8 rounded-md shadow-md bg-background/90 backdrop-blur-xs hover:bg-background border"
              onClick={toggleTileStyle}
              aria-label="Switch map style"
            >
              <Layers className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Style: {TILE_LAYERS[tileStyle].label}</TooltipContent>
        </Tooltip>

        {/* Fullscreen Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-8 rounded-md shadow-md bg-background/90 backdrop-blur-xs hover:bg-background border"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Floating Route Legend & HUD Bar: Bottom Center */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {/* Left Side: Stop Legend Badges */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-md text-xs">
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-600 inline-block"></span>
            <span className="text-[11px] font-medium text-muted-foreground">Origin</span>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-[11px] font-medium text-muted-foreground">Pickup</span>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-[11px] font-medium text-muted-foreground">Fuel</span>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-purple-600 inline-block"></span>
            <span className="text-[11px] font-medium text-muted-foreground">10h Rest</span>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-red-600 inline-block"></span>
            <span className="text-[11px] font-medium text-muted-foreground">Dropoff</span>
          </div>
        </div>

        {/* Right Side: Route Summary HUD */}
        {shipment && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-md text-xs">
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <Truck className="size-3.5 text-primary" />
              <span>{shipment.planData?.summary?.total_miles?.toFixed(0) || shipment.planData?.route?.total_distance_miles} mi</span>
            </div>
            <span className="text-muted-foreground/40">|</span>
            <div className="text-muted-foreground">
              {shipment.planData?.summary?.total_driving_hours?.toFixed(1)} hrs drive
            </div>
            <span className="text-muted-foreground/40">|</span>
            <div className="flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="size-3.5" />
              <span>FMCSA HOS</span>
            </div>
          </div>
        )}
      </div>

      {/* No Shipment Prompt Overlay */}
      {!shipment && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="pointer-events-auto rounded-xl border bg-background/95 px-5 py-4 shadow-xl backdrop-blur-md max-w-sm text-center space-y-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Compass className="size-5" />
            </div>
            <div className="font-semibold text-sm">Interactive ELD Route Navigator</div>
            <p className="text-xs text-muted-foreground">
              Select any trip preset from the left panel or click <strong>Dispatch Trip</strong> to plan a new FMCSA HOS route with live stops, fuel stations, and rest areas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
