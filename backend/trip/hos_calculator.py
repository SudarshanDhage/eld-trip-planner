"""
HOS (Hours of Service) Calculator for property-carrying drivers.

Implements the FMCSA 70-hour / 8-day cycle rules (49 CFR Part 395):
  - Maximum 11 hours driving after 10 consecutive hours off duty (§395.3(a)(3)(i))
  - 14-hour consecutive on-duty window from the time duty begins (§395.3(a)(2))
  - 30-minute break required after 8 hours cumulative driving (§395.3(a)(3)(ii))
  - 70-hour limit within any 8-day period (§395.3(b))
  - 10 consecutive hours off duty resets shift driving/duty windows (§395.3(a)(1))
  - Fuel stop at least every 1,000 miles (30 min on duty not driving)
  - Shipper pickup (1.0 hr on duty not driving) and receiver dropoff (1.0 hr on duty not driving)
  - Every calendar day strictly accounts for exactly 24.0 hours (midnight to midnight)
"""

from __future__ import annotations
from typing import List, Dict, Any
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# HOS constants (all values in hours unless noted)
# ---------------------------------------------------------------------------
MAX_DRIVING_HOURS = 11.0          # Maximum driving time per shift (§395.3(a)(3)(i))
MAX_ON_DUTY_WINDOW = 14.0         # 14-hour consecutive window (§395.3(a)(2))
REQUIRED_OFF_DUTY = 10.0          # 10-hour consecutive off-duty reset (§395.3(a)(1))
BREAK_AFTER_DRIVING = 8.0         # Mandatory 30-min break trigger (§395.3(a)(3)(ii))
BREAK_DURATION = 0.5              # 30 minutes
MAX_CYCLE_HOURS = 70.0            # 70-hour / 8-day cycle limit
FUEL_STOP_MILES = 1000.0          # Maximum miles between fuel stops
FUEL_STOP_DURATION = 0.5          # Fuel stop takes ~30 minutes (on duty not driving)
AVG_SPEED_MPH = 60.0              # Average highway cruising speed


