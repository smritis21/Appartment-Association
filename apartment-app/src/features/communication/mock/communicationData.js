// Mock data for Communication features
// FE-03, FE-04, FE-08, FE-09, FE-19, FE-27, FE-29, FE-31, FE-34, FE-37

// ─── Notifications (FE-03, FE-37) ────────────────────────────────────────────
let notificationsData = [
  {
    id: "n1",
    type: "complaint",
    title: "Complaint Status Updated",
    message: "Your complaint #C-1245 (Leaky pipe in bathroom) has been moved to In Progress.",
    time: "2 min ago",
    read: false,
  },
  {
    id: "n2",
    type: "visitor",
    title: "Visitor Approval Request",
    message: "Rahul Sharma is requesting entry at 6:00 PM. Please approve or decline.",
    time: "15 min ago",
    read: false,
  },
  {
    id: "n3",
    type: "payment",
    title: "Payment Reminder",
    message: "May 2025 Maintenance due in 3 days. Amount: ₹5,600. Please pay before 20 May.",
    time: "1 hr ago",
    read: false,
  },
  {
    id: "n4",
    type: "announcement",
    title: "New Announcement",
    message: "Water Supply Maintenance on 20 May 2PM–4PM. Please store water in advance.",
    time: "2 hr ago",
    read: true,
  },
  {
    id: "n5",
    type: "event",
    title: "Event RSVP Confirmed",
    message: "Your RSVP for 'Yoga Session – 18 May' has been confirmed. See you at 7 AM!",
    time: "5 hr ago",
    read: true,
  },
  {
    id: "n6",
    type: "emergency",
    title: "Emergency Alert",
    message: "Fire drill scheduled for tomorrow (22 May) at 10:00 AM. Please follow evacuation guidelines.",
    time: "1 day ago",
    read: true,
  },
  {
    id: "n7",
    type: "booking",
    title: "Facility Booking Confirmed",
    message: "Community Hall booking on 25 May (6 PM–9 PM) has been confirmed.",
    time: "2 days ago",
    read: true,
  },
  {
    id: "n8",
    type: "forum",
    title: "New Comment on Your Post",
    message: "Priya Mehta commented on your Lost & Found post: 'Is it a black wallet?'",
    time: "3 days ago",
    read: true,
  },
];

export const getNotifications = () => [...notificationsData];

export const getUnreadCount = () =>
  notificationsData.filter((n) => !n.read).length;

export const markNotificationRead = (id) => {
  notificationsData = notificationsData.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
};

export const markAllNotificationsRead = () => {
  notificationsData = notificationsData.map((n) => ({ ...n, read: true }));
};

export const clearAllNotifications = () => {
  notificationsData = [];
};

// ─── Announcements (FE-04, FE-08, FE-09) ─────────────────────────────────────
let announcementsData = [
  {
    id: "a1",
    title: "Water Supply Maintenance - 20 May",
    body: "Water supply will be interrupted from 2:00 PM to 4:00 PM on 20 May 2025 for essential pipe maintenance. Please store adequate water in advance. We regret any inconvenience caused.",
    category: "Maintenance",
    author: "Association President",
    date: "15 May 2025",
    pinned: true,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-05-15"),
  },
  {
    id: "a2",
    title: "Society AGM - 1 June 2025",
    body: "The Annual General Meeting of Jains Kences Retreat will be held on 1 June 2025 at 11:00 AM in the Community Hall. All flat owners are requested to attend. Agenda and Zoom link will be shared separately.",
    category: "Event",
    author: "Association President",
    date: "12 May 2025",
    pinned: true,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-05-12"),
  },
  {
    id: "a3",
    title: "Updated Parking Rules - Effective 1 June",
    body: "Kindly note the revised parking guidelines effective from 1 June 2025. Each flat is allotted one covered and one open parking slot. Visitors must park in designated visitor zones only. Violating vehicles will be towed.",
    category: "General",
    author: "Association Secretary",
    date: "10 May 2025",
    pinned: false,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-05-10"),
  },
  {
    id: "a4",
    title: "Diwali Celebration - 20 October",
    body: "Join us for the annual Diwali celebration on 20 October 2025 from 7:00 PM at the Society Grounds. Activities include rangoli, cultural performances, and a grand fireworks display. All residents and their families are welcome!",
    category: "Event",
    author: "Cultural Committee",
    date: "8 May 2025",
    pinned: false,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-05-08"),
  },
  {
    id: "a5",
    title: "Lift Maintenance - Tower C",
    body: "The lift in Tower C will be under maintenance on 17 May 2025 from 9:00 AM to 2:00 PM. Residents are requested to use the stairs during this period. We apologise for the inconvenience.",
    category: "Maintenance",
    author: "Facility Management",
    date: "5 May 2025",
    pinned: false,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-05-05"),
  },
  {
    id: "a6",
    title: "Maintenance Charges - FY 2025-26",
    body: "The monthly maintenance charge for FY 2025-26 will be ₹5,600 per flat, effective from 1 April 2025. This covers common area electricity, security, housekeeping, and facility upkeep. Bills will be generated on the 1st of each month.",
    category: "Finance",
    author: "Treasurer",
    date: "1 April 2025",
    pinned: false,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-04-01"),
  },
  {
    id: "a7",
    title: "Security Protocol Update",
    body: "Effective immediately, all guests must present a valid government-issued ID at the gate. Residents must pre-register expected visitors through the app's Visitor Management module. Walk-in guests will require OTP verification.",
    category: "Safety",
    author: "Security Committee",
    date: "28 March 2025",
    pinned: false,
    draft: false,
    scheduledFor: null,
    createdAt: new Date("2025-03-28"),
  },
  {
    id: "a8",
    title: "Draft: Independence Day Events",
    body: "Planning Independence Day celebrations for 15 August 2025. Proposed activities include flag hoisting, cultural program, and community lunch. Details TBD.",
    category: "Event",
    author: "Association President",
    date: "Draft",
    pinned: false,
    draft: true,
    scheduledFor: "2025-08-01",
    createdAt: new Date("2025-05-16"),
  },
];

