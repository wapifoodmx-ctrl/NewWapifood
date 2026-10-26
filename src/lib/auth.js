import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function getMembership(supabase, userId) {
  const { data } = await supabase
    .from("memberships")
    .select("restaurant_id, role, restaurants(id, name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data;
}
