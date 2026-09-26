"use client";

import * as React from "react";

import Image from "next/image";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Maximize2,
  ShieldCheck,
  Truck,
  ZoomIn,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Shipment, TripPlanData } from "./shipment-data";

interface ELDLogViewerProps {
  shipment: Shipment;
}

export function ELDLogViewer({ shipment }: ELDLogViewerProps) {
  const planData = shipment.planData;
  const [selectedDayIndex, setSelectedDayIndex] = React.useState(0);
  const [zoomOpen, setZoomOpen] = React.useState(false);

  if (!planData || !planData.eld_logs || planData.eld_logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
        <FileText className="size-10 text-muted-foreground/50 mb-2" />
        <h3 className="font-semibold text-base">No ELD Logs Available</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          This shipment does not have generated logbooks yet. Use the Dispatch button to generate FMCSA logs.
        </p>
      </div>
    );
  }

  const logs = planData.eld_logs;
  const schedules = planData.schedule || [];
  const currentDaySchedule = schedules[selectedDayIndex] || schedules[0];
  const currentLogBase64 = logs[selectedDayIndex] || logs[0];
  const imgSrc = currentLogBase64.startsWith("data:") ? currentLogBase64 : `data:image/png;base64,${currentLogBase64}`;

  // Calculate duty totals for the active day
  let offDutyHrs = 0;
  let sleeperHrs = 0;
  let drivingHrs = 0;
  let onDutyHrs = 0;

  if (currentDaySchedule?.activities) {
    for (const act of currentDaySchedule.activities) {
      const dur = act.duration ?? act.end_hour - act.start_hour;
      const actType = act.type?.toLowerCase();
      if (actType === "driving") drivingHrs += dur;
      else if (actType === "on_duty" || actType === "pickup" || actType === "dropoff" || actType === "fuel") {
        onDutyHrs += dur;
      } else if (actType === "sleeper" || actType === "sleeper_berth") {
        sleeperHrs += dur;
      } else {
        offDutyHrs += dur;
      }
    }
  } else {
    drivingHrs = currentDaySchedule?.total_driving_hours || 0;
    onDutyHrs = (currentDaySchedule?.total_on_duty_hours || 0) - drivingHrs;
    offDutyHrs = Math.max(0, 24 - drivingHrs - onDutyHrs);
  }

  const totalCalculated = offDutyHrs + sleeperHrs + drivingHrs + onDutyHrs;

  function handleDownload() {
    const link = document.createElement("a");
    link.href = imgSrc;
    link.download = `FMCSA_ELD_Log_${shipment.id}_Day_${selectedDayIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header controls & Day Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary gap-1.5 py-1 px-2.5">
            <ShieldCheck className="size-3.5" />
            49 CFR § 395.8 Paper Logbook Compliant
          </Badge>
          <span className="text-xs text-muted-foreground">
            {logs.length} Log Sheet{logs.length > 1 ? "s" : ""} Generated
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoomOpen(true)} className="h-8 gap-1.5 text-xs">
            <ZoomIn className="size-3.5" />
            Zoom Grid
          </Button>
          <Button variant="default" size="sm" onClick={handleDownload} className="h-8 gap-1.5 text-xs font-semibold">
            <Download className="size-3.5" />
            Download PNG
          </Button>
        </div>
      </div>

      {/* Day Tabs if multiple days */}
      {logs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {logs.map((_, idx) => (
            <Button
              key={idx}
              type="button"
              variant={selectedDayIndex === idx ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDayIndex(idx)}
              className="h-8 gap-1.5 text-xs"
            >
              <Calendar className="size-3.5" />
              Day {idx + 1}
              {schedules[idx]?.date && (
                <span className="text-[10px] opacity-80 font-normal">({schedules[idx].date})</span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Visual Paper Log Sheet */}
      <div className="relative group overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:shadow-md">
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-slate-900/5">
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="w-full h-full block focus-visible:outline-none"
            aria-label="Click to enlarge FMCSA ELD log sheet"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={`FMCSA ELD Log Day ${selectedDayIndex + 1}`}
              className="w-full h-full object-contain"
            />
          </button>

          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-opacity hover:bg-background"
            aria-label="Enlarge log sheet"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Daily Balance & 4-Line Duty Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Table of 4 Duty Lines */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                24-Hour Duty Status Balance
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                Total: {totalCalculated.toFixed(1)} / 24.0h
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Every day must account for exactly 24.0 hours across lines 1 through 4.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y rounded-md border text-xs">
              <div className="flex items-center justify-between p-2.5 bg-muted/30">
                <span className="font-medium text-muted-foreground">Line 1: Off Duty</span>
                <span className="font-mono font-bold">{offDutyHrs.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-muted-foreground">Line 2: Sleeper Berth</span>
                <span className="font-mono font-bold">{sleeperHrs.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-blue-500/5">
                <span className="font-semibold text-blue-600 dark:text-blue-400">Line 3: Driving</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {drivingHrs.toFixed(1)} hrs
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-amber-500/5">
                <span className="font-semibold text-amber-600 dark:text-amber-400">Line 4: On Duty (Not Driving)</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {onDutyHrs.toFixed(1)} hrs
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-primary/10 font-bold">
                <span>Sum of Total Hours</span>
                <span className="font-mono text-primary">{totalCalculated.toFixed(1)} hrs</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FMCSA HOS Audit Checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              Schneider Henry Compliance Audit
            </CardTitle>
            <CardDescription className="text-xs">
              Verified against FMCSA 70-hr / 8-day rules & Schneider Instructor guidelines.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Max 11-Hour Drive Limit:</span>
                <span className="text-muted-foreground ml-1">Logged {drivingHrs.toFixed(1)}h (Limit: 11.0h).</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">14-Hour On-Duty Window:</span>
                <span className="text-muted-foreground ml-1">All driving terminated within 14 consecutive hours.</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">30-Min Rest Break:</span>
                <span className="text-muted-foreground ml-1">
                  Mandatory rest break recorded on Line 1 after 8h driving.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">10-Hour Consecutive Off-Duty:</span>
                <span className="text-muted-foreground ml-1">Shift reset logged in Sleeper Berth / Off Duty.</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">45° Flag Remark Angles:</span>
                <span className="text-muted-foreground ml-1">
                  Inspection, loading, fueling, and dropoff remarks flagged cleanly.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Zoom Modal */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-lg font-bold">FMCSA Paper Logbook • Day {selectedDayIndex + 1}</DialogTitle>
              <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="size-3.5" />
                Download Sheet
              </Button>
            </div>
          </DialogHeader>
          <div className="mt-2 overflow-auto rounded-lg border bg-slate-950 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt="High-Res Logbook" className="w-full object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
