"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

/**
 * Admin дээр "шинэ хүсэлт" = supportRequests дахь OPEN тоо гэж үзэв.
 * (шинэ хүсэлт ирэх бүрт OPEN нэмэгдэнэ, DONE болгоход багасна)
 */
export function useAdminRequestsBadge() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  // ✅ Admin эсэхийг AuthProvider дээрээс авах боломжгүй бол
  // танай систем users/{uid}.role == "admin" гэдгийг admin page дээр шалгадаг.
  // Энд мөн адил шалгахын тулд хамгийн найдвартай нь: admin талын UI дээр л hook дуудагдана гэж үзээд,
  // эхний хувилбар дээр "админ link/меню дээр л ашиглана" гэж барина.
  // Хэрвээ та admin guard-аа энд давхар шалгуулахыг хүсвэл header файлаа явуул — би яг адилхан guard-г нь оруулна.
  useEffect(() => {
    // user байхгүй бол badge хэрэггүй
    if (!user?.uid) {
      setIsAdmin(false);
      setOpenCount(0);
      setLoading(false);
      return;
    }

    // ⚠️ Энэ hook-ийг зөвхөн admin UI дээр ашиглана гэж үзээд isAdmin=true гэж тавив.
    // (Хэрэв заавал role шалгах хэрэгтэй бол таны header/menu код хэрэгтэй)
    setIsAdmin(true);

    const base = collection(db, "supportRequests");
    const q = query(base, where("status", "==", "OPEN"), limit(1000));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOpenCount(snap.size);
        setLoading(false);
      },
      (err) => {
        console.error("useAdminRequestsBadge onSnapshot error:", err);
        setOpenCount(0);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  return { loading, isAdmin, openCount };
}