def calculate_trip_schedule(
    route_miles: float,
    current_cycle_used_hours: float,
    pickup_miles: float = 0.0,
    start_date: date | None = None,
) -> Dict[str, Any]:
    """
    Compute a complete multi-day HOS-compliant trip schedule.

    Parameters
    ----------
    route_miles : float
        Total driving distance for the trip (miles).
    current_cycle_used_hours : float
        Hours already consumed in the driver's current 70-hr/8-day cycle.
    pickup_miles : float
        Distance (miles) from current location to the pickup point.
    start_date : date | None
        Date on which the trip begins. Defaults to today.

    Returns
    -------
    dict with keys:
        days    : list of day-schedule dicts (each strictly summing to 24.0h)
        summary : high-level trip stats
    """
    if start_date is None:
        start_date = date.today()

    days: List[Dict[str, Any]] = []

    miles_remaining = float(route_miles)
    pickup_dist = max(0.0, float(pickup_miles))
    total_miles_driven = 0.0
    miles_since_fuel = 0.0
    total_driving_hours = 0.0
    fuel_stops: List[Dict[str, Any]] = []

    pickup_done = False
    dropoff_done = False

    cycle_hours_used = float(current_cycle_used_hours)

    # Shift-specific counters (reset after 10 consecutive hours off duty)
    shift_driving_hours = 0.0
    shift_elapsed_hours = 0.0
    driving_since_break = 0.0

    # Remaining hours of 10-hr off-duty rest that must be completed before duty can start/resume
    pending_rest_hours = 0.0

    day_index = 0
    MAX_DAYS = 14  # Safety cap

    while (miles_remaining > 0.01 or not dropoff_done) and day_index < MAX_DAYS:
        day_date = start_date + timedelta(days=day_index)
        activities: List[Dict[str, Any]] = []
        current_hour = 0.0
        day_driving = 0.0

        # ------------------------------------------------------------------ #
        # Step A: Apply any carry-over rest from the previous day            #
        # ------------------------------------------------------------------ #
        if pending_rest_hours > 0:
            rest_today = min(24.0, pending_rest_hours)
            activities.append({
                "type": "off_duty",
                "start_hour": 0.0,
                "end_hour": round(rest_today, 4),
                "duration": round(rest_today, 4),
                "description": "10-hour off-duty rest (continued from previous day)",
            })
            current_hour = rest_today
            pending_rest_hours -= rest_today

            if pending_rest_hours <= 0.001:
                pending_rest_hours = 0.0
                # 10 consecutive hours of rest completed! Reset shift counters
                shift_driving_hours = 0.0
                shift_elapsed_hours = 0.0
                driving_since_break = 0.0

        # ------------------------------------------------------------------ #
        # Step B: Driver activities loop within the current 24-hour day      #
        # ------------------------------------------------------------------ #
        while current_hour < 24.0 - 1e-4 and (miles_remaining > 0.01 or not dropoff_done):

            # If driver still has pending rest, cannot perform any duty
            if pending_rest_hours > 0:
                break

            # 1. Check if 10-hour rest is required due to shift limits
            if (shift_driving_hours >= MAX_DRIVING_HOURS - 1e-4 or
                shift_elapsed_hours >= MAX_ON_DUTY_WINDOW - 1e-4):
                rest_needed = REQUIRED_OFF_DUTY
                rest_end = min(24.0, current_hour + rest_needed)
                rest_today = rest_end - current_hour

                activities.append({
                    "type": "off_duty",
                    "start_hour": round(current_hour, 4),
                    "end_hour": round(rest_end, 4),
                    "duration": round(rest_today, 4),
                    "description": "10-hour off-duty rest (HOS shift limit reached)",
                })
                current_hour = rest_end

                if rest_today >= REQUIRED_OFF_DUTY - 1e-4:
                    # Completed full 10 hours today
                    shift_driving_hours = 0.0
                    shift_elapsed_hours = 0.0
                    driving_since_break = 0.0
                    pending_rest_hours = 0.0
                    # Conclude the shift for the rest of today
                    break
                else:
                    # Carries into tomorrow morning
                    pending_rest_hours = REQUIRED_OFF_DUTY - rest_today
                    break

            # 2. Check 70-hour cycle limit
            cycle_remaining = max(0.0, MAX_CYCLE_HOURS - cycle_hours_used)
            if cycle_remaining <= 0.01:
                # Driver is out of cycle hours; must take 34-hour restart (or off duty)
                off_dur = 24.0 - current_hour
                activities.append({
                    "type": "off_duty",
                    "start_hour": round(current_hour, 4),
                    "end_hour": 24.0,
                    "duration": round(off_dur, 4),
                    "description": "Off duty (70-hour cycle limit reached – 34h restart required)",
                })
                current_hour = 24.0
                break

            # 3. Interleave Shipper Pickup (1 hour on duty not driving)
            # Occurs when the driver has reached the pickup location
            if not pickup_done and (total_miles_driven >= pickup_dist - 1e-4):
                p_end = min(24.0, current_hour + 1.0)
                dur = p_end - current_hour
                activities.append({
                    "type": "pickup",
                    "start_hour": round(current_hour, 4),
                    "end_hour": round(p_end, 4),
                    "duration": round(dur, 4),
                    "description": "Pickup – on duty (not driving), 1 hour",
                })
                current_hour = p_end
                shift_elapsed_hours += dur
                cycle_hours_used += dur
                pickup_done = True
                continue

            # 4. Mandatory 30-min break after 8 cumulative hours of driving
            if driving_since_break >= BREAK_AFTER_DRIVING - 1e-4:
                b_end = min(24.0, current_hour + BREAK_DURATION)
                dur = b_end - current_hour
                activities.append({
                    "type": "break",
                    "start_hour": round(current_hour, 4),
                    "end_hour": round(b_end, 4),
                    "duration": round(dur, 4),
                    "description": "Mandatory 30-minute break (FMCSA §395.3)",
                })
                current_hour = b_end
                shift_elapsed_hours += dur
                driving_since_break = 0.0
                continue

            # 5. Fuel stop every 1,000 miles (30 min on duty not driving)
            if miles_since_fuel >= FUEL_STOP_MILES - 1e-4:
                f_end = min(24.0, current_hour + FUEL_STOP_DURATION)
                dur = f_end - current_hour
                activities.append({
                    "type": "fuel_stop",
                    "start_hour": round(current_hour, 4),
                    "end_hour": round(f_end, 4),
                    "duration": round(dur, 4),
                    "description": f"Fuel stop at ~{round(total_miles_driven)} miles",
                })
                fuel_stops.append({
                    "miles_into_trip": round(total_miles_driven),
                    "day": day_index + 1,
                    "hour": round(current_hour, 2),
                })
                current_hour = f_end
                shift_elapsed_hours += dur
                cycle_hours_used += dur
                miles_since_fuel = 0.0
                continue

            # 6. Receiver Dropoff at end of route (1 hour on duty not driving)
            if miles_remaining <= 0.01 and not dropoff_done:
                d_end = min(24.0, current_hour + 1.0)
                dur = d_end - current_hour
                activities.append({
                    "type": "dropoff",
                    "start_hour": round(current_hour, 4),
                    "end_hour": round(d_end, 4),
                    "duration": round(dur, 4),
                    "description": "Dropoff – on duty (not driving), 1 hour",
                })
                current_hour = d_end
                shift_elapsed_hours += dur
                cycle_hours_used += dur
                dropoff_done = True
                continue

            # 7. Calculate next driving segment constrained by all rules
            hours_until_max_drive = MAX_DRIVING_HOURS - shift_driving_hours
            hours_until_14hr = MAX_ON_DUTY_WINDOW - shift_elapsed_hours
            hours_until_break = BREAK_AFTER_DRIVING - driving_since_break
            hours_until_cycle = cycle_remaining
            hours_until_midnight = 24.0 - current_hour
            hours_until_fuel = (FUEL_STOP_MILES - miles_since_fuel) / AVG_SPEED_MPH

            # If pickup is still ahead, driver cannot drive past pickup!
            if not pickup_done:
                miles_to_target = max(0.0, pickup_dist - total_miles_driven)
            else:
                miles_to_target = miles_remaining

            hours_to_target = miles_to_target / AVG_SPEED_MPH

            constraints = [
                hours_until_max_drive,
                hours_until_14hr,
                hours_until_break,
                hours_until_cycle,
                hours_until_midnight,
                hours_to_target,
            ]
            if hours_until_fuel > 0.001:
                constraints.append(hours_until_fuel)

            drive_block = min(constraints)

            if drive_block <= 0.005:
                # No driving possible: shift limit reached or midnight
                if hours_until_max_drive <= 0.01 or hours_until_14hr <= 0.01:
                    rest_needed = REQUIRED_OFF_DUTY
                    rest_end = min(24.0, current_hour + rest_needed)
                    rest_today = rest_end - current_hour
                    activities.append({
                        "type": "off_duty",
                        "start_hour": round(current_hour, 4),
                        "end_hour": round(rest_end, 4),
                        "duration": round(rest_today, 4),
                        "description": "10-hour off-duty rest (HOS shift limit reached)",
                    })
                    current_hour = rest_end
                    if rest_today >= REQUIRED_OFF_DUTY - 1e-4:
                        shift_driving_hours = 0.0
                        shift_elapsed_hours = 0.0
                        driving_since_break = 0.0
                        pending_rest_hours = 0.0
                    else:
                        pending_rest_hours = REQUIRED_OFF_DUTY - rest_today
                    break
                # Reached midnight
                break

            # Execute driving block
            drive_start = current_hour
            drive_end = current_hour + drive_block
            miles_this_block = drive_block * AVG_SPEED_MPH

            # Clamp miles to target
            if miles_this_block > miles_to_target:
                miles_this_block = miles_to_target
                drive_block = miles_this_block / AVG_SPEED_MPH
                drive_end = drive_start + drive_block

            activities.append({
                "type": "driving",
                "start_hour": round(drive_start, 4),
                "end_hour": round(drive_end, 4),
                "duration": round(drive_block, 4),
                "miles": round(miles_this_block, 2),
                "description": f"Driving – {round(miles_this_block)} miles",
            })

            current_hour = drive_end
            shift_driving_hours += drive_block
            shift_elapsed_hours += drive_block
            cycle_hours_used += drive_block
            driving_since_break += drive_block
            miles_remaining -= miles_this_block
            total_miles_driven += miles_this_block
            miles_since_fuel += miles_this_block
            total_driving_hours += drive_block
            day_driving += drive_block

        # ------------------------------------------------------------------ #
        # Step C: Fill remainder of day up to 24.0 with off-duty             #
        # ------------------------------------------------------------------ #
        if current_hour < 24.0:
            rem = 24.0 - current_hour
            activities.append({
                "type": "off_duty",
                "start_hour": round(current_hour, 4),
                "end_hour": 24.0,
                "duration": round(rem, 4),
                "description": "10-hour off-duty rest" if pending_rest_hours > 0 else "Off duty",
            })
            if pending_rest_hours > 0:
                rest_absorbed = min(pending_rest_hours, rem)
                pending_rest_hours -= rest_absorbed
                if pending_rest_hours <= 0.001:
                    pending_rest_hours = 0.0
                    shift_driving_hours = 0.0
                    shift_elapsed_hours = 0.0
                    driving_since_break = 0.0
            current_hour = 24.0

        # Calculate daily totals
        day_on_duty = sum(
            a["duration"]
            for a in activities
            if a["type"] in ("driving", "pickup", "dropoff", "fuel_stop")
        )

        days.append({
            "day": day_index + 1,
            "date": day_date.strftime("%Y-%m-%d"),
            "activities": activities,
            "total_driving_hours": round(day_driving, 2),
            "total_on_duty_hours": round(day_on_duty, 2),
        })

        day_index += 1

    summary = {
        "total_days": len(days),
        "total_driving_hours": round(total_driving_hours, 2),
        "total_miles": round(total_miles_driven, 2),
        "cycle_hours_remaining": round(max(0.0, MAX_CYCLE_HOURS - cycle_hours_used), 2),
        "fuel_stops": fuel_stops,
        "fuel_stop_count": len(fuel_stops),
    }

    return {
        "days": days,
        "summary": summary,
    }
