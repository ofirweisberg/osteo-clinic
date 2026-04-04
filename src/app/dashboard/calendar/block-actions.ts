"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createOneTimeBlock(data: {
  starts_at: string;
  ends_at: string;
  reason?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_blocks").insert({
    block_type: "one_time",
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    reason: data.reason || null,
  });
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function createRecurringBlock(data: {
  day_of_week: number;
  start_time: string;
  end_time: string;
  reason?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_blocks").insert({
    block_type: "recurring",
    day_of_week: data.day_of_week,
    start_time: data.start_time,
    end_time: data.end_time,
    reason: data.reason || null,
  });
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function deleteScheduleBlock(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function addBlockException(id: string, dateStr: string) {
  const supabase = await createClient();

  // Fetch current exception_dates
  const { data: block, error: fetchError } = await supabase
    .from("schedule_blocks")
    .select("exception_dates")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("Failed to fetch block:", fetchError);
    throw new Error("Failed to fetch block: " + fetchError.message);
  }

  // Handle null, undefined, or non-array values
  let exceptions: string[] = [];
  if (Array.isArray(block?.exception_dates)) {
    exceptions = [...(block.exception_dates as string[])];
  }

  if (!exceptions.includes(dateStr)) {
    exceptions.push(dateStr);
  }

  const { error } = await supabase
    .from("schedule_blocks")
    .update({ exception_dates: exceptions })
    .eq("id", id);

  if (error) {
    console.error("Failed to update block exceptions:", error);
    throw new Error("Failed to update: " + error.message);
  }

  revalidatePath("/dashboard/calendar");
}
