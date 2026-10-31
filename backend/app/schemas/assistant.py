"""
Pydantic schemas for the agentic assistant (BE-42).
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ActionStatus = Literal["proposed", "confirmed", "rejected", "expired"]
ReplyKind = Literal["answer", "proposal", "needs_input", "refusal", "fallback", "navigate"]


class ToolInfo(BaseModel):
    """One entry in the tool registry, filtered to what the caller may run."""

    tool: str
    label: str
    description: str
    required: list[str] = []
    optional: list[str] = []


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = Field(
        None,
        description=(
            "Ties this message to the previous one. Send back the "
            "`conversation_id` from the last reply so a half-finished request "
            "- 'the tap is leaking', then 'A-402' - completes as one action."
        ),
    )


class ProposedActionOut(BaseModel):
    action_id: str
    tool: str
    label: str
    params: dict = {}
    summary: str = Field(..., description="Exactly what confirming this will do")
    status: ActionStatus
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatReply(BaseModel):
    """
    One assistant turn.

    `kind` tells the client how to render it:
      answer      - a direct response, nothing to confirm
      proposal    - an action is waiting; show `action` and a confirm button
      needs_input - a slot is missing; `missing` lists what to ask for
      refusal     - the caller's role may not run what they asked for
      navigate    - push `route`; the user asked to be taken somewhere
      fallback    - not understood; `suggestions` offers a way forward
    """

    kind: ReplyKind
    text: str
    conversation_id: Optional[str] = Field(
        None,
        description=(
            "Send this back on the next message to continue the same request. "
            "Present whenever the assistant is waiting on a missing detail."
        ),
    )
    data: dict = Field({}, description="Structured payload backing the answer, if any")
    action: Optional[ProposedActionOut] = None
    destination: Optional[str] = Field(
        None,
        description=(
            "Stable semantic key for the target screen, set when kind is 'navigate' "
            "(e.g. 'temple_donate'). This is the contract - prefer mapping it to your "
            "own route table over using `route` directly."
        ),
    )
    route: Optional[str] = Field(
        None,
        description=(
            "Default client-side path for `destination`, provided as a convenience. "
            "Always a route that exists in the reference app."
        ),
    )
    missing: list[str] = []
    suggestions: list[str] = []
    source: Literal["rules", "llm"] = Field(
        "rules", description="Which path produced the reply text"
    )


class ActionOut(BaseModel):
    action_id: str
    tool: str
    params: dict = {}
    summary: str
    status: ActionStatus
    result_ref: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
