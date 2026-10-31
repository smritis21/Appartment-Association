"""FastAPI router for the Alerts module (BE-19)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.alert import (
    AlertDeliveryOut,
    AlertOut,
    AlertSummaryOut,
    DeliveryStatus,
    EmergencyAlertCreate,
)
from app.services import alert_service as service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# The literal paths (/emergency) are declared before /{alert_id} so the
# parameterised route cannot swallow them.

@router.post(
    "/emergency",
    response_model=AlertOut,
    status_code=status.HTTP_201_CREATED,
    summary="Broadcast an emergency alert",
    description=(
        "Broadcasts an emergency alert to every active resident and logs a "
        "delivery record for each one.\n\n"
        "**Recipients** are all residents with status `active`. Residents who "
        "are `inactive` or `moved_out` are excluded. Pass `target_block` to "
        "scope the broadcast to a single block/tower; omit it to reach the "
        "whole society.\n\n"
        "**Delivery status is recorded per recipient** in the returned "
        "`deliveries` list - `sent` with a timestamp, or `failed` with a "
        "reason (for example, no phone number on record). A recipient the "
        "notifier cannot reach does not fail the broadcast: the remaining "
        "residents are still notified and the misses are recorded so someone "
        "can follow up in person. The `sent_count` / `failed_count` totals "
        "roll those rows up.\n\n"
        "The whole broadcast is one transaction - either the alert and its "
        "full delivery log are written, or neither is."
    ),
    responses={
        201: {"description": "Alert broadcast and delivery logged"},
        400: {"description": "Unknown target block, or no active residents to notify"},
        422: {"description": "Validation error (missing title, message under 10 characters)"},
    },
)
def broadcast_emergency_alert(
    data: EmergencyAlertCreate,
    db: Session = Depends(get_db),
):
    return service.broadcast_emergency(db, data)


@router.get(
    "",
    response_model=list[AlertSummaryOut],
    summary="List emergency alerts",
    description=(
        "Returns past emergency alerts newest-first with their delivery "
        "counts. Delivery rows are omitted here - a broadcast can carry "
        "hundreds - so fetch `/alerts/{id}/deliveries` for the per-recipient log."
    ),
)
def list_alerts(
    limit: int = Query(
        service.DEFAULT_ALERT_LIMIT,
        ge=1,
        le=200,
        description="Maximum number of alerts to return.",
    ),
    db: Session = Depends(get_db),
):
    return service.list_alerts(db, limit=limit)


@router.get(
    "/{alert_id}",
    response_model=AlertOut,
    summary="Get an alert with its delivery log",
    responses={404: {"description": "Alert not found"}},
)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    return service.get_alert(db, alert_id)


@router.get(
    "/{alert_id}/deliveries",
    response_model=list[AlertDeliveryOut],
    summary="Per-recipient delivery status",
    description=(
        "Returns the delivery record for every recipient of this alert, "
        "sorted by name. Pass `status=failed` to get just the residents who "
        "did not receive it - the list someone would work through by phone "
        "or in person after a broadcast."
    ),
    responses={404: {"description": "Alert not found"}},
)
def get_alert_deliveries(
    alert_id: str,
    delivery_status: DeliveryStatus | None = Query(
        None,
        alias="status",
        description="Only return deliveries with this status (pending/sent/failed).",
    ),
    db: Session = Depends(get_db),
):
    return service.get_deliveries(db, alert_id, delivery_status)
