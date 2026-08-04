"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from "@/lib/api";

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
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  reset: () => void;
}

/**
 * Drives the checkout OTP flow against our own backend (POST /api/otp/send
 * and /api/otp/verify), which in turn calls 2Factor.in — no client SDK or
 * reCAPTCHA needed since the SMS sending happens entirely server-side.
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

  const verifyOtp = useCallback(async (code: string) => {
    if (!lastPhoneRef.current) {
      setError("Please request an OTP first.");
      return;
    }
    setError(null);
    setStatus("verifying");
    try {
      const token = await apiVerifyOtp(lastPhoneRef.current, code);
      setVerificationToken(token);
      setVerifiedPhone(lastPhoneRef.current);
      setStatus("verified");
    } catch (err) {
      console.error("verifyOtp failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't verify the OTP. Please try again.");
      setStatus("sent");
    }
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
    verifyOtp,
    resendOtp,
    reset,
  };
}
