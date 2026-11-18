"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function ReportReceipt({ id, onClose }: { id: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="report-receipt-title"
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/60">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="report-receipt-title" className="text-lg font-bold">ส่งเรื่องสำเร็จ</h2>
          <button type="button" onClick={onClose} className="px-2 py-1 text-sm">ปิด</button>
        </div>
        <p className="text-sm"><strong>รอตรวจสอบ</strong> · เจ้าหน้าที่จะตรวจสอบก่อนเผยแพร่บนแผนที่</p>
        <label className="block text-sm font-semibold">เลขติดตาม
          <input readOnly value={id} onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded border border-slate-400 px-2 py-2 font-mono text-xs" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(id);
              setNotice("คัดลอกเลขติดตามแล้ว");
            } catch {
              setNotice("แตะช่องเลขติดตามเพื่อเลือกและคัดลอก");
            }
          }} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold">คัดลอกเลขติดตาม</button>
          <Link prefetch={false} href={`/track?id=${id}`} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white">
            ดูสถานะเรื่องนี้
          </Link>
          <Link href="/citizen" className="px-2 py-2 text-sm font-semibold text-sky-800">ดูเรื่องของฉัน</Link>
        </div>
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>
    </dialog>
  );
}
