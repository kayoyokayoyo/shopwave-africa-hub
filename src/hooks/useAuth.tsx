import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, loading };
}
