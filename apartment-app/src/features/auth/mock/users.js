import { ROLES } from "../../../constants/roles";

export const mockUsers = [
  {
    id: "u001",
    name: "Arjun Mehta",
    email: "owner@jkr.com",
    password: "password123",
    role: ROLES.OWNER,
    flat: "A-101",
    phone: "9876543210",
    avatar: null,
  },
  {
    id: "u002",
    name: "Priya Sharma",
    email: "tenant@jkr.com",
    password: "password123",
    role: ROLES.TENANT,
    flat: "B-204",
    phone: "9876543211",
    avatar: null,
  },
  {
    id: "u003",
    name: "Ramesh Iyer",
    email: "president@jkr.com",
    password: "password123",
    role: ROLES.PRESIDENT,
    flat: "C-301",
    phone: "9876543212",
    avatar: null,
  },
  {
    id: "u004",
    name: "Sunita Nair",
    email: "secretary@jkr.com",
    password: "password123",
    role: ROLES.SECRETARY,
    flat: "D-402",
    phone: "9876543213",
    avatar: null,
  },
  {
    id: "u005",
    name: "Vikram Desai",
    email: "admin@jkr.com",
    password: "password123",
    role: ROLES.ADMIN,
    flat: "Office",
    phone: "9876543214",
    avatar: null,
  },
  {
    id: "u006",
    name: "Raju Kumar",
    email: "maintenance@jkr.com",
    password: "password123",
    role: ROLES.MAINTENANCE,
    flat: "Staff Block",
    phone: "9876543215",
    avatar: null,
  },
  {
    id: "u007",
    name: "Suresh Patil",
    email: "security@jkr.com",
    password: "password123",
    role: ROLES.SECURITY,
    flat: "Gate House",
    phone: "9876543216",
    avatar: null,
  },
];

export function findUserByEmail(email) {
  return mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function authenticateUser(email, password) {
  const user = findUserByEmail(email);
  if (!user) return { success: false, message: "No account found with this email." };
  if (user.password !== password) return { success: false, message: "Incorrect password." };
  const { password: _pw, ...safeUser } = user;
  return { success: true, user: safeUser };
}
