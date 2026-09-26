# ELD Trip Planner

A full-stack web application for FMCSA-compliant ELD (Electronic Logging Device) trip planning.  
Enter a route and the app generates an HOS-compliant schedule, a Leaflet route map, and filled-out ELD daily log sheets.

---

## Tech Stack

| Layer    | Technology                                               |
|----------|----------------------------------------------------------|
| Backend  | Django 5 + Django REST Framework                        |
| Drawing  | Pillow (PIL) – renders ELD logs on the blank template   |
| Routing  | OpenRouteService API (free tier) + haversine fallback   |
| Frontend | React 18 + Vite + Tailwind CSS                          |
| Map      | Leaflet.js / react-leaflet (OpenStreetMap – no key)     |
| HTTP     | Axios                                                    |

---

## Project Structure

```
eld_trip_planner/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example            ← copy to .env and fill in ORS_API_KEY
│   ├── static/trip/
│   │   └── blank-paper-log.png ← ELD template (513×518 px)
│   ├── backend/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── trip/
│       ├── views.py            ← DRF API views
│       ├── urls.py
│       ├── serializers.py      ← request validation
│       ├── hos_calculator.py   ← FMCSA HOS rules engine
│       ├── eld_drawer.py       ← Pillow ELD log renderer
│       └── route_planner.py    ← ORS integration + orchestration
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── TripForm.jsx       ← Input form with validation
            ├── RouteMap.jsx       ← Leaflet map with markers
            ├── ELDLogViewer.jsx   ← Day tabs + ELD images + activity table
            └── TripSummary.jsx    ← Stat cards
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) An [OpenRouteService](https://openrouteservice.org/) free API key

> **Without an ORS API key** the app falls back to a built-in US city geocoder and haversine straight-line distances.  
> The HOS schedule and ELD logs still work correctly; only the map polyline is simplified.

---

## Quick Start

### 1 – Backend

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env and set ORS_API_KEY (optional but recommended)

# Run migrations (SQLite – only needed for Django admin)
python manage.py migrate

# Start the development server
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000`.

### 2 – Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Reference

### `POST /api/trip/plan/`

**Request body**

```json
{
  "current_location": "Chicago, IL",
  "pickup_location":  "Indianapolis, IN",
  "dropoff_location": "Nashville, TN",
  "current_cycle_used": 32.5
}
```

| Field                | Type   | Description                              |
|----------------------|--------|------------------------------------------|
| `current_location`   | string | Driver's current city/state              |
| `pickup_location`    | string | Cargo pickup city/state                  |
| `dropoff_location`   | string | Cargo dropoff city/state                 |
| `current_cycle_used` | float  | Hours already used in 70-hr/8-day cycle  |

**Response** (200 OK)

```json
{
  "route": {
    "total_distance_miles": 452.3,
    "total_duration_hours": 7.54,
    "polyline_coordinates": [[41.87, -87.63], ...],
    "current_location": {"name": "Chicago, IL", "lat": 41.87, "lon": -87.63},
    "stops": [
      {"type": "pickup",    "location": "Indianapolis, IN", "lat": 39.77, "lon": -86.16},
      {"type": "rest",      "duration_hours": 10, "lat": 38.4, "lon": -87.1},
      {"type": "fuel_stop", "miles_into_trip": 1000, "lat": 36.9, "lon": -86.9},
      {"type": "dropoff",   "location": "Nashville, TN",   "lat": 36.16, "lon": -86.78}
    ]
  },
  "schedule": [
    {
      "day": 1,
      "date": "2024-09-25",
      "activities": [
        {"type": "driving",  "start_hour": 0, "end_hour": 8,    "miles": 480},
        {"type": "break",    "start_hour": 8, "end_hour": 8.5              },
        {"type": "driving",  "start_hour": 8.5, "end_hour": 11, "miles": 150},
        {"type": "off_duty", "start_hour": 11,  "end_hour": 24             }
      ],
      "total_driving_hours": 10.5,
      "total_on_duty_hours": 11.0
    }
  ],
  "eld_logs": ["<base64_png_day1>", "<base64_png_day2>"],
  "summary": {
    "total_days": 2,
    "total_driving_hours": 7.54,
    "total_miles": 452.3,
    "fuel_stops": [],
    "fuel_stop_count": 0,
    "rest_stop_count": 0,
    "cycle_hours_remaining": 27.96
  }
}
```

### `GET /api/trip/health/`

Returns `{"status": "ok", "service": "ELD Trip Planner API"}`.

---

## HOS Rules Implemented (49 CFR Part 395)

| Rule                          | Value                        |
|-------------------------------|------------------------------|
| Max driving per shift         | 11 hours                     |
| Max on-duty window            | 14 hours (from duty start)   |
| Mandatory break after driving | 30 min after 8 hours driving |
| Required off-duty reset       | 10 consecutive hours         |
| 8-day cycle limit             | 70 hours total               |
| Fuel stop interval            | Every 1,000 miles            |
| Average speed (calculation)   | 60 mph                       |
| Pickup / dropoff time         | 1 hour each (on duty, ND)    |

---

## ELD Log Drawing

The ELD log renderer (`eld_drawer.py`) uses Pillow to:

1. Load `static/trip/blank-paper-log.png` (513×518 px)
2. Scale 2× for clarity (1026×1036 px)
3. Draw colour-coded horizontal lines in the four duty-status rows:
   - **Blue** – Off Duty / 30-min Break
   - **Red**  – Driving
   - **Orange** – On Duty, Not Driving (pickup, dropoff, fuel)
   - **Green** – Sleeper Berth
4. Overlay header info (date, driver, miles, cities)
5. Add an hour-marker ruler and colour legend
6. Return the result as a base64-encoded PNG

Grid pixel coordinates (measured from actual template):

| Row              | Centre Y (original) | Colour  |
|------------------|---------------------|---------|
| Off Duty         | 163 px              | Blue    |
| Sleeper Berth    | 178 px              | Green   |
| Driving          | 192 px              | Red     |
| On Duty (ND)     | 209 px              | Orange  |
| Grid X span      | 20 – 437 px         | 24 hrs  |

---

## Environment Variables

| Variable      | Required | Description                              |
|---------------|----------|------------------------------------------|
| `ORS_API_KEY` | Optional | OpenRouteService API key for routing     |
| `SECRET_KEY`  | Yes (prod)| Django secret key                       |
| `DEBUG`       | Optional | `True` (dev) / `False` (prod)            |
| `ALLOWED_HOSTS`| Yes (prod)| Comma-separated list of allowed hosts  |

---

## Production Notes

- Set `DEBUG=False` and a strong random `SECRET_KEY`
- Configure `ALLOWED_HOSTS` for your domain
- Serve static files with nginx / whitenoise
- Use a production WSGI server (gunicorn / uvicorn)
- The frontend builds to `frontend/dist/` with `npm run build`

---

## License

MIT – For demonstration purposes only. Not for use in actual FMCSA compliance applications without further validation.
