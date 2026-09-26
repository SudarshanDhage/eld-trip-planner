"use client";

import * as React from "react";

import { Bed, Calendar, CheckCircle, Clock, Coffee, Fuel, MapPin, PackageCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { Shipment } from "./shipment-data";

interface HOSTimelineProps {
  shipment: Shipment;
}

function formatHour(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hrs = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const padH = hrs.toString().padStart(2, "0");
  const padM = mins.toString().padStart(2, "0");
  return `${padH}:${padM}`;
}

function getActivityBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "driving") {
    return {
      label: "Driving (Line 3)",
      icon: Truck,
      className: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      dot: "bg-blue-500",
    };
  }
  if (t === "break" || t === "rest_break") {
    return {
      label: "30-min Break (Line 1)",
      icon: Coffee,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    };
  }
  if (t === "sleeper" || t === "sleeper_berth" || t === "rest") {
    return {
      label: "10-hr Sleeper Berth (Line 2)",
      icon: Bed,
      className: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
      dot: "bg-purple-500",
    };
  }
  if (t === "pickup" || t === "dropoff" || t === "on_duty" || t === "fuel") {
    return {
      label: "On Duty (Line 4)",
      icon: PackageCheck,
      className: "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-600",
    };
  }
  return {
    label: "Off Duty (Line 1)",
    icon: Clock,
    className: "border-muted bg-muted/60 text-muted-foreground",
    dot: "bg-muted-foreground",
  };
}

export function HOSTimeline({ shipment }: HOSTimelineProps) {
  const planData = shipment.planData;
  const schedules = planData?.schedule ?? [];

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
        <Clock className="size-10 text-muted-foreground/50 mb-2" />
        <h3 className="font-semibold text-base">No Timeline Recorded</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Detailed HOS activity records will appear once a route is dispatched.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {schedules.map((daySchedule, dayIdx) => (
        <Card key={dayIdx} className="overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold">
                  Day {daySchedule.day || dayIdx + 1}
                  {daySchedule.date && (
                    <span className="text-muted-foreground font-normal ml-2">({daySchedule.date})</span>
                  )}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  Driving: {daySchedule.total_driving_hours.toFixed(1)} hrs
                </Badge>
                <Badge variant="outline" className="font-mono">
                  On-Duty: {daySchedule.total_on_duty_hours.toFixed(1)} hrs
                </Badge>
              </div>
            </div>
            <CardDescription className="text-xs">
              Chronological logbook activities from 00:00 to 24:00 (Midnight to Midnight).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border space-y-5">
              {(daySchedule.activities || []).map((act, actIdx) => {
                const config = getActivityBadge(act.type);
                const ActIcon = config.icon;
                const duration = act.duration ?? act.end_hour - act.start_hour;
                const startTime = formatHour(act.start_hour);
                const endTime = formatHour(act.end_hour);

                return (
                  <div key={actIdx} className="relative group">
                    {/* Status Dot */}
                    <div
                      className={`absolute -left-[23px] top-1 size-3.5 rounded-full border-2 border-background ${config.dot}`}
                    />

                    <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 shadow-2xs transition-colors hover:bg-muted/30">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`gap-1.5 py-0.5 text-[11px] ${config.className}`}>
                            <ActIcon className="size-3" />
                            {config.label}
                          </Badge>
                          <span className="font-medium text-xs text-foreground">{act.description || act.type}</span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>
                            {startTime} - {endTime}
                          </span>
                          <span className="font-semibold text-foreground">({duration.toFixed(1)}h)</span>
                        </div>
                      </div>

                      {act.miles !== undefined && act.miles > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Truck className="size-3 text-primary" />
                          <span>
                            Segment distance: <strong className="text-foreground">{act.miles.toFixed(1)} miles</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
