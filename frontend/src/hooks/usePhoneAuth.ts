"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from "@/lib/api";
import { useVisitAuthStore } from "@/store/visit-auth-store";

const RESEND_SECONDS = 30;

export type PhoneAuthStatus =
  | "idle" // nothing sent yet
  | "sending" // Send OTP in flight
  | "sent" // OTP sent, waiting for the customer to type it in
  | "verifying" // Verify OTP in flight
  | "verified"; // OTP confirmed, verificationToken available

interface UsePhoneAuthResult {
  status: PhoneAuthStatus;
  error: string | null;
  resendSeconds: number;
  verificationToken: string | null;
  verifiedPhone: string | null;
  sendOtp: (phoneDigits: string) => Promise<void>;
  // Single-step verification with no OTP (development/demo mode).
  verifyPhone: (phoneDigits: string, ctx: { tableToken: string; name?: string }) => Promise<void>;
  verifyOtp: (code: string, ctx: { tableToken: string; name?: string }) => Promise<void>;
  // Marks the flow verified from an ALREADY-ACTIVE backend visit (no OTP).
  restoreVerified: (visit: { visitToken: string; phone: string }) => void;
  resendOtp: () => Promise<void>;
  reset: () => void;
}

/**
 * Drives the checkout OTP flow against our own backend (POST /api/otp/send
 * and /api/otp/verify). Real OTP/SMS verification is currently DISABLED
 * (development/demo mode): the checkout uses verifyPhone() below, a single
 * step that never sends an OTP. sendOtp/verifyOtp are kept for re-enabling
 * real verification (backend OTP_PROVIDER=2factor).
 */
export function usePhoneAuth(): UsePhoneAuthResult {
  const [status, setStatus] = useState<PhoneAuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  const lastPhoneRef = useRef<string>("");

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const sendOtp = useCallback(async (phoneDigits: string) => {
    setError(null);
    setStatus("sending");
    try {
      await apiSendOtp(phoneDigits);
      lastPhoneRef.current = phoneDigits;
      setStatus("sent");
      setResendSeconds(RESEND_SECONDS);
    } catch (err) {
      console.error("sendOtp failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't send the OTP. Please try again.");
      setStatus("idle");
    }
  }, []);

  const resendOtp = useCallback(async () => {
    if (resendSeconds > 0 || !lastPhoneRef.current) return;
    await sendOtp(lastPhoneRef.current);
  }, [resendSeconds, sendOtp]);

  const verifyOtp = useCallback(async (code: string, ctx: { tableToken: string; name?: string }) => {
    if (!lastPhoneRef.current) {
      setError("Please request an OTP first.");
      return;
    }
    setError(null);
    setStatus("verifying");
    try {
      const deviceId = useVisitAuthStore.getState().ensureDeviceId();
      const visit = await apiVerifyOtp(lastPhoneRef.current, code, { deviceId, ...ctx });
      // Persist the new ACTIVE visit so later orders/page loads skip OTP.
      useVisitAuthStore.getState().setVisit({
        visitToken: visit.visitToken,
        phone: lastPhoneRef.current,
        name: visit.name,
      });
      setVerificationToken(visit.visitToken);
      setVerifiedPhone(lastPhoneRef.current);
      setStatus("verified");
    } catch (err) {
      console.error("verifyOtp failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't verify the OTP. Please try again.");
      setStatus("sent");
    }
  }, []);

  const verifyPhone = useCallback(async (phoneDigits: string, ctx: { tableToken: string; name?: string }) => {
    setError(null);
    setStatus("verifying");
    try {
      const deviceId = useVisitAuthStore.getState().ensureDeviceId();
      const visit = await apiVerifyOtp(phoneDigits, "", { deviceId, ...ctx });
      lastPhoneRef.current = phoneDigits;
      useVisitAuthStore.getState().setVisit({
        visitToken: visit.visitToken,
        phone: phoneDigits,
        name: visit.name,
      });
      setVerificationToken(visit.visitToken);
      setVerifiedPhone(phoneDigits);
      setStatus("verified");
    } catch (err) {
      console.error("verifyPhone failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't verify your number. Please try again.");
      setStatus("idle");
    }
  }, []);

  const restoreVerified = useCallback((visit: { visitToken: string; phone: string }) => {
    lastPhoneRef.current = visit.phone;
    setVerificationToken(visit.visitToken);
    setVerifiedPhone(visit.phone);
    setError(null);
    setStatus("verified");
  }, []);

  const reset = useCallback(() => {
    lastPhoneRef.current = "";
    setStatus("idle");
    setError(null);
    setResendSeconds(0);
    setVerificationToken(null);
    setVerifiedPhone(null);
  }, []);

  return {
    status,
    error,
    resendSeconds,
    verificationToken,
    verifiedPhone,
    sendOtp,
    verifyPhone,
    verifyOtp,
    restoreVerified,
    resendOtp,
    reset,
  };
}
