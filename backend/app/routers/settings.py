"""
FastAPI router for the Settings & Configuration module (BE-40).

Preferences are scoped to the authenticated caller - there is no "read
someone else's preferences" endpoint by design; user_id always comes from
the Bearer token, never from the request. Config reads only require a
valid session; writes require the admin role.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.schemas.settings import ConfigOut, ConfigUpdate, PreferenceOut, PreferenceUpdate
from app.services import settings_service as service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "/preferences",
    response_model=PreferenceOut,
    summary="Get my preferences",
    description="Returns the authenticated user's notification, language and theme preferences. "
    "A default row is created automatically on first read.",
)
def get_preferences(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.get_preferences(db, current_user.user_id)


@router.put(
    "/preferences",
    response_model=PreferenceOut,
    summary="Update my preferences",
    description="Updates the authenticated user's preferences. Only the fields supplied are changed.",
    responses={422: {"description": "Validation error - value not one of the allowed options"}},
)
def update_preferences(
    data: PreferenceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.update_preferences(db, current_user.user_id, data)


@router.get(
    "/config",
    response_model=list[ConfigOut],
    summary="List apartment configuration",
    description="Returns every apartment configuration value that has been set, ordered by key.",
)
def list_config(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return service.list_config(db)


@router.get(
    "/config/{key}",
    response_model=ConfigOut,
    summary="Get an apartment configuration value",
    responses={404: {"description": "This config key has not been set"}},
)
def get_config(
    key: str,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return service.get_config(db, key)


@router.put(
    "/config/{key}",
    response_model=ConfigOut,
    summary="Set an apartment configuration value (admin only)",
    description=(
        "Sets or updates a single apartment configuration value. `key` must be one of the "
        "recognised configuration keys (gst_rate, visitor_pass_default_hours, "
        "maintenance_due_day, society_name, emergency_contact_number) and `value` must pass "
        "that key's own validation rule."
    ),
    responses={
        200: {"description": "Config value set"},
        400: {"description": "Unrecognised key, or value fails validation for this key"},
        401: {"description": "No valid Bearer token"},
        403: {"description": "Authenticated but not an admin"},
    },
)
def update_config(
    key: str,
    data: ConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    return service.update_config(db, key, data.value, current_user.user_id, current_user.role)
