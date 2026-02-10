// lib/qpayClient.ts
export type DeeplinkItem = { name?: string; description?: string; logo?: string; link: string };

export async function createQPayInvoice(args: {
  uid: string;
  courseId: string;
  amount: number;
  description?: string;
  receiver?: { register?: string; name?: string; email?: string; phone?: string };
}) {
  const res = await fetch("/api/qpay/invoice/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Invoice create failed");
  return data as {
    ref: string;
    invoiceId: string;
    qrText: string | null;
    qrImageBase64: string | null;
    shortUrl: string | null;
    urls: DeeplinkItem[];
  };
}

export async function checkQPayPayment(ref: string) {
  const res = await fetch("/api/qpay/payment/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Payment check failed");
  return data as { paid: boolean; result?: any };
}