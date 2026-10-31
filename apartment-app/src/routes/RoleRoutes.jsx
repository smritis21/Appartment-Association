import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { MANAGEMENT_ROLES } from "../constants/roles";

export default function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  const roles = allowedRoles ?? MANAGEMENT_ROLES;
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
