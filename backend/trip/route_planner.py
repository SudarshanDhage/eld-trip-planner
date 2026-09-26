"""
Route Planner
=============
Integrates with OpenRouteService (ORS) to:
  1. Geocode text locations to (lat, lon) coordinates
  2. Fetch a driving route with a polyline
  3. Compute trip distance / time
  4. Orchestrate the HOS calculator and ELD log drawer

High-Performance Optimizations:
  - In-memory Geocode Cache (_GEOCODE_CACHE) + Comprehensive US City Database (0ms lookup)
  - In-memory Route Cache (_ROUTE_CACHE) for repeat queries
  - Reusable HTTP Session with connection pooling
  - Single ORS call per trip (extracts segment 0 current->pickup distance directly without duplicate API calls)
"""

from __future__ import annotations

import logging
import math
import os
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import requests

from .hos_calculator import calculate_trip_schedule, AVG_SPEED_MPH, FUEL_STOP_MILES
from .eld_drawer import draw_eld_log

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ORS endpoints & HTTP Session
# ---------------------------------------------------------------------------
ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv"
REQUEST_TIMEOUT = 15  # seconds

# Global HTTP session for connection pooling & keep-alive
_SESSION = requests.Session()

# In-memory caches for 0ms retrieval
_GEOCODE_CACHE: Dict[str, Tuple[float, float]] = {}
_ROUTE_CACHE: Dict[str, Dict[str, Any]] = {}


def _ors_headers() -> Dict[str, str]:
    api_key = os.getenv("ORS_API_KEY", "")
    return {
        "Authorization": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json, application/geo+json",
    }


