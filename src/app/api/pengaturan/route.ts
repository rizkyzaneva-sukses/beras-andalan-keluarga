import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

const DEFAULT_SETTINGS = {
  id: "default",
  namaToko: "Beras Andalan",
  slogan: "Toko beras keluarga",
  logoText: "B",
  logoColor: "#15803d",
  logoUrl: "",
  alamat: "",
  telepon: "",
};

export async function GET() {
  try {
    const settings = await prisma.pengaturan.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({ data: settings || DEFAULT_SETTINGS });
  } catch {
    // Graceful fallback if table not yet initialized
    return NextResponse.json({ data: DEFAULT_SETTINGS });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { namaToko, slogan, logoText, logoColor, logoUrl, alamat, telepon } = await request.json();

  if (!namaToko || typeof namaToko !== "string" || !namaToko.trim()) {
    return NextResponse.json({ error: "Nama toko wajib diisi" }, { status: 400 });
  }

  const cleanNamaToko = namaToko.trim();
  const cleanSlogan = typeof slogan === "string" ? slogan.trim() : "";
  const cleanLogoText = typeof logoText === "string" && logoText.trim() ? logoText.trim().slice(0, 4).toUpperCase() : cleanNamaToko.slice(0, 1).toUpperCase();
  const cleanLogoColor = typeof logoColor === "string" && /^#[0-9a-fA-F]{6}$/.test(logoColor) ? logoColor : "#15803d";
  const cleanLogoUrl = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const cleanAlamat = typeof alamat === "string" ? alamat.trim() : "";
  const cleanTelepon = typeof telepon === "string" ? telepon.trim() : "";

  try {
    const updated = await prisma.pengaturan.upsert({
      where: { id: "default" },
      update: {
        namaToko: cleanNamaToko,
        slogan: cleanSlogan,
        logoText: cleanLogoText,
        logoColor: cleanLogoColor,
        logoUrl: cleanLogoUrl,
        alamat: cleanAlamat,
        telepon: cleanTelepon,
      },
      create: {
        id: "default",
        namaToko: cleanNamaToko,
        slogan: cleanSlogan,
        logoText: cleanLogoText,
        logoColor: cleanLogoColor,
        logoUrl: cleanLogoUrl,
        alamat: cleanAlamat,
        telepon: cleanTelepon,
      },
    });

    await writeAudit({
      entityType: "USER",
      entityId: "pengaturan",
      action: "UPDATE",
      newData: {
        namaToko: cleanNamaToko,
        slogan: cleanSlogan,
        logoText: cleanLogoText,
        logoColor: cleanLogoColor,
      },
      userId: session.userId,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[pengaturan/PUT] Error:", error);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
