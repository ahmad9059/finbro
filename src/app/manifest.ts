import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "finbro — portfolio & expenses",
    short_name: "finbro",
    description:
      "Track PSX stocks, mutual funds, money market funds, savings and monthly spending.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#171721",
    theme_color: "#171721",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Add expense", short_name: "Expense", url: "/expenses" },
      { name: "PSX Stocks", short_name: "Stocks", url: "/stocks" },
      { name: "Overview", short_name: "Overview", url: "/" },
    ],
  };
}
