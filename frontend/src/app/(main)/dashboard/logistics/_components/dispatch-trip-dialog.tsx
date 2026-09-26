"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { CityAutocomplete } from "./city-autocomplete";
import type { Shipment, TripPlanData } from "./shipment-data";
import {
  Truck,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  Navigation,
} from "lucide-react";

interface DispatchTripDialogProps {
  onShipmentCreated: (newShipment: Shipment) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DispatchTripDialog({
  onShipmentCreated,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: DispatchTripDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = setControlledOpen ?? setInternalOpen;

  const [currentLocation, setCurrentLocation] = React.useState("");
  const [pickupLocation, setPickupLocation] = React.useState("");
  const [dropoffLocation, setDropoffLocation] = React.useState("");
  const [cycleUsed, setCycleUsed] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Validation: Pickup and Dropoff cannot be the same
  const isSamePickupDropoff = React.useMemo(() => {
    if (!pickupLocation.trim() || !dropoffLocation.trim()) return false;
    return pickupLocation.trim().toLowerCase() === dropoffLocation.trim().toLowerCase();
  }, [pickupLocation, dropoffLocation]);

  const isAllSameLocation = React.useMemo(() => {
    if (!currentLocation.trim() || !pickupLocation.trim() || !dropoffLocation.trim()) return false;
    return (
      currentLocation.trim().toLowerCase() === pickupLocation.trim().toLowerCase() &&
      pickupLocation.trim().toLowerCase() === dropoffLocation.trim().toLowerCase()
    );
  }, [currentLocation, pickupLocation, dropoffLocation]);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!currentLocation.trim() || !pickupLocation.trim() || !dropoffLocation.trim()) {
      setError("Please fill out Current Location, Pickup Location, and Dropoff Location.");
      return;
    }

    if (isSamePickupDropoff) {
      setError(
        "Pickup location and Dropoff location cannot be the same. Cargo must be transported between distinct facilities."
      );
      return;
    }

    if (isAllSameLocation) {
      setError("All trip locations are identical. A route must have distinct waypoints.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "https://spotter-eld-backend-lsyr.onrender.com";
      const res = await fetch(`${apiBaseUrl}/api/trip/plan/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_location: currentLocation.trim(),
          pickup_location: pickupLocation.trim(),
          dropoff_location: dropoffLocation.trim(),
          current_cycle_used: Number(cycleUsed),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        let errorMsg = `Server responded with status ${res.status}`;
        if (errJson) {
          if (errJson.details) {
            if (typeof errJson.details === "object") {
              const fieldErrors = Object.entries(errJson.details)
                .map(([field, errs]) => `${Array.isArray(errs) ? errs.join(", ") : errs}`)
                .join(" ");
              errorMsg = fieldErrors || errJson.error || errorMsg;
            } else {
              errorMsg = String(errJson.details);
            }
          } else if (errJson.error) {
            errorMsg = errJson.error;
          }
        }
        throw new Error(errorMsg);
      }

      const plan: TripPlanData = await res.json();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newId = `TRIP-${randomNum}`;

      const poly = plan.route?.polyline_coordinates || [];
      const originCoord = poly.length > 0 ? [poly[0][1], poly[0][0]] : [-87.6298, 41.8781];
      const destCoord =
        poly.length > 0 ? [poly[poly.length - 1][1], poly[poly.length - 1][0]] : [-86.7816, 36.1627];

      const newShipment: Shipment = {
        id: newId,
        createdAt: new Date().toLocaleTimeString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        currentLocation: currentLocation.trim(),
        pickupLocation: pickupLocation.trim(),
        dropoffLocation: dropoffLocation.trim(),
        currentCycleUsed: Number(cycleUsed),
        origin: {
          coordinates: originCoord as [number, number],
          display: currentLocation.trim(),
        },
        destination: {
          coordinates: destCoord as [number, number],
          display: dropoffLocation.trim(),
        },
        planData: plan,
      };

      onShipmentCreated(newShipment);
      setCurrentLocation("");
      setPickupLocation("");
      setDropoffLocation("");
      setCycleUsed(0);
      setIsOpen(false);
    } catch (err: unknown) {
      console.error("Trip planning error:", err);
      const msg = err instanceof Error ? err.message : "Failed to calculate route and logs.";
      setError(`${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5 shadow-xs font-semibold">
            <Plus className="size-4" />
            Plan Trip
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-bold">Plan FMCSA ELD Trip</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Enter your trip locations and 8-day cycle hours. The system computes the GPS route, rest stops, and draws official FMCSA log sheets.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleDispatch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CityAutocomplete
              id="current-loc"
              label="1. Current Location"
              sublabel="Starting point"
              required
              value={currentLocation}
              onChange={(val) => {
                setCurrentLocation(val);
                if (error) setError(null);
              }}
              placeholder="e.g. Chicago, IL"
            />
            <CityAutocomplete
              id="pickup-loc"
              label="2. Pickup Location"
              sublabel="1 hr on-duty load"
              required
              value={pickupLocation}
              onChange={(val) => {
                setPickupLocation(val);
                if (error) setError(null);
              }}
              placeholder="e.g. Indianapolis, IN"
            />
            <CityAutocomplete
              id="dropoff-loc"
              label="3. Dropoff Location"
              sublabel="1 hr on-duty unload"
              required
              value={dropoffLocation}
              onChange={(val) => {
                setDropoffLocation(val);
                if (error) setError(null);
              }}
              placeholder="e.g. Nashville, TN"
            />

            {/* Validation warning if Pickup and Dropoff are identical */}
            {isSamePickupDropoff && (
              <div className="col-span-1 sm:col-span-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-0">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  <strong>Invalid Route:</strong> Pickup and Dropoff locations cannot be identical (
                  {pickupLocation}). A truck must haul cargo to a different destination facility.
                </span>
              </div>
            )}
          </div>

          {/* Cycle Used */}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                <span className="text-xs font-semibold">4. Current Cycle Used (Hrs)</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-sm font-bold">
                <span className="text-primary">{cycleUsed.toFixed(1)}</span>
                <span className="text-muted-foreground text-xs">/ 70.0 hrs</span>
              </div>
            </div>

            <Slider
              value={[cycleUsed]}
              onValueChange={(val) => setCycleUsed(val[0])}
              min={0}
              max={69}
              step={0.5}
              className="py-1"
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground self-center mr-1">Quick select:</span>
              {[0, 15, 32.5, 50, 62].map((hrs) => (
                <Button
                  key={hrs}
                  type="button"
                  variant={cycleUsed === hrs ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCycleUsed(hrs)}
                  className="h-6 px-2 text-[10px]"
                >
                  {hrs === 0 ? "Fresh (0h)" : `${hrs}h`}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Validation Notice</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || isSamePickupDropoff || isAllSameLocation}
              className="gap-2 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Calculating Route & Logs...
                </>
              ) : (
                <>
                  <Navigation className="size-4" />
                  Calculate Route & ELD Logs
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
