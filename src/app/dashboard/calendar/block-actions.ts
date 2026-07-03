"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAuth() {
  if (!(await getSession())) throw new Error("unauthorized");
}

export async function getScheduleBlocks() {
  await requireAuth();
  return query(`SELECT * FROM schedule_blocks`);
}

export async function createOneTimeBlock(data: {
  starts_at: string;
  ends_at: string;
  reason?: string;
}) {
  await requireAuth();
  await query(
    `INSERT INTO schedule_blocks (block_type, starts_at, ends_at, reason)
     VALUES ('one_time', $1, $2, $3)`,
    [data.starts_at, data.ends_at, data.reason || null]
  );
  revalidatePath("/dashboard/calendar");
}

export async function createRecurringBlock(data: {
  day_of_week: number;
  start_time: string;
  end_time: string;
  reason?: string;
}) {
  await requireAuth();
  await query(
    `INSERT INTO schedule_blocks (block_type, day_of_week, start_time, end_time, reason)
     VALUES ('recurring', $1, $2, $3, $4)`,
    [data.day_of_week, data.start_time, data.end_time, data.reason || null]
  );
  revalidatePath("/dashboard/calendar");
}

export async function deleteScheduleBlock(id: string) {
  await requireAuth();
  await query(`DELETE FROM schedule_blocks WHERE id = $1`, [id]);
  revalidatePath("/dashboard/calendar");
}

export async function addBlockException(id: string, dateStr: string) {
  await requireAuth();

  // Fetch current exception_dates
  let block: { exception_dates: unknown } | null;
  try {
    block = await queryOne<{ exception_dates: unknown }>(
      `SELECT exception_dates FROM schedule_blocks WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error("Failed to fetch block:", err);
    throw new Error(
      "Failed to fetch block: " + (err instanceof Error ? err.message : String(err))
    );
  }

  // Handle null, undefined, or non-array values
  let exceptions: string[] = [];
  if (Array.isArray(block?.exception_dates)) {
    exceptions = [...(block.exception_dates as string[])];
  }

  if (!exceptions.includes(dateStr)) {
    exceptions.push(dateStr);
  }

  try {
    await query(
      `UPDATE schedule_blocks SET exception_dates = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(exceptions)]
    );
  } catch (err) {
    console.error("Failed to update block exceptions:", err);
    throw new Error(
      "Failed to update: " + (err instanceof Error ? err.message : String(err))
    );
  }

  revalidatePath("/dashboard/calendar");
}
