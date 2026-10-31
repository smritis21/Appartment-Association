# SQLAlchemy models - one file per domain entity.
# Import all models here so Alembic can discover them for migrations.
from app.models.resident import EmergencyContact, FamilyMember, Flat, Resident  # noqa: F401
from app.models.payment import Bill, Payment  # noqa: F401
from app.models.announcement import Announcement  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.complaint import Complaint, ComplaintFeedback, ComplaintProgressLog, Staff  # noqa: F401
from app.models.visitor import Visitor  # noqa: F401
from app.models.maintenance import MaintenanceSchedule  # noqa: F401
from app.models.reminder import PaymentReminder  # noqa: F401
from app.models.alert import Alert, AlertDelivery  # noqa: F401
from app.models.event import Event, EventRegistration  # noqa: F401  - BE-31 community hub events
from app.models.facility import Facility, FacilityBooking  # noqa: F401  - BE-32 facility slot booking
from app.models.marketplace import MarketplaceListing, WishlistEntry  # noqa: F401  - BE-30 buy & sell marketplace
from app.models.community import ActivitySignup, CommunityActivity  # noqa: F401
from app.models.temple import TempleBooking, TempleDonation, TempleEvent, TempleEventSignup  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.communication import Circular, Poll, PollResponse  # noqa: F401
from app.models.user import User  # noqa: F401  - BE-21 authentication
from app.models.onboarding import OnboardingApplication, UploadedDocument  # noqa: F401  - BE-22 onboarding
from app.models.forum import ForumPost, ForumComment, LostFoundItem  # noqa: F401  - BE-29 forum & lost-and-found
from app.models.shift import StaffAttendance, StaffShift  # noqa: F401  - BE-35 staff attendance & shifts
from app.models.workforce import (  # noqa: F401  - BE-26 workforce management
    HouseHelp,
    HouseHelpAttendance,
    HouseHelpBooking,
    HouseHelpRating,
    Provider,
    ProviderJob,
)
from app.models.settings import ApartmentConfig, UserPreference  # noqa: F401  - BE-40 settings & configuration
from app.models.assistant import AssistantAction  # noqa: F401  - BE-42 agentic assistant
from app.models.move_slot import MoveSlot  # noqa: F401  - EN-22 move-slot conflict detection
