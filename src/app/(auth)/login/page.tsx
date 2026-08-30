"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TokoSettings {
  namaToko: string;
  slogan: string;
  logoText: string;
  logoColor: string;
  logoUrl: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<TokoSettings>({
    namaToko: "Beras Andalan",
    slogan: "Toko beras keluarga",
    logoText: "B",
    logoColor: "#15803d",
    logoUrl: "",
  });

  useEffect(() => {
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setSettings({
            namaToko: json.data.namaToko || "Beras Andalan",
            slogan: json.data.slogan || "Toko beras keluarga",
            logoText: json.data.logoText || "B",
            logoColor: json.data.logoColor || "#15803d",
            logoUrl: json.data.logoUrl || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(data.redirectTo);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.namaToko}
              className="mx-auto w-16 h-16 rounded-2xl object-cover border border-border shadow-sm mb-4"
            />
          ) : (
            <div
              className="mx-auto w-16 h-16 rounded-2xl text-white flex items-center justify-center text-2xl font-bold shadow-sm mb-4 transition-colors"
              style={{ backgroundColor: settings.logoColor || "#15803d" }}
            >
              {settings.logoText || (settings.namaToko ? settings.namaToko.slice(0, 1).toUpperCase() : "B")}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{settings.namaToko}</h1>
          <p className="text-muted-foreground text-sm mt-1.5">{settings.slogan || "Masuk untuk mulai catat transaksi"}</p>
        </div>

        <div className="card-surface p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="input-field"
                placeholder="contoh: owner"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input-field"
                placeholder="Masukkan password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-danger-soft text-danger text-sm px-3 py-2.5 font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base mt-1">
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Toko beras keluarga · Online only
        </p>
      </div>
    </div>
  );
}
