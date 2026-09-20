import axios from "axios";
import { pool } from "../src/config/db.js";
import { medicineCount, insertMedicine } from "./sql/doctorQueries.js";
const URL =
  "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/refs/heads/main/DATA/indian_medicine_data.csv";
export async function seedMedicinesIfEmpty() {
  const c = await pool.query(medicineCount);
  if (Number(c.rows[0].count)) return;
  const r = await axios.get(URL, { responseType: "text", timeout: 30000 });
  for (const row of String(r.data).split(/\r?\n/).slice(1)) {
    const cols = row.split(",");
    const name = String(cols[1] || "")
      .replace(/^"|"$/g, "")
      .trim();
    if (name) await pool.query(insertMedicine, [name]);
  }
  console.log("[SEED] medicines imported");
}
