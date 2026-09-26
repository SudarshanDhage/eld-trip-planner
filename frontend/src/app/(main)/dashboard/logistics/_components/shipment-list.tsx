"use client";

import * as React from "react";

import { cn } from "cn";
import { ArrowRight, FileText, Navigation, Search, ShieldCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";

import { DispatchTripDialog } from "./dispatch-trip-dialog";
import type { Shipment } from "./shipment-data";

type ShipmentCardProps = {
  active?: boolean;
  onSelectShipment: (shipmentId: Shipment["id"]) => void;
  shipment: Shipment;
};

type ShipmentListProps = {
  onSelectShipment: (shipmentId: Shipment["id"]) => void;
  selectedShipmentId: Shipment["id"] | null;
  shipments: Shipment[];
  onShipmentCreated: (newShipment: Shipment) => void;
};

function ShipmentCard({ shipment, active, onSelectShipment }: ShipmentCardProps) {
  const route = shipment.planData?.route;
  const summary = shipment.planData?.summary;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(event) => {
        event.currentTarget.blur();
        onSelectShipment(shipment.id);
      }}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border p-3.5 text-left transition-all",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary bg-primary/5 shadow-2xs",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs tracking-tight text-foreground">#{shipment.id}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/10 text-primary">
            {summary?.total_days ?? 1} Log Sheet{(summary?.total_days ?? 1) > 1 ? "s" : ""}
          </Badge>
        </div>

        <span className="text-[11px] text-muted-foreground">{shipment.createdAt}</span>
      </div>

      {/* Origin -> Destination Route */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Start</span>
          <span className="font-bold text-xs text-foreground leading-none">{shipment.currentLocation}</span>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1 px-2 text-muted-foreground">
          <div className="h-px flex-1 border-t border-dashed" />
          <Truck className="size-3 text-primary shrink-0" />
          <div className="h-px flex-1 border-t border-dashed" />
        </div>

        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Dropoff</span>
          <span className="font-bold text-xs text-foreground leading-none">{shipment.dropoffLocation}</span>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <div>
          Pickup: <strong className="text-foreground">{shipment.pickupLocation}</strong>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>{route ? `${route.total_distance_miles.toFixed(0)} mi` : "—"}</span>
          <span>·</span>
          <span className="font-semibold text-primary">
            {route ? `${route.total_duration_hours.toFixed(1)}h drive` : "—"}
          </span>
        </div>
      </div>
    </button>
  );
}

export function ShipmentList({
  shipments,
  selectedShipmentId,
  onSelectShipment,
  onShipmentCreated,
}: ShipmentListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredShipments = React.useMemo(() => {
    if (!searchQuery.trim()) return shipments;
    const q = searchQuery.toLowerCase().trim();
    return shipments.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.currentLocation.toLowerCase().includes(q) ||
        s.pickupLocation.toLowerCase().includes(q) ||
        s.dropoffLocation.toLowerCase().includes(q),
    );
  }, [shipments, searchQuery]);

  return (
    <Card className="h-full rounded-none ring-0 border-r flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="font-bold text-lg">Trip Dispatch History</CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              {shipments.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">FMCSA HOS (70hr/8day) Routes</p>
        </div>
        <CardAction>
          <DispatchTripDialog onShipmentCreated={onShipmentCreated} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden px-0 pb-0">
        <div className="px-3">
          <InputGroup className="h-8">
            <InputGroupInput
              className="h-8 text-xs"
              aria-label="Search trips"
              placeholder="Search by city or trip ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <ScrollArea className="h-0 flex-1">
          <div className="flex flex-col gap-2.5 px-3 pb-4">
            {filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
                <Truck className="size-8 text-muted-foreground/40 mb-2" />
                <h4 className="font-semibold text-xs text-foreground">No Trips Found</h4>
                <p className="text-[11px] text-muted-foreground max-w-[200px] mt-1 mb-3">
                  {searchQuery ? "Try a different search term" : "Click 'Plan Trip' above to calculate a new route"}
                </p>
                {!searchQuery && <DispatchTripDialog onShipmentCreated={onShipmentCreated} />}
              </div>
            ) : (
              filteredShipments.map((shipment) => (
                <ShipmentCard
                  active={shipment.id === selectedShipmentId}
                  key={shipment.id}
                  shipment={shipment}
                  onSelectShipment={onSelectShipment}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