export const getAnnouncements = () =>
  announcementsData.filter((a) => !a.draft);

export const getDraftAnnouncements = () =>
  announcementsData.filter((a) => a.draft);

export const getAllAnnouncements = () => [...announcementsData];

export const addAnnouncement = (announcement) => {
  const newAnn = {
    id: `a${Date.now()}`,
    author: "Association President",
    date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    pinned: false,
    createdAt: new Date(),
    ...announcement,
  };
  announcementsData = [newAnn, ...announcementsData];
  return newAnn;
};

// ─── Community Events (FE-31) ─────────────────────────────────────────────────
export const eventsData = [
  {
    id: "ev1",
    title: "Community Yoga Session",
    category: "Wellness",
    date: "18 May 2025",
    time: "7:00 AM – 8:30 AM",
    venue: "Community Hall, Ground Floor",
    description: "Start your week with an energising yoga session led by certified instructor Ms. Ananya Rao. Open to all age groups. Bring your own yoga mat.",
    capacity: 30,
    rsvpCount: 22,
    volunteerCount: 3,
    status: "Open",
    userRsvp: true,
    userVolunteer: false,
    type: "upcoming",
    imageUrl: null,
  },
  {
    id: "ev2",
    title: "Blood Donation Camp",
    category: "Health",
    date: "25 May 2025",
    time: "9:00 AM – 1:00 PM",
    venue: "Community Hall, Ground Floor",
    description: "Partnering with Red Cross Society for a voluntary blood donation camp. All healthy adults between 18–60 years are encouraged to donate. Refreshments provided.",
    capacity: 50,
    rsvpCount: 38,
    volunteerCount: 8,
    status: "Open",
    userRsvp: false,
    userVolunteer: false,
    type: "upcoming",
    imageUrl: null,
  },
  {
    id: "ev3",
    title: "Kids Summer Art Workshop",
    category: "Kids",
    date: "1 June 2025",
    time: "10:00 AM – 12:00 PM",
    venue: "Activity Room, Tower A",
    description: "A creative art workshop for children aged 5–14. Activities include painting, craft-making, and origami. Materials will be provided. Prior registration required.",
    capacity: 20,
    rsvpCount: 20,
    volunteerCount: 4,
    status: "Full",
    userRsvp: false,
    userVolunteer: false,
    type: "upcoming",
    imageUrl: null,
  },
  {
    id: "ev4",
    title: "Independence Day Celebration",
    category: "Festival",
    date: "15 August 2025",
    time: "8:00 AM onwards",
    venue: "Society Grounds",
    description: "Join us for the 79th Independence Day celebration with flag hoisting, cultural performances, and a community breakfast. All residents and families welcome.",
    capacity: 300,
    rsvpCount: 145,
    volunteerCount: 20,
    status: "Open",
    userRsvp: false,
    userVolunteer: false,
    type: "upcoming",
    imageUrl: null,
  },
  {
    id: "ev5",
    title: "Holi Celebration 2025",
    category: "Festival",
    date: "14 March 2025",
    time: "10:00 AM – 2:00 PM",
    venue: "Society Grounds",
    description: "A joyful Holi celebration with organic colours, music, and community lunch.",
    capacity: 200,
    rsvpCount: 187,
    volunteerCount: 15,
    status: "Closed",
    userRsvp: false,
    userVolunteer: false,
    type: "past",
    imageUrl: null,
  },
  {
    id: "ev6",
    title: "Republic Day Flag Hoisting",
    category: "Festival",
    date: "26 January 2025",
    time: "8:30 AM",
    venue: "Society Grounds",
    description: "National flag hoisting ceremony followed by patriotic cultural program.",
    capacity: 300,
    rsvpCount: 210,
    volunteerCount: 12,
    status: "Closed",
    userRsvp: false,
    userVolunteer: false,
    type: "past",
    imageUrl: null,
  },
];

