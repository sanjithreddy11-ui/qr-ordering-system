"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Flame } from "lucide-react";
import { adminLogin } from "@/lib/admin-api";
import { useAuthStore } from "@/store/auth-store";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants

export default function LoginPage() {
  const router = useRouter();
  const { token, setSession } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token: newToken, staff } = await adminLogin(RESTAURANT_ID, email, password);
      setSession(newToken, staff);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1115] px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1B1F2A] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500">
            <Flame className="text-white" size={30} />
          </div>

          <h1 className="text-3xl font-bold text-white">
            MaxiBrew Cafe
          </h1>

          <p className="mt-2 text-gray-400">
            Admin Dashboard Login
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <div className="relative">
            <Mail
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F1115] py-3 pl-12 pr-4 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div className="relative">
            <Lock
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F1115] py-3 pl-12 pr-12 text-white outline-none focus:border-orange-500"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Login"}
          </button>

         
        </form>
      </div>
    </div>
  );
}
