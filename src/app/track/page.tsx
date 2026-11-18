import Link from "next/link";
import { reportIdPattern, reportsRequest } from "@/lib/maps-reports-db";

const labels: Record<string, string> = {
  pending: "รอตรวจสอบ",
  inprogress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
};

export default async function TrackPage({ searchParams }: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id: input } = await searchParams;
  const id = typeof input === "string" ? input.trim().slice(0, 80) : "";
  let message = "";
  let status = "";
  if (id) {
    if (!reportIdPattern.test(id)) {
      message = "กรุณาตรวจสอบเลขติดตามจากใบรับเรื่อง";
    } else {
      try {
        const result = await reportsRequest(`?id=eq.${id}&select=status&limit=1`);
        const [row]: { status: string }[] = await result.json();
        if (row) status = labels[row.status] ?? "ยังไม่ทราบสถานะ";
        else message = "ไม่พบเรื่องตามเลขติดตามนี้";
      } catch {
        message = "โหลดสถานะไม่ได้ กรุณาลองใหม่";
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow">
        <Link href="/" className="text-sm font-semibold text-sky-800">กลับแผนที่</Link>
        <h1 className="text-xl font-bold">ติดตามเรื่องแจ้ง</h1>
        <form action="/track" method="get" className="space-y-2">
          <label htmlFor="tracking-id" className="block text-sm font-medium">เลขติดตาม</label>
          <input id="tracking-id" name="id" defaultValue={id} required maxLength={80}
            autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-slate-400 p-2 text-sm" />
          <button className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white">ตรวจสอบสถานะ</button>
        </form>
        {status && <p role="status" className="rounded-lg bg-sky-50 p-3">สถานะล่าสุด <strong>{status}</strong></p>}
        {status === labels.pending && <p className="text-sm text-slate-600">ระบบรับเรื่องแล้ว เจ้าหน้าที่จะตรวจสอบก่อนเผยแพร่บนแผนที่</p>}
        {message && <p role="alert" className="text-sm text-rose-800">{message}</p>}
        <Link href="/citizen" className="text-sm font-semibold text-sky-800">ดูเรื่องของฉัน</Link>
      </section>
    </main>
  );
}
