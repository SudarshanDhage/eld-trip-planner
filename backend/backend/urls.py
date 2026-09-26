"""
Root URL configuration for the ELD Trip Planner API.
"""

from django.urls import path, include

urlpatterns = [
    # All trip-related endpoints are namespaced under /api/trip/
    path("api/trip/", include("trip.urls")),
]
