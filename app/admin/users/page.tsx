// app/admin/users/page.tsx
import AdminUsersClient from "./_components/AdminUsersClient";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  // NOTE: Route guard-ыг таны existing admin layout/auth guard хийнэ гэж үзсэн.
  // API side ч мөн requireAdminFromRequest хамгаалалттай.
  return <AdminUsersClient />;
}
