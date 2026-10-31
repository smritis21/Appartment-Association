import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import ChildFriendlyOutlinedIcon from "@mui/icons-material/ChildFriendlyOutlined";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";

// House-help categories a resident can browse and book. `id` is the machine key
// used across bookings / attendance; `label` is what the UI shows.
export const HELP_CATEGORIES = [
  { id: "maid", label: "Maid", icon: CleaningServicesOutlinedIcon },
  { id: "cook", label: "Cook", icon: RestaurantOutlinedIcon },
  { id: "driver", label: "Driver", icon: DirectionsCarOutlinedIcon },
  { id: "nanny", label: "Nanny", icon: ChildFriendlyOutlinedIcon },
  { id: "gardener", label: "Gardener", icon: YardOutlinedIcon },
];

export const getCategory = (id) => HELP_CATEGORIES.find((c) => c.id === id) ?? null;
export const categoryLabel = (id) => getCategory(id)?.label ?? id;

// Availability of a worker. Only AVAILABLE workers can be booked; the others are
// shown but visually distinguished (matches the facilities slot-state pattern).
export const AVAILABILITY = {
  AVAILABLE: "available",
  BUSY: "busy",
  OFF: "off",
};

export const AVAILABILITY_META = {
  [AVAILABILITY.AVAILABLE]: { label: "Available", color: "success" },
  [AVAILABILITY.BUSY]: { label: "Fully booked", color: "warning" },
  [AVAILABILITY.OFF]: { label: "On leave", color: "default" },
};

// House-help workforce registered with the society. `rating`/`ratingCount` are
// seeded and then recomputed live as residents add ratings (see mock/ratings).
export const HOUSE_HELP = [
  {
    id: "HH-01",
    name: "Lakshmi Devi",
    category: "maid",
    availability: AVAILABILITY.AVAILABLE,
    experienceYears: 8,
    monthlyRate: 3500,
    languages: ["Hindi", "Tamil"],
    verified: true,
    phone: "9800011021",
    rating: 4.6,
    ratingCount: 24,
    bio: "Full sweeping, mopping and utensils. Serves flats in Blocks A and B.",
  },
  {
    id: "HH-02",
    name: "Ganesh Pawar",
    category: "cook",
    availability: AVAILABILITY.AVAILABLE,
    experienceYears: 12,
    monthlyRate: 6000,
    languages: ["Hindi", "Marathi"],
    verified: true,
    phone: "9800011022",
    rating: 4.8,
    ratingCount: 31,
    bio: "North & South Indian vegetarian cooking. Two meals a day.",
  },
  {
    id: "HH-03",
    name: "Ramesh Yadav",
    category: "driver",
    availability: AVAILABILITY.BUSY,
    experienceYears: 6,
    monthlyRate: 12000,
    languages: ["Hindi", "English"],
    verified: true,
    phone: "9800011023",
    rating: 4.3,
    ratingCount: 15,
    bio: "Light-motor-vehicle licence, 6 years. School runs and airport drops.",
  },
  {
    id: "HH-04",
    name: "Sunita Bai",
    category: "maid",
    availability: AVAILABILITY.OFF,
    experienceYears: 5,
    monthlyRate: 3000,
    languages: ["Hindi"],
    verified: false,
    phone: "9800011024",
    rating: 4.1,
    ratingCount: 9,
    bio: "Sweeping, mopping and dusting. On leave until end of the month.",
  },
  {
    id: "HH-05",
    name: "Meena Kumari",
    category: "nanny",
    availability: AVAILABILITY.AVAILABLE,
    experienceYears: 10,
    monthlyRate: 9000,
    languages: ["Hindi", "English"],
    verified: true,
    phone: "9800011025",
    rating: 4.9,
    ratingCount: 18,
    bio: "Infant and toddler care. First-aid trained, excellent references.",
  },
  {
    id: "HH-06",
    name: "Iqbal Khan",
    category: "gardener",
    availability: AVAILABILITY.AVAILABLE,
    experienceYears: 7,
    monthlyRate: 2500,
    languages: ["Hindi", "Urdu"],
    verified: true,
    phone: "9800011026",
    rating: 4.4,
    ratingCount: 11,
    bio: "Balcony and terrace-garden upkeep, seasonal planting, pruning.",
  },
  {
    id: "HH-07",
    name: "David Fernandes",
    category: "cook",
    availability: AVAILABILITY.BUSY,
    experienceYears: 9,
    monthlyRate: 6500,
    languages: ["English", "Konkani"],
    verified: true,
    phone: "9800011027",
    rating: 4.5,
    ratingCount: 20,
    bio: "Continental and Goan cuisine. Currently serving three flats.",
  },
];

export const getHelpById = (id) => HOUSE_HELP.find((h) => h.id === id) ?? null;

// Workers in a category, available ones first, then by rating.
export const getHelpByCategory = (categoryId) =>
  HOUSE_HELP.filter((h) => categoryId === "all" || h.category === categoryId).sort((a, b) => {
    if (a.availability !== b.availability) {
      return a.availability === AVAILABILITY.AVAILABLE ? -1 : 1;
    }
    return b.rating - a.rating;
  });
