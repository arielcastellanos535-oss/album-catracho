import type { Department, Sticker, UserAlbumSlot, UserProfile, UserSticker } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export async function getDepartments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("page_order");
  if (error) throw error;
  return data as Department[];
}

export async function getDepartmentBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as Department;
}

export async function getStickersForDepartment(departmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stickers")
    .select("*")
    .eq("department_id", departmentId)
    .order("slot_index");
  if (error) throw error;
  return data as Sticker[];
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function getUserStickers(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_stickers")
    .select("*, sticker:stickers(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data as (UserSticker & { sticker: Sticker })[];
}

export async function getUserAlbumSlots(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_album_slots")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data as UserAlbumSlot[];
}

export async function getActiveAd(departmentSlug?: string) {
  const supabase = await createClient();
  let query = supabase.from("ads").select("*").eq("active", true).limit(1);
  if (departmentSlug) {
    query = query.or(`department_slug.is.null,department_slug.eq.${departmentSlug}`);
  }
  const { data } = await query.maybeSingle();
  return data;
}
