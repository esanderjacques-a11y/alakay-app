"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const AVATAR_STORAGE_PREFIX = "alakay_profile_avatar_";

function getAvatarStorageKey(userId: string) {
  return `${AVATAR_STORAGE_PREFIX}${userId}`;
}

export function useProfileAvatar(session: Session | null) {
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!session?.user) {
      setAvatarUrl("");
      return;
    }

    const userId = session.user.id;
    const meta = session.user.user_metadata as Record<string, unknown>;
    const metaAvatar =
      typeof meta.avatar_url === "string" ? meta.avatar_url : "";
    const cached = localStorage.getItem(getAvatarStorageKey(userId)) || "";

    let cancelled = false;

    async function loadAvatar() {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      const profileAvatar =
        !error &&
        data &&
        "avatar_url" in data &&
        typeof data.avatar_url === "string"
          ? data.avatar_url
          : "";

      const resolved = profileAvatar || cached || metaAvatar;
      setAvatarUrl(resolved);
      if (resolved) {
        localStorage.setItem(getAvatarStorageKey(userId), resolved);
      }
    }

    setAvatarUrl(cached || metaAvatar);
    void loadAvatar();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return avatarUrl;
}
