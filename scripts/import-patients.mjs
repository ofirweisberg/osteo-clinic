import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse CSV from xlsx-cli output (piped via stdin or read from arg)
const raw = readFileSync(process.argv[2] || "/dev/stdin", "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0];
console.log("Header:", header);

const patients = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Split by comma, but handle names that might have commas
  const parts = line.split(",");
  const name = parts[0].trim();
  let phone = (parts[1] || "").trim();
  const email = (parts[2] || "").trim() || null;

  // Normalize phone: +972... -> 0...
  phone = phone.replace(/\D/g, ""); // strip non-digits
  if (phone.startsWith("972")) {
    phone = "0" + phone.slice(3);
  }

  if (!name || !phone) {
    console.warn(`Skipping row ${i}: missing name or phone`);
    continue;
  }

  patients.push({ full_name: name, phone, email });
}

console.log(`Parsed ${patients.length} patients. Inserting...`);

// Check for existing patients by phone to avoid duplicates
const { data: existing } = await supabase
  .from("patients")
  .select("phone");

const existingPhones = new Set((existing || []).map((p) => p.phone));
const newPatients = patients.filter((p) => !existingPhones.has(p.phone));
const skipped = patients.length - newPatients.length;

if (skipped > 0) {
  console.log(`Skipping ${skipped} patients (already exist by phone)`);
}

if (newPatients.length === 0) {
  console.log("No new patients to insert.");
  process.exit(0);
}

// Insert in batches of 50
for (let i = 0; i < newPatients.length; i += 50) {
  const batch = newPatients.slice(i, i + 50);
  const { error } = await supabase.from("patients").insert(batch);
  if (error) {
    console.error(`Error inserting batch at index ${i}:`, error);
    process.exit(1);
  }
  console.log(`Inserted ${Math.min(i + 50, newPatients.length)}/${newPatients.length}`);
}

console.log(`Done! ${newPatients.length} patients imported.`);
