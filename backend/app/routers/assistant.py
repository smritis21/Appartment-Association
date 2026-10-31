"""
FastAPI router for the agentic assistant (BE-42).

Every endpoint requires a Bearer token. The assistant acts *as* the caller -
identity for every write comes from the token, never from the chat message -
so there is no anonymous mode.

Chat itself is deliberately non-mutating: it can only ever propose. The two
POSTs under /actions are the only places the assistant writes anything.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.schemas.assistant import ActionOut, ChatReply, ChatRequest, ToolInfo
from app.services import assistant_service as service

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


@router.get(
    "/tools",
    response_model=list[ToolInfo],
    summary="List what the assistant can do for you",
    description=(
        "Returns the actions the authenticated caller is allowed to run, with the "
        "parameters each one needs. The list is filtered by role, so a client can "
        "render only buttons that will actually work."
    ),
    responses={401: {"description": "No valid Bearer token"}},
)
def list_tools(current_user=Depends(get_current_user)):
    return service.list_tools(current_user.role)


@router.post(
    "/chat",
    response_model=ChatReply,
    summary="Send a message to the assistant",
    description=(
        "Interprets one natural-language message and replies. This endpoint never "
        "writes to the database - at most it *proposes* an action, which the caller "
        "then confirms separately.\n\n"
        "`kind` says how to render the reply: `answer` (direct response), `proposal` "
        "(an action is waiting, show `action` and a confirm button), `needs_input` "
        "(a required field is missing, see `missing`), `refusal` (role not permitted) "
        "or `fallback` (not understood).\n\n"
        "Interpretation is deterministic and runs with no API key. A configured AI "
        "provider is used only to reword replies, never to choose or widen an action - "
        "the action set is a closed registry in the backend."
    ),
    responses={
        200: {"description": "Assistant reply"},
        401: {"description": "No valid Bearer token"},
        422: {"description": "Empty or oversized message"},
    },
)
def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.chat(
        db,
        current_user,
        data.message,
        conversation_id=data.conversation_id,
    )


@router.post(
    "/actions/{action_id}/confirm",
    response_model=ActionOut,
    summary="Confirm a proposed action",
    description=(
        "Executes a previously proposed action by delegating to the module that owns "
        "it, so the same validation applies as on the module's own REST endpoint.\n\n"
        "Ownership, role and expiry are all re-checked here rather than trusted from "
        "propose time - a role can change between the two requests, and a stale "
        "proposal must not be replayable."
    ),
    responses={
        200: {"description": "Action executed"},
        401: {"description": "No valid Bearer token"},
        403: {"description": "Action belongs to another user, or role may not run it"},
        404: {"description": "Action not found"},
        409: {"description": "Action was already confirmed or rejected"},
        410: {"description": "Proposal expired"},
    },
)
def confirm_action(
    action_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.confirm_action(db, action_id, current_user)


@router.post(
    "/actions/{action_id}/reject",
    response_model=ActionOut,
    summary="Reject a proposed action",
    description="Discards a proposal without running it. The record is kept for the audit trail.",
    responses={
        200: {"description": "Action rejected"},
        401: {"description": "No valid Bearer token"},
        403: {"description": "Action belongs to another user"},
        404: {"description": "Action not found"},
        409: {"description": "Action was already confirmed or rejected"},
    },
)
def reject_action(
    action_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.reject_action(db, action_id, current_user)


@router.get(
    "/actions",
    response_model=list[ActionOut],
    summary="Your assistant action history",
    description=(
        "Returns every action the assistant proposed to the authenticated caller, "
        "newest first, with what happened to each. This is the audit trail for "
        "anything the assistant did on their behalf."
    ),
    responses={401: {"description": "No valid Bearer token"}},
)
def list_actions(
    status: str | None = Query(None, description="proposed / confirmed / rejected / expired"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.list_actions(db, current_user, status_filter=status, skip=skip, limit=limit)