// ─── Community Corners (FE-34) ────────────────────────────────────────────────
export const cornersData = [
  // Kids Corner
  {
    id: "c1",
    corner: "kids",
    title: "Weekend Story Time",
    description: "Interactive story reading sessions for kids aged 4–10. Builds vocabulary and imagination.",
    schedule: "Every Saturday, 4:00 PM – 5:00 PM",
    location: "Activity Room, Tower A",
    instructor: "Ms. Divya Joshi",
    spots: 20,
    enrolled: 14,
    status: "upcoming",
    userJoined: false,
  },
  {
    id: "c2",
    corner: "kids",
    title: "Summer Coding Camp",
    description: "Beginner-friendly coding sessions for kids aged 10–14 using Scratch and block programming.",
    schedule: "Mon, Wed, Fri - 5:00 PM – 6:00 PM",
    location: "Computer Room, Tower B",
    instructor: "Mr. Rohan Kulkarni",
    spots: 15,
    enrolled: 15,
    status: "ongoing",
    userJoined: true,
  },
  {
    id: "c3",
    corner: "kids",
    title: "Drawing & Painting Basics",
    description: "Art fundamentals for children aged 6–12. Materials provided by the society.",
    schedule: "Every Sunday, 11:00 AM – 12:30 PM",
    location: "Activity Room, Tower A",
    instructor: "Ms. Kavya Nair",
    spots: 18,
    enrolled: 12,
    status: "upcoming",
    userJoined: false,
  },
  // Senior Citizens
  {
    id: "c4",
    corner: "senior",
    title: "Morning Yoga & Breathing",
    description: "Gentle yoga and pranayama designed for seniors. Suitable for all fitness levels.",
    schedule: "Mon, Wed, Fri - 6:30 AM – 7:30 AM",
    location: "Terrace Garden, Tower C",
    instructor: "Dr. Sunil Patel",
    spots: 25,
    enrolled: 20,
    status: "ongoing",
    userJoined: false,
  },
  {
    id: "c5",
    corner: "senior",
    title: "Health Awareness Talk",
    description: "Monthly talk by resident doctors on health topics relevant to seniors - BP, diabetes, joint care.",
    schedule: "Last Sunday of the month, 10:00 AM",
    location: "Community Hall, Ground Floor",
    instructor: null,
    spots: 50,
    enrolled: 32,
    status: "upcoming",
    userJoined: false,
  },
  {
    id: "c6",
    corner: "senior",
    title: "Antakshari Evening",
    description: "Fun singing sessions to connect and socialise. All Bollywood classics welcome!",
    schedule: "Every Friday, 6:30 PM – 8:00 PM",
    location: "Community Hall",
    instructor: null,
    spots: 40,
    enrolled: 28,
    status: "upcoming",
    userJoined: false,
  },
  // Recreational
  {
    id: "c7",
    corner: "recreational",
    title: "Badminton League",
    description: "Doubles badminton tournament across 4 towers. Register your pair to participate.",
    schedule: "Weekends, 7:00 AM – 9:00 AM",
    location: "Sports Court, Block D",
    instructor: null,
    spots: 32,
    enrolled: 28,
    status: "ongoing",
    userJoined: false,
  },
  {
    id: "c8",
    corner: "recreational",
    title: "DIY Home Decor Workshop",
    description: "Learn macramé, canvas painting, and upcycling techniques. All materials included.",
    schedule: "2nd & 4th Saturday, 3:00 PM – 5:00 PM",
    location: "Activity Room, Tower A",
    instructor: "Ms. Priya Agarwal",
    spots: 16,
    enrolled: 10,
    status: "upcoming",
    userJoined: false,
  },
  // Social Circle
  {
    id: "c9",
    corner: "social",
    title: "New Resident Welcome Committee",
    description: "Volunteer to welcome and orient new residents joining our community.",
    schedule: "As needed",
    location: "Society Office",
    instructor: null,
    spots: null,
    enrolled: 12,
    status: "ongoing",
    userJoined: false,
  },
  {
    id: "c10",
    corner: "social",
    title: "Green Society Drive",
    description: "Join the plantation and composting initiative to make our society eco-friendly.",
    schedule: "Every Sunday morning, 8:00 AM – 10:00 AM",
    location: "Society Grounds",
    instructor: null,
    spots: null,
    enrolled: 18,
    status: "upcoming",
    userJoined: false,
  },
];

