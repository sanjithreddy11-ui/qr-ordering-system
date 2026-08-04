"use client";

import { useEffect } from "react";
import { usePrinterStore } from "@/store/printer-store";

// Mounted once in the admin dashboard layout. Fires the initial QZ Tray
// connection attempt so the printer is already connected (or the error is
// already known) by the time someone hits "Print Bill" — no waiting, no
// extra click. Renders nothing; connection status lives in printer-store
// and is surfaced wherever it's needed (Printer Settings, print buttons).
export default function PrinterProvider({ children }: { children: React.ReactNode }) {
  const connect = usePrinterStore((s) => s.connect);

  useEffect(() => {
    connect();
  }, [connect]);

  return <>{children}</>;
}