# ---------------------------------------------------------------------------
# Comprehensive US City Coordinate Database
# ---------------------------------------------------------------------------
_US_CITY_COORDS: Dict[str, Tuple[float, float]] = {
    # Top US Freight Hubs & Major Metros
    "chicago": (41.8781, -87.6298),
    "chicago, il": (41.8781, -87.6298),
    "indianapolis": (39.7684, -86.1581),
    "indianapolis, in": (39.7684, -86.1581),
    "nashville": (36.1627, -86.7816),
    "nashville, tn": (36.1627, -86.7816),
    "los angeles": (34.0522, -118.2437),
    "los angeles, ca": (34.0522, -118.2437),
    "new york": (40.7128, -74.0060),
    "new york, ny": (40.7128, -74.0060),
    "houston": (29.7604, -95.3698),
    "houston, tx": (29.7604, -95.3698),
    "phoenix": (33.4484, -112.0740),
    "phoenix, az": (33.4484, -112.0740),
    "philadelphia": (39.9526, -75.1652),
    "philadelphia, pa": (39.9526, -75.1652),
    "san antonio": (29.4241, -98.4936),
    "san antonio, tx": (29.4241, -98.4936),
    "dallas": (32.7767, -96.7970),
    "dallas, tx": (32.7767, -96.7970),
    "san diego": (32.7157, -117.1611),
    "san diego, ca": (32.7157, -117.1611),
    "san jose": (37.3382, -121.8863),
    "san jose, ca": (37.3382, -121.8863),
    "austin": (30.2672, -97.7431),
    "austin, tx": (30.2672, -97.7431),
    "jacksonville": (30.3322, -81.6557),
    "jacksonville, fl": (30.3322, -81.6557),
    "fort worth": (32.7555, -97.3308),
    "fort worth, tx": (32.7555, -97.3308),
    "columbus": (39.9612, -82.9988),
    "columbus, oh": (39.9612, -82.9988),
    "charlotte": (35.2271, -80.8431),
    "charlotte, nc": (35.2271, -80.8431),
    "el paso": (31.7619, -106.4850),
    "el paso, tx": (31.7619, -106.4850),
    "seattle": (47.6062, -122.3321),
    "seattle, wa": (47.6062, -122.3321),
    "denver": (39.7392, -104.9903),
    "denver, co": (39.7392, -104.9903),
    "memphis": (35.1495, -90.0490),
    "memphis, tn": (35.1495, -90.0490),
    "louisville": (38.2527, -85.7585),
    "louisville, ky": (38.2527, -85.7585),
    "boston": (42.3601, -71.0589),
    "boston, ma": (42.3601, -71.0589),
    "atlanta": (33.7490, -84.3880),
    "atlanta, ga": (33.7490, -84.3880),
    "miami": (25.7617, -80.1918),
    "miami, fl": (25.7617, -80.1918),
    "kansas city": (39.0997, -94.5786),
    "kansas city, mo": (39.0997, -94.5786),
    "st. louis": (38.6270, -90.1994),
    "st. louis, mo": (38.6270, -90.1994),
    "minneapolis": (44.9778, -93.2650),
    "minneapolis, mn": (44.9778, -93.2650),
    "detroit": (42.3314, -83.0458),
    "detroit, mi": (42.3314, -83.0458),
    "cleveland": (41.4993, -81.6944),
    "cleveland, oh": (41.4993, -81.6944),
    "cincinnati": (39.1031, -84.5120),
    "cincinnati, oh": (39.1031, -84.5120),
    "pittsburgh": (40.4406, -79.9959),
    "pittsburgh, pa": (40.4406, -79.9959),
    "las vegas": (36.1699, -115.1398),
    "las vegas, nv": (36.1699, -115.1398),
    "portland": (45.5152, -122.6784),
    "portland, or": (45.5152, -122.6784),
    "oklahoma city": (35.4676, -97.5164),
    "oklahoma city, ok": (35.4676, -97.5164),
    "albuquerque": (35.0844, -106.6504),
    "albuquerque, nm": (35.0844, -106.6504),
    "tucson": (32.2226, -110.9747),
    "tucson, az": (32.2226, -110.9747),
    "fresno": (36.7468, -119.7726),
    "fresno, ca": (36.7468, -119.7726),
    "sacramento": (38.5816, -121.4944),
    "sacramento, ca": (38.5816, -121.4944),
    "mesa": (33.4152, -111.8315),
    "mesa, az": (33.4152, -111.8315),
    "milwaukee": (43.0389, -87.9065),
    "milwaukee, wi": (43.0389, -87.9065),
    "omaha": (41.2565, -95.9345),
    "omaha, ne": (41.2565, -95.9345),
    "raleigh": (35.7796, -78.6382),
    "raleigh, nc": (35.7796, -78.6382),
    "salt lake city": (40.7608, -111.8910),
    "salt lake city, ut": (40.7608, -111.8910),
    "tulsa": (36.1540, -95.9928),
    "tulsa, ok": (36.1540, -95.9928),
    "wichita": (37.6872, -97.3301),
    "wichita, ks": (37.6872, -97.3301),
    "new orleans": (29.9511, -90.0715),
    "new orleans, la": (29.9511, -90.0715),
    "tampa": (27.9506, -82.4572),
    "tampa, fl": (27.9506, -82.4572),
    "orlando": (28.5383, -81.3792),
    "orlando, fl": (28.5383, -81.3792),
    "birmingham": (33.5186, -86.8104),
    "birmingham, al": (33.5186, -86.8104),
    "des moines": (41.5868, -93.6250),
    "des moines, ia": (41.5868, -93.6250),
    "richmond": (37.5407, -77.4360),
    "richmond, va": (37.5407, -77.4360),
    "spokane": (47.6588, -117.4260),
    "spokane, wa": (47.6588, -117.4260),
    "little rock": (34.7465, -92.2896),
    "little rock, ar": (34.7465, -92.2896),
    "baton rouge": (30.4515, -91.1871),
    "baton rouge, la": (30.4515, -91.1871),
    "buffalo": (42.8864, -78.8784),
    "buffalo, ny": (42.8864, -78.8784),
    "reno": (39.5296, -119.8138),
    "reno, nv": (39.5296, -119.8138),
    "boise": (43.6150, -116.2023),
    "boise, id": (43.6150, -116.2023),
}


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------

