"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, Share2, LogOut, X } from "lucide-react";
import { useGroupOrderStore } from "@/store/group-order-store";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface GroupOrderDrawerProps {
  restaurantId: string;
  tableToken?: string | null;
}

export default function GroupOrderDrawer({ restaurantId, tableToken }: GroupOrderDrawerProps) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const {
    active,
    participants,
    lines,
    participantId,
    participantName,
    join,
    leave,
    subtotalFor,
    totalSubtotal,
  } = useGroupOrderStore();

  const canJoin = Boolean(tableToken);

  const handleJoin = () => {
    if (!tableToken) return;
    join(restaurantId, tableToken, nameDraft.trim() || participantName);
  };

  const handleInvite = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Join our table's order", url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Share sheet dismissed by the user — nothing to do.
    }
  };

  return (
    <>
      {/* Floating trigger — stacked above the category "Menu" button on the
          right edge. Deliberately NOT on the left: BackgroundDecor pins a
          decorative branch illustration to the bottom-left corner, and a
          button placed there sits visually on top of it. */}
      <motion.button
        type="button"
        aria-label="Group order"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-[172px] right-4 z-30 flex items-center gap-1.5 rounded-full border border-border-soft bg-bg-secondary px-4 py-2.5"
        style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.07)" }}
      >
        <Users size={14} strokeWidth={1.75} className="text-green-primary" />
        <span
          className="font-body text-[10.5px] font-medium uppercase text-green-primary"
          style={{ letterSpacing: "1.2px" }}
        >
          {active ? `Group · ${participants.length}` : "Group Order"}
        </span>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-green-primary" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 mx-auto max-w-[480px] bg-[#1C1C1C]/22"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[75vh] max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border-t border-border-soft bg-bg-secondary"
              style={{ boxShadow: "0 -12px 28px rgba(0,0,0,0.08)" }}
            >
              <div className="relative flex flex-col items-center pb-2 pt-3">
                <span className="h-1 w-9 rounded-full bg-border-soft" />
              </div>

              <div className="relative flex items-center justify-between px-6 pb-3">
                <span
                  className="font-body text-[10.5px] font-medium uppercase text-text-secondary"
                  style={{ letterSpacing: "3px" }}
                >
                  {active ? "Group Order" : "Start Group Order"}
                </span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={18} className="text-text-secondary" />
                </button>
              </div>

              <span className="relative mx-6 h-px bg-border-soft" />

              <div className="relative flex-1 overflow-y-auto px-6 py-4">
                {!active ? (
                  <div className="flex flex-col gap-4">
                    <p className="font-body text-[13.5px] leading-relaxed text-text-secondary">
                      Everyone at this table can join from their own phone using
                      the same QR code — one shared cart, live for the whole
                      table, and the bill splits automatically per person at
                      the end.
                    </p>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Your name"
                      className="font-body w-full rounded-[16px] border border-border-soft bg-bg-card px-4 py-3 text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!canJoin}
                      onClick={handleJoin}
                      className="font-body w-full rounded-full py-3 text-[13.5px] font-semibold text-bg-primary disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)" }}
                    >
                      Start / Join Group Order
                    </button>
                    {!canJoin && (
                      <p className="font-body text-center text-[11.5px] text-text-secondary">
                        Scan the table&apos;s QR code to enable group ordering.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap gap-2">
                      {participants.map((p) => (
                        <span
                          key={p.participantId}
                          className={`font-body rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                            p.participantId === participantId
                              ? "border-green-primary bg-green-primary text-bg-primary"
                              : "border-border-soft bg-bg-card text-text-primary"
                          }`}
                        >
                          {p.name}
                          {p.participantId === participantId ? " (You)" : ""}
                        </span>
                      ))}
                    </div>

                    {lines.length === 0 ? (
                      <p className="font-body py-6 text-center text-[13.5px] text-text-secondary">
                        No items yet — add dishes from the menu and they&apos;ll
                        show up here for everyone at the table.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {participants.map((p) => {
                          const myLines = lines.filter((l) => l.participantId === p.participantId);
                          if (myLines.length === 0) return null;
                          return (
                            <div key={p.participantId} className="flex flex-col gap-1.5">
                              <span
                                className="font-body text-[11px] font-semibold uppercase text-text-secondary"
                                style={{ letterSpacing: "0.8px" }}
                              >
                                {p.name}
                                {p.participantId === participantId ? " (You)" : ""}
                              </span>
                              {myLines.map((l) => (
                                <div key={l.lineId} className="flex items-center justify-between text-[13.5px]">
                                  <span className="font-body text-text-primary">
                                    {l.quantity} × {l.name}
                                  </span>
                                  <span className="font-body font-medium text-text-primary">
                                    ₹ {l.price * l.quantity}
                                  </span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between border-t border-dashed border-border-soft pt-1.5 text-[12.5px]">
                                <span className="font-body text-text-secondary">Subtotal</span>
                                <span className="font-body font-semibold text-green-primary">
                                  ₹ {subtotalFor(p.participantId)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-[18px] border border-border-soft bg-bg-card px-4 py-3">
                      <span className="font-body text-[13.5px] font-semibold text-text-primary">
                        Table Total
                      </span>
                      <span className="font-body text-[16px] font-bold text-green-primary">
                        ₹ {totalSubtotal()}
                      </span>
                    </div>

                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={handleInvite}
                        className="font-body flex flex-1 items-center justify-center gap-1.5 rounded-full border border-green-primary py-2.5 text-[12.5px] font-semibold text-green-primary"
                      >
                        <Share2 size={14} />
                        {copied ? "Link copied" : "Invite others"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          leave();
                          setOpen(false);
                        }}
                        className="font-body flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border-soft py-2.5 text-[12.5px] font-semibold text-text-secondary"
                      >
                        <LogOut size={14} />
                        Leave group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
