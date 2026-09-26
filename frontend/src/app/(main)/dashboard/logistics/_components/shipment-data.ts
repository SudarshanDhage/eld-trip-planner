export type GeoCoordinate = [longitude: number, latitude: number];

export type RouteStop = {
  type: string;
  location?: string;
  lat: number;
  lon: number;
  description?: string;
  duration_hours?: number;
  miles_into_trip?: number;
  day?: number;
  stop_number?: number;
};

export type DayActivity = {
  type: string;
  start_hour: number;
  end_hour: number;
  duration: number;
  description: string;
  miles?: number;
};

export type DaySchedule = {
  day: number;
  date: string;
  total_driving_hours: number;
  total_on_duty_hours: number;
  activities: DayActivity[];
};

export type TripPlanData = {
  route: {
    total_distance_miles: number;
    total_duration_hours: number;
    polyline_coordinates: [number, number][] | number[][];
    start_location?: string;
    current_location?: {
      name: string;
      lat: number;
      lon: number;
    };
    stops: RouteStop[];
  };
  schedule: DaySchedule[];
  eld_logs: string[];
  summary: {
    total_days: number;
    total_driving_hours: number;
    total_miles: number;
    cycle_hours_remaining: number;
    fuel_stop_count?: number;
    rest_stop_count?: number;
    fuel_stops?: any[];
  };
};

export type Shipment = {
  id: string;
  createdAt: string;
  currentLocation: string;
  pickupLocation: string;
  dropoffLocation: string;
  currentCycleUsed: number;
  origin: {
    coordinates: GeoCoordinate;
    display: string;
  };
  destination: {
    coordinates: GeoCoordinate;
    display: string;
  };
  planData: TripPlanData;
};
