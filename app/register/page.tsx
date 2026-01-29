import { redirect } from "next/navigation";

export default function RegisterRedirectPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const raw = searchParams?.callbackUrl || "/";
  const cb = encodeURIComponent(raw);
  redirect(`/login?mode=register&callbackUrl=${cb}`);
}
