"""
URL patterns for the trip application.
"""

from django.urls import path
from .views import PlanTripView, HealthCheckView

urlpatterns = [
    # POST /api/trip/plan/ – main trip planning endpoint
    path("plan/", PlanTripView.as_view(), name="trip-plan"),
    # GET /api/trip/health/ – simple liveness check
    path("health/", HealthCheckView.as_view(), name="trip-health"),
]
