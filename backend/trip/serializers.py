"""
DRF serializers for request validation and response shaping.
"""

from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    """Validates the incoming POST /api/trip/plan/ request body."""

    current_location = serializers.CharField(
        max_length=200,
        help_text="Driver's current location, e.g. 'Chicago, IL'",
    )
    pickup_location = serializers.CharField(
        max_length=200,
        help_text="Cargo pickup location, e.g. 'Indianapolis, IN'",
    )
    dropoff_location = serializers.CharField(
        max_length=200,
        help_text="Cargo dropoff location, e.g. 'Nashville, TN'",
    )
    current_cycle_used = serializers.FloatField(
        min_value=0.0,
        max_value=70.0,
        help_text="Hours already used in the current 70-hour/8-day cycle (0–70)",
    )

    def validate_current_cycle_used(self, value: float) -> float:
        """Ensure cycle hours are a reasonable value."""
        if value < 0:
            raise serializers.ValidationError("Cycle hours cannot be negative.")
        if value > 70:
            raise serializers.ValidationError(
                "Cycle hours cannot exceed the 70-hour limit."
            )
        return value

    def validate(self, attrs):
        current = attrs.get("current_location", "").strip()
        pickup = attrs.get("pickup_location", "").strip()
        dropoff = attrs.get("dropoff_location", "").strip()

        if not current:
            raise serializers.ValidationError({"current_location": "Current location cannot be empty."})
        if not pickup:
            raise serializers.ValidationError({"pickup_location": "Pickup location cannot be empty."})
        if not dropoff:
            raise serializers.ValidationError({"dropoff_location": "Dropoff location cannot be empty."})

        if pickup.lower() == dropoff.lower():
            raise serializers.ValidationError({
                "dropoff_location": "Pickup location and dropoff location cannot be the same. Cargo must be transported between different facilities."
            })

        if current.lower() == pickup.lower() == dropoff.lower():
            raise serializers.ValidationError(
                "All locations are identical. A trip must have distinct route waypoints."
            )

        return attrs
