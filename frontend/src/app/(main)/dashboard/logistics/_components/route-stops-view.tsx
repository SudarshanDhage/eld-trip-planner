"use client";

import * as React from "react";

import {
  ArrowRight,
  Bed,
  CheckCircle2,
  Fuel,
  MapPin,
  Navigation,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { Shipment } from "./shipment-data";

interface RouteStopsViewProps {
  shipment: Shipment;
}

export function RouteStopsView({ shipment }: RouteStopsViewProps) {
  const planData = shipment.planData;
  const stops = planData?.route?.stops ?? [];
  const route = planData?.route;

  return (
    <div className="flex flex-col gap-6">
      {/* Route Quick Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 shadow-2xs">
          <div className="text-muted-foreground text-xs font-medium">Total Distance</div>
          <div className="font-mono text-lg font-bold text-foreground">
            {route ? `${route.total_distance_miles.toFixed(1)} mi` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">Computed GPS route</div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 shadow-2xs">
          <div className="text-muted-foreground text-xs font-medium">Total Driving Hours</div>
          <div className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
            {route ? `${route.total_duration_hours.toFixed(1)} hrs` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">Based on 60 mph avg</div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 shadow-2xs">
          <div className="text-muted-foreground text-xs font-medium">Planned Stops</div>
          <div className="font-mono text-lg font-bold text-foreground">{stops.length > 0 ? stops.length : 2} Stops</div>
          <div className="text-[11px] text-muted-foreground">Pickup, Rest & Fuel</div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 shadow-2xs">
          <div className="text-muted-foreground text-xs font-medium">Cycle Remaining</div>
          <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {planData ? `${planData.summary.cycle_hours_remaining.toFixed(1)} hrs` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">70-hr / 8-day rule</div>
        </div>
      </div>

      {/* Stop by Stop itinerary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Navigation className="size-4 text-primary" />
            Waypoints & Waystation Itinerary
          </CardTitle>
          <CardDescription className="text-xs">
            Mandatory stops placed pursuant to FMCSA Part 395 and equipment range rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col divide-y">
            {/* Origin */}
            <div className="flex items-start gap-3 py-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold text-xs mt-0.5">
                1
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">
                    Origin / Current Location: {shipment.currentLocation}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Departure
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Truck coordinates: {shipment.origin.coordinates[1].toFixed(4)},{" "}
                  {shipment.origin.coordinates[0].toFixed(4)}
                </p>
              </div>
            </div>

            {/* Generated stops or fallback pickup/dropoff */}
            {stops.length > 0 ? (
              stops.map((stop, sIdx) => {
                const isPickup = stop.type?.toLowerCase().includes("pickup");
                const isDropoff = stop.type?.toLowerCase().includes("dropoff");
                const isFuel = stop.type?.toLowerCase().includes("fuel");
                const isRest = stop.type?.toLowerCase().includes("rest");

                let IconComponent = MapPin;
                let badgeColor = "border-primary/20 bg-primary/10 text-primary";
                if (isFuel) {
                  IconComponent = Fuel;
                  badgeColor = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
                } else if (isRest) {
                  IconComponent = Bed;
                  badgeColor = "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400";
                } else if (isPickup || isDropoff) {
                  IconComponent = PackageCheck;
                  badgeColor = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                }

                return (
                  <div key={sIdx} className="flex items-start gap-3 py-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs mt-0.5">
                      {sIdx + 2}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <IconComponent className="size-4 text-muted-foreground" />
                          <span className="font-semibold text-xs text-foreground">
                            {stop.location || stop.description}
                          </span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${badgeColor}`}>
                          {stop.type}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {stop.description && <span>{stop.description}</span>}
                        {stop.duration_hours && (
                          <span className="font-medium text-foreground">Duration: {stop.duration_hours} hr</span>
                        )}
                        <span>
                          GPS: {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="flex items-start gap-3 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">
                        Pickup Shipper: {shipment.pickupLocation}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                      >
                        1 hr On-Duty
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Cargo loading & pre-trip vehicle condition report.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">
                        Delivery Receiver: {shipment.dropoffLocation}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                      >
                        1 hr On-Duty
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cargo unloading & post-trip vehicle inspection signoff.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
