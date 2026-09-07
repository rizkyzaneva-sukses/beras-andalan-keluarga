"use client";

import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/SearchSelect";
import { PageHeader } from "@/components/ui";

interface UserData { id: string; username: string; role: string; isActive: boolean; createdAt: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "KASIR" });
  const [error, setError] = useState("");

  async function fetchUsers() { const res = await fetch("/api/users"); const json = await res.json(); if (json.data) setUsers(json.data); setLoading(false); }
  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = await res.json();
    if (res.ok) { setShowForm(false); setForm({ username: "", password: "", role: "KASIR" }); fetchUsers(); }
    else setError(json.error || "Gagal");
  }

  async function toggleActive(id: string) { await fetch(`/api/users/${id}`, { method: "PATCH" }); fetchUsers(); }
  async function handleDelete(id: string, username: string) {
    if (!confirm(`Hapus user "${username}"?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) { const json = await res.json(); alert(json.error); }
    fetchUsers();
  }

  return (
    <div className="page-wrap space-y-4">
      <PageHeader
        title="Kelola User"
        subtitle="Akun kasir dan pemilik toko"
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 text-sm">
            {showForm ? "Batal" : "+ Tambah"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="card-surface p-4 space-y-3.5">
          <h3 className="font-semibold text-[15px]">Tambah User Baru</h3>
          <div><label className="block text-sm font-medium mb-1">Username</label><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="contoh: kasir-pagi" /></div>
          <div><label className="block text-sm font-medium mb-1">Password</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Min. 6 karakter" /></div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <SearchSelect
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v || "KASIR" })}
              allowClear={false}
              placeholder="Pilih role..."
              options={[
                { value: "KASIR", label: "Kasir" },
                { value: "OWNER", label: "Owner" },
              ]}
            />
          </div>
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors shadow-sm">Simpan</button>
        </form>
      )}

      {loading ? (<div className="text-center py-10"><div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-muted-foreground text-sm mt-2">Memuat...</p></div>)
      : (<div className="space-y-2">{users.map((u) => (
        <div key={u.id} className="card-surface p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap"><p className="font-medium text-[15px]">{u.username}</p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${u.role === "OWNER" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{u.role === "OWNER" ? "Pemilik" : "Kasir"}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{u.isActive ? "Aktif" : "Nonaktif"}</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => toggleActive(u.id)} className="min-h-10 px-3 text-xs font-semibold hover:bg-muted rounded-xl transition-colors">{u.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
            {u.username !== "owner" && <button onClick={() => handleDelete(u.id, u.username)} className="min-h-10 px-3 text-xs text-danger font-semibold hover:bg-danger-soft rounded-xl transition-colors">Hapus</button>}
          </div>
        </div>
      ))}</div>)}
    </div>
  );
}
