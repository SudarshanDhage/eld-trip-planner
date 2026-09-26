"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { DEFAULT_INITIAL_TRIP } from "./initial-trip";
import type { Shipment } from "./shipment-data";
import { ShipmentDetails } from "./shipment-details";
import { ShipmentList } from "./shipment-list";

const STORAGE_KEY = "spotter_fmcsa_trips_v1";

export function Logistics() {
  const [shipmentsList, setShipmentsList] = React.useState<Shipment[]>([DEFAULT_INITIAL_TRIP]);
  const [selectedShipmentId, setSelectedShipmentId] = React.useState<string | null>(DEFAULT_INITIAL_TRIP.id);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // Load from localStorage if user has previously planned trips
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Shipment[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShipmentsList(parsed);
          setSelectedShipmentId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load saved trips from localStorage:", e);
    }
  }, []);

  function handleSelectShipment(shipmentId: string) {
    setSelectedShipmentId(shipmentId);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setDetailsOpen(true);
    }
  }

  function handleShipmentCreated(newShipment: Shipment) {
    setShipmentsList((prev) => {
      const updated = [newShipment, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to persist trip to localStorage:", e);
      }
      return updated;
    });
    setSelectedShipmentId(newShipment.id);
  }

  const selectedShipment = shipmentsList.find((s) => s.id === selectedShipmentId) ?? shipmentsList[0] ?? null;

  return (
    <>
      <div
        data-content-padding="false"
        className="grid h-[calc(100dvh-var(--dashboard-header-height))] overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)] lg:divide-x"
      >
        <div className="h-full overflow-hidden">
          <ShipmentList
            shipments={shipmentsList}
            selectedShipmentId={selectedShipmentId}
            onSelectShipment={handleSelectShipment}
            onShipmentCreated={handleShipmentCreated}
          />
        </div>
        <div className="hidden h-full overflow-hidden lg:block">
          <ShipmentDetails shipment={selectedShipment} />
        </div>
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-3/4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedShipment ? `Trip ${selectedShipment.id}` : "Trip details"}</SheetTitle>
            <SheetDescription>Selected trip route map, HOS timeline, and FMCSA ELD logs.</SheetDescription>
          </SheetHeader>
          <ShipmentDetails shipment={selectedShipment} />
        </SheetContent>
      </Sheet>
    </>
  );
}
