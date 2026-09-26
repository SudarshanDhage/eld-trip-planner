"use client";

import * as React from "react";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  MapPin,
  Navigation,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import dynamic from "next/dynamic";

import { ELDLogViewer } from "./eld-log-viewer";
import { HOSTimeline } from "./hos-timeline";
import { RouteStopsView } from "./route-stops-view";
import type { Shipment } from "./shipment-data";

const ShipmentRouteMap = dynamic(
  () => import("./shipment-route-map").then((mod) => mod.ShipmentRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-muted/20 animate-pulse text-xs text-muted-foreground">
        Loading Interactive Route Map...
      </div>
    ),
  }
);

type ShipmentDetailsProps = {
  shipment: Shipment | null;
  onOpenDispatch?: () => void;
};

function EmptyShipmentOverview({ onOpenDispatch }: { onOpenDispatch?: () => void }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Truck className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-base">No Trip Selected</h3>
        <p className="max-w-md text-xs text-muted-foreground">
          Select a planned trip from the history list or plan a new trip with your current location, pickup, dropoff,
          and 8-day cycle hours.
        </p>
      </div>
      {onOpenDispatch && (
        <Button onClick={onOpenDispatch} size="sm" className="mt-2 gap-1.5 font-semibold">
          <Navigation className="size-4" />
          Plan New Trip
        </Button>
      )}
    </div>
  );
}

function ShipmentOverview({ shipment }: { shipment: Shipment }) {
  const [copied, setCopied] = React.useState(false);

  function copyShipmentId() {
    navigator.clipboard.writeText(shipment.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const route = shipment.planData?.route;
  const summary = shipment.planData?.summary;
  const cycleRemaining = 70.0 - shipment.currentCycleUsed;

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-xl tabular-nums tracking-tight text-foreground">#{shipment.id}</h1>
          <Button variant="ghost" size="icon-sm" onClick={copyShipmentId} aria-label="Copy shipment ID">
            {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 font-semibold gap-1.5"
          >
            <ShieldCheck className="size-3.5" />
            FMCSA Compliant
          </Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">Planned on {shipment.createdAt}</span>
        </div>
      </div>

      <Separator />

      {/* Real Trip Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Total Distance</span>
          <span className="font-mono text-base font-bold text-foreground">
            {route ? `${route.total_distance_miles.toFixed(1)} mi` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">Real GPS Polyline</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Driving Time</span>
          <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
            {route ? `${route.total_duration_hours.toFixed(1)} hrs` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">Avg 60 mph highway</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">8-Day Cycle Used</span>
          <span className="font-mono text-base font-bold text-foreground">
            {shipment.currentCycleUsed.toFixed(1)} / 70.0h
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {cycleRemaining.toFixed(1)} hrs remaining
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">ELD Daily Logs</span>
          <span className="font-mono text-base font-bold text-primary">
            {summary ? `${summary.total_days} Sheet(s)` : "1 Sheet"}
          </span>
          <span className="text-[10px] text-muted-foreground">24-hr Grid Drawn</span>
        </div>
      </div>

      {/* Real Waypoints Breakdown */}
      <div className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-foreground">Trip Route Waypoints</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <MapPin className="size-3.5 text-blue-500" />
              1. Current Location
            </div>
            <div className="font-bold text-sm text-foreground">{shipment.currentLocation}</div>
            <span className="text-[11px] text-muted-foreground">Starting departure point</span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <MapPin className="size-3.5 text-emerald-500" />
              2. Pickup Shipper
            </div>
            <div className="font-bold text-sm text-foreground">{shipment.pickupLocation}</div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              1 hour on-duty loading logged
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <MapPin className="size-3.5 text-red-500" />
              3. Dropoff Receiver
            </div>
            <div className="font-bold text-sm text-foreground">{shipment.dropoffLocation}</div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              1 hour on-duty unloading logged
            </span>
          </div>
        </div>
      </div>

      {/* Compliance / Rule Notice */}
      <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50">
        <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="font-bold text-xs">FMCSA 49 CFR Part 395 Rules Applied</AlertTitle>
        <AlertDescription className="space-y-1.5 mt-1 text-xs">
          <p className="leading-relaxed">
            This route was calculated strictly in compliance with FMCSA Hours of Service property-carrying regulations:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
            <li>Max 11 hours driving per shift following 10 consecutive hours off-duty</li>
            <li>14-hour on-duty window from the start of the driving shift</li>
            <li>30-minute rest break taken after 8 hours of driving</li>
            <li>1,000-mile equipment fuel stops strategically placed</li>
            <li>All activities rendered continuously onto the official FMCSA 24-hour log grid</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function ShipmentDetails({ shipment, onOpenDispatch }: ShipmentDetailsProps) {
  if (!shipment) {
    return (
      <div className="grid h-full min-h-0 grid-rows-[340px_1fr] overflow-hidden lg:grid-rows-[420px_1fr]">
        <div className="min-h-0 overflow-hidden">
          <ShipmentRouteMap shipment={null} />
        </div>
        <div className="min-h-0 overflow-hidden p-4">
          <EmptyShipmentOverview onOpenDispatch={onOpenDispatch} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[320px_1fr] overflow-hidden lg:grid-rows-[400px_1fr]">
      {/* Top Map View */}
      <div className="min-h-0 overflow-hidden border-b">
        <ShipmentRouteMap shipment={shipment} />
      </div>

      {/* Bottom Tabs View */}
      <div className="min-h-0 overflow-hidden">
        <div className="h-full min-h-0">
          <Tabs defaultValue="overview" className="h-full flex flex-col gap-0">
            <TabsList
              className="w-full justify-start gap-1 sm:gap-2 border-b px-4 bg-muted/20 **:data-[slot=tabs-trigger]:text-xs"
              variant="line"
            >
              <TabsTrigger className="flex-none gap-1.5" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="flex-none gap-1.5 font-semibold text-primary" value="eld-logs">
                <FileText className="size-3.5" />
                FMCSA ELD Logs
                {shipment.planData?.eld_logs?.length && (
                  <Badge variant="secondary" className="size-4 p-0 flex items-center justify-center text-[10px] ml-1">
                    {shipment.planData.eld_logs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger className="flex-none gap-1.5" value="hos-timeline">
                <Clock className="size-3.5" />
                HOS Shift Timeline
              </TabsTrigger>
              <TabsTrigger className="flex-none gap-1.5" value="route-stops">
                <Navigation className="size-3.5" />
                Route & Stops
              </TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <TabsContent className="m-0 focus-visible:outline-none" value="overview">
                <ShipmentOverview shipment={shipment} />
              </TabsContent>

              <TabsContent className="m-0 focus-visible:outline-none" value="eld-logs">
                <ELDLogViewer shipment={shipment} />
              </TabsContent>

              <TabsContent className="m-0 focus-visible:outline-none" value="hos-timeline">
                <HOSTimeline shipment={shipment} />
              </TabsContent>

              <TabsContent className="m-0 focus-visible:outline-none" value="route-stops">
                <RouteStopsView shipment={shipment} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
