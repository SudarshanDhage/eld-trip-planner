"""
Django REST Framework views for the ELD Trip Planner API.
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripPlanRequestSerializer
from .route_planner import plan_trip

logger = logging.getLogger(__name__)


class PlanTripView(APIView):
    """
    POST /api/trip/plan/

    Accepts trip parameters, runs HOS calculation, and returns:
      - Route polyline + stop markers
      - Daily HOS schedule
      - Base64-encoded ELD log images
      - Trip summary statistics
    """

    def post(self, request, *args, **kwargs):
        serializer = TripPlanRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"error": "Invalid input", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        try:
            result = plan_trip(
                current_loc=data["current_location"],
                pickup_loc=data["pickup_location"],
                dropoff_loc=data["dropoff_location"],
                cycle_used_hours=data["current_cycle_used"],
            )
            return Response(result, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Trip planning failed: %s", exc)
            return Response(
                {"error": "Trip planning failed", "details": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class HealthCheckView(APIView):
    """GET /api/trip/health/ – simple liveness probe."""

    def get(self, request, *args, **kwargs):
        return Response({"status": "ok", "service": "ELD Trip Planner API"})