// ─── Forum / Lost & Found (FE-29) ─────────────────────────────────────────────
let forumPostsData = [
  {
    id: "f1",
    category: "General",
    title: "Proposal: Rooftop Garden for all residents",
    body: "I'd like to propose a community rooftop garden where residents can grow herbs, flowers, and vegetables. Would be great for both environment and bonding. Thoughts?",
    author: "Rajesh Verma",
    flat: "A-102",
    createdAt: new Date("2025-05-14T10:30:00"),
    comments: [
      { id: "fc1", author: "Priya Mehta", flat: "B-204", body: "Love this idea! Count me in.", createdAt: new Date("2025-05-14T11:15:00") },
      { id: "fc2", author: "Suresh Iyer", flat: "C-301", body: "We need to check with the management first regarding structural feasibility.", createdAt: new Date("2025-05-14T14:00:00") },
    ],
    likes: 14,
    userLiked: true,
  },
  {
    id: "f2",
    category: "Suggestions",
    title: "Better lighting needed on B-block pathway",
    body: "The path from Tower B to the parking lot is very poorly lit at night. This is a safety concern especially for ladies and senior citizens. Request the association to install adequate lighting ASAP.",
    author: "Meena Sharma",
    flat: "B-105",
    createdAt: new Date("2025-05-13T18:20:00"),
    comments: [
      { id: "fc3", author: "Arjun Pillai", flat: "President", body: "Thank you for raising this. We will inspect and address it by the end of this week.", createdAt: new Date("2025-05-13T19:00:00") },
    ],
    likes: 21,
    userLiked: false,
  },
  {
    id: "f3",
    category: "Lost & Found",
    title: "Lost: Black wallet near swimming pool",
    body: "I lost my black leather wallet near the swimming pool area on 13 May evening. It has my Aadhaar card and driving licence. If found, please contact me at Flat A-201. Will be grateful!",
    author: "Amit Desai",
    flat: "A-201",
    createdAt: new Date("2025-05-13T20:00:00"),
    resolved: false,
    comments: [
      { id: "fc4", author: "Kavya Nair", flat: "C-402", body: "I think I saw a wallet at the pool-side bench. Will check tomorrow morning.", createdAt: new Date("2025-05-13T21:30:00") },
    ],
    likes: 5,
    userLiked: false,
  },
  {
    id: "f4",
    category: "Recommendations",
    title: "Recommend: Excellent plumber - Suresh Kumar",
    body: "Suresh Kumar (9876543210) did a fantastic job fixing our bathroom taps and drainage. Very professional and reasonably priced. Highly recommend to fellow residents!",
    author: "Geeta Rao",
    flat: "C-203",
    createdAt: new Date("2025-05-11T09:00:00"),
    comments: [],
    likes: 18,
    userLiked: false,
  },
  {
    id: "f5",
    category: "Lost & Found",
    title: "Found: Grey umbrella at main gate",
    body: "Found a grey coloured umbrella at the main gate on 12 May. Please contact the security desk or reach me at Flat B-301 to claim.",
    author: "Rahul Joshi",
    flat: "B-301",
    createdAt: new Date("2025-05-12T17:00:00"),
    resolved: true,
    comments: [
      { id: "fc5", author: "Priya Mehta", flat: "B-204", body: "That's mine! Coming to pick it up now. Thank you so much!", createdAt: new Date("2025-05-12T17:45:00") },
    ],
    likes: 3,
    userLiked: false,
  },
];

export const getForumPosts = () => [...forumPostsData];

export const addForumPost = (post) => {
  const newPost = {
    id: `f${Date.now()}`,
    author: "Rajesh Verma",
    flat: "A-102",
    createdAt: new Date(),
    comments: [],
    likes: 0,
    userLiked: false,
    resolved: post.category === "Lost & Found" ? false : undefined,
    ...post,
  };
  forumPostsData = [newPost, ...forumPostsData];
  return newPost;
};

export const addForumComment = (postId, comment) => {
  forumPostsData = forumPostsData.map((p) =>
    p.id === postId
      ? {
          ...p,
          comments: [
            ...p.comments,
            {
              id: `fc${Date.now()}`,
              author: "Rajesh Verma",
              flat: "A-102",
              createdAt: new Date(),
              ...comment,
            },
          ],
        }
      : p
  );
};

export const toggleForumLike = (postId) => {
  forumPostsData = forumPostsData.map((p) =>
    p.id === postId
      ? { ...p, userLiked: !p.userLiked, likes: p.userLiked ? p.likes - 1 : p.likes + 1 }
      : p
  );
};

export const toggleLostFoundResolved = (postId) => {
  forumPostsData = forumPostsData.map((p) =>
    p.id === postId && p.category === "Lost & Found"
      ? { ...p, resolved: !p.resolved }
      : p
  );
};