def geocode_location(location_text: str) -> Tuple[float, float]:
    """
    Convert a human-readable location string to (latitude, longitude).
    Checks in-memory cache and US city coordinate database first for 0ms lookup.
    Only falls back to ORS geocoding API if not recognized locally.
    """
    cleaned = location_text.strip().lower()

    # 1. Fast in-memory geocode cache
    if cleaned in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[cleaned]

    # 2. Fast built-in lookup for US cities
    if cleaned in _US_CITY_COORDS:
        coords = _US_CITY_COORDS[cleaned]
        _GEOCODE_CACHE[cleaned] = coords
        return coords

    # Partial match for city names
    for city_key, coords in _US_CITY_COORDS.items():
        if city_key == cleaned or ("," in cleaned and cleaned.split(",")[0].strip() == city_key):
            _GEOCODE_CACHE[cleaned] = coords
            return coords

    # 3. Query ORS Geocoding API if external lookup required
    api_key = os.getenv("ORS_API_KEY", "")
    if api_key:
        try:
            resp = _SESSION.get(
                ORS_GEOCODE_URL,
                params={
                    "api_key": api_key,
                    "text": location_text,
                    "size": 1,
                    "boundary.country": "US",
                },
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                lon, lat = features[0]["geometry"]["coordinates"]
                coords = (float(lat), float(lon))
                _GEOCODE_CACHE[cleaned] = coords
                return coords
        except Exception as exc:
            logger.warning("ORS geocode failed for '%s': %s", location_text, exc)

    # 4. Ultimate fallback
    coords = (39.5, -98.35)
    _GEOCODE_CACHE[cleaned] = coords
    return coords


# ---------------------------------------------------------------------------
# Haversine distance (km → miles)
# ---------------------------------------------------------------------------

def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# ORS route fetching
# ---------------------------------------------------------------------------

def _fetch_ors_route(
    coords: List[Tuple[float, float]]
) -> Dict[str, Any]:
    """
    Call ORS directions API for a sequence of (lat, lon) waypoints.

    Returns dict with keys:
        distance_miles, duration_seconds, polyline (list of [lat, lon]), segments (list of segment dicts)
    """
    api_key = os.getenv("ORS_API_KEY", "")
    if not api_key:
        raise ValueError("ORS_API_KEY not set")

    ors_coords = [[lon, lat] for lat, lon in coords]

    payload = {
        "coordinates": ors_coords,
        "instructions": False,
        "geometry": True,
        "units": "mi",
    }

    resp = _SESSION.post(
        ORS_DIRECTIONS_URL,
        json=payload,
        headers=_ors_headers(),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    route = data["routes"][0]
    summary = route["summary"]
    geometry = route["geometry"]
    segments = route.get("segments", [])

    polyline_coords = _decode_polyline(geometry)

    return {
        "distance_meters": summary["distance"] * 1609.344,
        "distance_miles": summary["distance"],
        "duration_seconds": summary["duration"],
        "polyline": polyline_coords,
        "segments": segments,
    }


def _decode_polyline(encoded: str) -> List[List[float]]:
    """Decode a Google/ORS encoded polyline string to [[lat, lon], ...]."""
    coords = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        result = 1
        shift = 0
        while True:
            b = ord(encoded[index]) - 63 - 1
            index += 1
            result += b << shift
            shift += 5
            if b < 0x1F:
                break
        lat += (~result >> 1) if (result & 1) != 0 else (result >> 1)

        result = 1
        shift = 0
        while True:
            b = ord(encoded[index]) - 63 - 1
            index += 1
            result += b << shift
            shift += 5
            if b < 0x1F:
                break
        lng += (~result >> 1) if (result & 1) != 0 else (result >> 1)

        coords.append([lat / 1e5, lng / 1e5])
    return coords


# ---------------------------------------------------------------------------
# Fuel-stop insertion along the polyline
# ---------------------------------------------------------------------------

def _interpolate_fuel_stops(
    polyline: List[List[float]],
    total_miles: float,
    fuel_stop_miles: float = FUEL_STOP_MILES,
) -> List[Dict[str, Any]]:
    stops = []
    if total_miles <= fuel_stop_miles:
        return stops

    cumulative = 0.0
    next_stop_at = fuel_stop_miles
    stop_num = 1

    for i in range(1, len(polyline)):
        p1 = polyline[i - 1]
        p2 = polyline[i]
        seg_miles = _haversine_miles(p1[0], p1[1], p2[0], p2[1])

        while cumulative + seg_miles >= next_stop_at and next_stop_at < total_miles:
            ratio = (next_stop_at - cumulative) / seg_miles if seg_miles > 0 else 0
            ilat = p1[0] + ratio * (p2[0] - p1[0])
            ilon = p1[1] + ratio * (p2[1] - p1[1])
            stops.append({
                "type": "fuel_stop",
                "stop_number": stop_num,
                "miles_into_trip": round(next_stop_at),
                "lat": round(ilat, 6),
                "lon": round(ilon, 6),
            })
            next_stop_at += fuel_stop_miles
            stop_num += 1

        cumulative += seg_miles

    return stops


# ---------------------------------------------------------------------------
# Rest-stop insertion based on HOS schedule
# ---------------------------------------------------------------------------

def _extract_rest_stops(
    schedule_days: List[Dict[str, Any]],
    polyline: List[List[float]],
    total_miles: float,
) -> List[Dict[str, Any]]:
    rest_stops = []
    cumulative_drive_hours = 0.0

    for day in schedule_days:
        for activity in day.get("activities", []):
            if activity["type"] == "driving":
                cumulative_drive_hours += activity.get("duration", 0)
            elif activity["type"] == "off_duty" and activity.get("duration", 0) >= 9.5:
                miles_at_rest = min(
                    cumulative_drive_hours * AVG_SPEED_MPH, total_miles * 0.99
                )
                lat, lon = _position_at_miles(polyline, total_miles, miles_at_rest)
                rest_stops.append({
                    "type": "rest",
                    "day": day["day"],
                    "duration_hours": round(activity["duration"], 1),
                    "miles_into_trip": round(miles_at_rest),
                    "lat": lat,
                    "lon": lon,
                    "description": f"10-hour rest stop (Day {day['day']})",
                })

    return rest_stops


def _position_at_miles(
    polyline: List[List[float]], total_miles: float, target_miles: float
) -> Tuple[float, float]:
    if not polyline:
        return (0.0, 0.0)
    if total_miles <= 0:
        return (polyline[0][0], polyline[0][1])

    target_miles = max(0.0, min(target_miles, total_miles))
    ratio = target_miles / total_miles
    idx = min(int(ratio * (len(polyline) - 1)), len(polyline) - 2)
    p1 = polyline[idx]
    p2 = polyline[idx + 1]
    sub_ratio = (ratio * (len(polyline) - 1)) - idx
    lat = p1[0] + sub_ratio * (p2[0] - p1[0])
    lon = p1[1] + sub_ratio * (p2[1] - p1[1])
    return (round(lat, 6), round(lon, 6))


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def plan_trip(
    current_loc: str,
    pickup_loc: str,
    dropoff_loc: str,
    cycle_used_hours: float,
) -> Dict[str, Any]:
    """
    Orchestrate the full ELD trip plan with high-performance caching.
    """
    # ── Step 1: Fast Geocode (0ms cached/database) ────────────────────
    current_coords  = geocode_location(current_loc)
    pickup_coords   = geocode_location(pickup_loc)
    dropoff_coords  = geocode_location(dropoff_loc)

    # ── Step 2: Route Retrieval with Cache & Single ORS Call ──────────
    route_cache_key = f"{current_coords}|{pickup_coords}|{dropoff_coords}"
    
    total_miles = 0.0
    pickup_miles = 0.0
    polyline: List[List[float]] = []

    if route_cache_key in _ROUTE_CACHE:
        cached = _ROUTE_CACHE[route_cache_key]
        total_miles = cached["total_miles"]
        pickup_miles = cached["pickup_miles"]
        polyline = cached["polyline"]
    else:
        waypoints = [current_coords, pickup_coords, dropoff_coords]
        api_key = os.getenv("ORS_API_KEY", "")

        if api_key:
            try:
                route_data = _fetch_ors_route(waypoints)
                total_miles = route_data["distance_miles"]
                polyline = route_data["polyline"]

                # Extract current->pickup distance directly from ORS segment 0 (ZERO extra network calls!)
                segments = route_data.get("segments", [])
                if segments and len(segments) > 0 and "distance" in segments[0]:
                    pickup_miles = segments[0]["distance"]
                else:
                    pickup_miles = _haversine_miles(*current_coords, *pickup_coords)

                # Store in route cache
                _ROUTE_CACHE[route_cache_key] = {
                    "total_miles": total_miles,
                    "pickup_miles": pickup_miles,
                    "polyline": polyline,
                }
            except Exception as exc:
                logger.warning("ORS route failed: %s – falling back to haversine", exc)
                api_key = ""

        if not api_key:
            c2p = _haversine_miles(*current_coords, *pickup_coords) * 1.25
            p2d = _haversine_miles(*pickup_coords,  *dropoff_coords) * 1.25
            total_miles = c2p + p2d
            pickup_miles = c2p

            def _interp(a, b, n=20):
                return [
                    [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]
                    for i in range(n + 1)
                ]
            polyline = _interp(current_coords, pickup_coords) + _interp(pickup_coords, dropoff_coords)[1:]

    # Driving time estimate (hours)
    total_driving_hours_estimate = total_miles / AVG_SPEED_MPH

    # ── Step 3: HOS schedule ───────────────────────────────────────────
    hos_result = calculate_trip_schedule(
        route_miles=total_miles,
        current_cycle_used_hours=cycle_used_hours,
        pickup_miles=pickup_miles,
        start_date=date.today(),
    )
    schedule_days: List[Dict[str, Any]] = hos_result["days"]
    summary = hos_result["summary"]

    # ── Step 4: Fast In-Memory ELD Logs ────────────────────────────────
    eld_logs: List[str] = []
    for day in schedule_days:
        b64_image = draw_eld_log(
            day_schedule=day,
            date_str=day["date"],
            driver_name="Driver",
            trip_miles=total_miles,
            from_city=current_loc,
            to_city=dropoff_loc,
        )
        eld_logs.append(b64_image)

    # ── Step 5: Build stops list ───────────────────────────────────────
    stops: List[Dict[str, Any]] = []

    stops.append({
        "type": "pickup",
        "location": pickup_loc,
        "lat": pickup_coords[0],
        "lon": pickup_coords[1],
        "description": "Cargo pickup (1 hour on duty)",
    })

    rest_stops = _extract_rest_stops(schedule_days, polyline, total_miles)
    stops.extend(rest_stops)

    fuel_stop_geo = _interpolate_fuel_stops(polyline, total_miles)
    stops.extend(fuel_stop_geo)

    stops.append({
        "type": "dropoff",
        "location": dropoff_loc,
        "lat": dropoff_coords[0],
        "lon": dropoff_coords[1],
        "description": "Cargo dropoff (1 hour on duty)",
    })

    # ── Step 6: Assemble response ──────────────────────────────────────
    return {
        "route": {
            "total_distance_miles": round(total_miles, 2),
            "total_duration_hours": round(total_driving_hours_estimate, 2),
            "polyline_coordinates": polyline,
            "current_location": {
                "name": current_loc,
                "lat": current_coords[0],
                "lon": current_coords[1],
            },
            "stops": stops,
        },
        "schedule": schedule_days,
        "eld_logs": eld_logs,
        "summary": {
            "total_days": summary["total_days"],
            "total_driving_hours": summary["total_driving_hours"],
            "total_miles": round(total_miles, 2),
            "fuel_stops": fuel_stop_geo,
            "fuel_stop_count": len(fuel_stop_geo),
            "rest_stop_count": len(rest_stops),
            "cycle_hours_remaining": summary["cycle_hours_remaining"],
        },
    }
