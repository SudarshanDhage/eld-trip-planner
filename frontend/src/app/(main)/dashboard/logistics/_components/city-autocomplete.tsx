"use client";

import * as React from "react";

import { cn } from "cn";
import { ChevronDown, MapPin, X } from "lucide-react";

export const COMMON_US_CITIES = [
  "Chicago, IL",
  "Indianapolis, IN",
  "Nashville, TN",
  "Richmond, VA",
  "Baltimore, MD",
  "Newark, NJ",
  "Atlanta, GA",
  "Birmingham, AL",
  "Dallas, TX",
  "New York, NY",
  "Columbus, OH",
  "Los Angeles, CA",
  "Memphis, TN",
  "Kansas City, MO",
  "Louisville, KY",
  "Charlotte, NC",
  "Philadelphia, PA",
  "Houston, TX",
  "Jacksonville, FL",
  "Detroit, MI",
  "Phoenix, AZ",
  "Denver, CO",
  "Seattle, WA",
  "Minneapolis, MN",
  "St. Louis, MO",
  "Cincinnati, OH",
  "Pittsburgh, PA",
  "Cleveland, OH",
  "Oklahoma City, OK",
  "Salt Lake City, UT",
  "Las Vegas, NV",
  "Portland, OR",
  "Omaha, NE",
  "Des Moines, IA",
  "Milwaukee, WI",
  "San Antonio, TX",
  "Tampa, FL",
  "Orlando, FL",
  "Miami, FL",
  "El Paso, TX",
  "Albuquerque, NM",
  "Sacramento, CA",
  "San Francisco, CA",
];

interface CityAutocompleteProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  sublabel?: string;
  required?: boolean;
}

export function CityAutocomplete({
  id,
  value,
  onChange,
  placeholder = "e.g. Chicago, IL",
  label,
  sublabel,
  required,
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredCities = React.useMemo(() => {
    if (!value || value.trim().length === 0) {
      return COMMON_US_CITIES.slice(0, 8);
    }
    const q = value.toLowerCase().trim();
    return COMMON_US_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1.5 relative transition-all", isOpen ? "z-50" : "z-10")} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-semibold text-foreground">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {sublabel && <span className="text-[11px] text-muted-foreground">{sublabel}</span>}
        </div>
      )}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
          <MapPin className="size-4" />
        </div>
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "Enter") {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background py-1 pl-9 pr-8 text-sm shadow-xs transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear input"
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Toggle location suggestions"
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        )}

        {isOpen && filteredCities.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b mb-1">
              <span>{value ? "Matching Locations" : "Popular US Freight Hubs"}</span>
              <span className="text-[9px] font-normal lowercase">click to select</span>
            </div>
            {filteredCities.map((city) => (
              <button
                key={city}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(city);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  city.toLowerCase() === value.toLowerCase() && "bg-accent/60 font-semibold",
                )}
              >
                <MapPin className="size-3.5 text-primary shrink-0" />
                <span className="flex-1 truncate">{city}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
