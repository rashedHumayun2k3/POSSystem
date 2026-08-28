export function getYoutubeEmbedId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.replace("/embed/", "");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.replace("/shorts/", "");
    }
    return null;
  } catch {
    return null;
  }
}
