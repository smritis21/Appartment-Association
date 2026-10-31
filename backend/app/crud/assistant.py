"""CRUD operations for the agentic assistant (BE-42)."""

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.assistant import AssistantAction


def get_action(db: Session, action_id: str) -> AssistantAction | None:
    return db.query(AssistantAction).filter(AssistantAction.action_id == action_id).first()


def create_action(
    db: Session,
    user_id: str,
    tool: str,
    params: dict,
    summary: str,
    expires_at: datetime,
) -> AssistantAction:
    action = AssistantAction(
        user_id=user_id,
        tool=tool,
        params=json.dumps(params, default=str),
        summary=summary,
        expires_at=expires_at,
    )
    db.add(action)
    return action


def list_actions(
    db: Session,
    user_id: str,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[AssistantAction]:
    query = db.query(AssistantAction).filter(AssistantAction.user_id == user_id)
    if status:
        query = query.filter(AssistantAction.status == status)
    return (
        query.order_by(AssistantAction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
