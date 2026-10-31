import ElevatorOutlinedIcon from "@mui/icons-material/ElevatorOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import LocalFireDepartmentOutlinedIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import AcUnitOutlinedIcon from "@mui/icons-material/AcUnitOutlined";
import PoolOutlinedIcon from "@mui/icons-material/PoolOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

// Physical assets / facilities in the society that maintenance is tracked
// against. Work orders and preventive tasks both link back to one of these by
// `id`, so the asset view can show a full history per item.
export const ASSET_CATEGORY = {
  ELEVATOR: "elevator",
  POWER: "power",
  WATER: "water",
  FIRE: "fire",
  HVAC: "hvac",
  AMENITY: "amenity",
  COMMON: "common",
};

export const ASSET_CATEGORY_META = {
  [ASSET_CATEGORY.ELEVATOR]: { label: "Elevator", icon: ElevatorOutlinedIcon },
  [ASSET_CATEGORY.POWER]: { label: "Power", icon: BoltOutlinedIcon },
  [ASSET_CATEGORY.WATER]: { label: "Water", icon: WaterDropOutlinedIcon },
  [ASSET_CATEGORY.FIRE]: { label: "Fire Safety", icon: LocalFireDepartmentOutlinedIcon },
  [ASSET_CATEGORY.HVAC]: { label: "HVAC", icon: AcUnitOutlinedIcon },
  [ASSET_CATEGORY.AMENITY]: { label: "Amenity", icon: FitnessCenterOutlinedIcon },
  [ASSET_CATEGORY.COMMON]: { label: "Common Area", icon: LightbulbOutlinedIcon },
};

// Operational health of an asset, shown as a colored chip in the asset list.
export const ASSET_STATUS = {
  OPERATIONAL: "operational",
  ATTENTION: "attention",
  DOWN: "down",
};

export const ASSET_STATUS_META = {
  [ASSET_STATUS.OPERATIONAL]: { label: "Operational", color: "success" },
  [ASSET_STATUS.ATTENTION]: { label: "Needs attention", color: "warning" },
  [ASSET_STATUS.DOWN]: { label: "Out of service", color: "error" },
};

export const ASSETS = [
  {
    id: "AST-ELV-A",
    name: "Elevator - Block A",
    category: ASSET_CATEGORY.ELEVATOR,
    location: "Block A · Lobby",
    serialNo: "OTIS-A-2019-114",
    installedOn: "2019-03-12",
    status: ASSET_STATUS.OPERATIONAL,
    icon: ElevatorOutlinedIcon,
  },
  {
    id: "AST-ELV-B",
    name: "Elevator - Block B",
    category: ASSET_CATEGORY.ELEVATOR,
    location: "Block B · Lobby",
    serialNo: "OTIS-B-2019-115",
    installedOn: "2019-03-12",
    status: ASSET_STATUS.ATTENTION,
    icon: ElevatorOutlinedIcon,
  },
  {
    id: "AST-GEN-1",
    name: "Diesel Generator 250kVA",
    category: ASSET_CATEGORY.POWER,
    location: "Basement · Utility Room",
    serialNo: "CUMMINS-250-7781",
    installedOn: "2018-11-02",
    status: ASSET_STATUS.OPERATIONAL,
    icon: BoltOutlinedIcon,
  },
  {
    id: "AST-PUMP-1",
    name: "Water Pump - Overhead Tank",
    category: ASSET_CATEGORY.WATER,
    location: "Terrace · Pump House",
    serialNo: "KSB-OHT-4420",
    installedOn: "2020-06-18",
    status: ASSET_STATUS.OPERATIONAL,
    icon: WaterDropOutlinedIcon,
  },
  {
    id: "AST-STP-1",
    name: "Sewage Treatment Plant",
    category: ASSET_CATEGORY.WATER,
    location: "Rear Compound",
    serialNo: "STP-50KLD-0091",
    installedOn: "2018-11-20",
    status: ASSET_STATUS.DOWN,
    icon: WaterDropOutlinedIcon,
  },
  {
    id: "AST-FIRE-1",
    name: "Fire Fighting System",
    category: ASSET_CATEGORY.FIRE,
    location: "All Blocks · Risers",
    serialNo: "FFS-CENTRAL-3300",
    installedOn: "2019-01-10",
    status: ASSET_STATUS.OPERATIONAL,
    icon: LocalFireDepartmentOutlinedIcon,
  },
  {
    id: "AST-HVAC-CH",
    name: "Clubhouse HVAC",
    category: ASSET_CATEGORY.HVAC,
    location: "Clubhouse · First Floor",
    serialNo: "DAIKIN-CH-9012",
    installedOn: "2021-02-25",
    status: ASSET_STATUS.ATTENTION,
    icon: AcUnitOutlinedIcon,
  },
  {
    id: "AST-POOL-1",
    name: "Swimming Pool Filtration",
    category: ASSET_CATEGORY.AMENITY,
    location: "Clubhouse · Rear Deck",
    serialNo: "POOL-FLT-5540",
    installedOn: "2020-08-14",
    status: ASSET_STATUS.OPERATIONAL,
    icon: PoolOutlinedIcon,
  },
  {
    id: "AST-GYM-1",
    name: "Gymnasium Equipment",
    category: ASSET_CATEGORY.AMENITY,
    location: "Clubhouse · Ground Floor",
    serialNo: "GYM-SET-2277",
    installedOn: "2020-08-14",
    status: ASSET_STATUS.OPERATIONAL,
    icon: FitnessCenterOutlinedIcon,
  },
  {
    id: "AST-LIGHT-CP",
    name: "Common Area Lighting",
    category: ASSET_CATEGORY.COMMON,
    location: "Corridors · Parking · Garden",
    serialNo: "LED-CP-BULK",
    installedOn: "2019-05-30",
    status: ASSET_STATUS.OPERATIONAL,
    icon: LightbulbOutlinedIcon,
  },
];

export const getAssetById = (id) => ASSETS.find((a) => a.id === id) ?? null;

export const assetName = (id) => getAssetById(id)?.name ?? "-";

export const categoryLabel = (category) =>
  ASSET_CATEGORY_META[category]?.label ?? category;

