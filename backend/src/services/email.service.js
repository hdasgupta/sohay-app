import axios from 'axios';

const URL = "https://script.google.com/macros/s/AKfycbypVbNa-UpUSUpQOcPS8rQdHi52mT8Cffmoe6EbZPm23az4TJjRn6cV5DFoVCpCI8xC/exec";

export async function sendEmail({ to, subject, html }) {
  try {
    const { data } = await axios.post(
      URL,
      { to, subject, htmlBody: html, apiKey: process.env.GAS_API_KEY || "MyEmailApi" },
      {
        headers: { "Content-Type": "application/json" },
        maxRedirects: 5, // default; must not be 0
        timeout: 30000
      }
    );
    return data; // { success, message }
  } catch (err) {
    return { success: false, message: err.response?.data?.message || err.message };
  }
}
