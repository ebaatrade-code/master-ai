export function setContinueWatching(params: { href: string; title: string }) {
  try {
    localStorage.setItem("ma_continue_href", params.href);
    localStorage.setItem("ma_continue_title", params.title);
  } catch {}
}

export function getContinueWatching(): { href: string | null; title: string | null } {
  try {
    return {
      href: localStorage.getItem("ma_continue_href"),
      title: localStorage.getItem("ma_continue_title"),
    };
  } catch {
    return { href: null, title: null };
  }
}
