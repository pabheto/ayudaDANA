// archivo webhook.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  const { message } = req.body; // Extract the received message

  if (!message || !message.text) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const responseMessage = await handleUserMessage(message); // Process received message
  await sendTelegramMessage(message.chat.id, responseMessage);

  res.status(200).json({ status: "Message sent" });
}

async function handleUserMessage(message) {
  const text = message.text.toLowerCase();

  if (text === "/start") {
    return `Hello ${message.from.first_name}! Welcome to the bot.`;
  } else if (text.startsWith("/info")) {
    const userInfo = await fetchUserInfoFromDatabase(message.from.id);
    return userInfo || "No information found for this user.";
  } else {
    return "Unrecognized command. Use /start or /info to interact.";
  }
}

async function fetchUserInfoFromDatabase(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();
  return error
    ? "Error retrieving user data."
    : `User data: ${JSON.stringify(data)}`;
}

async function sendTelegramMessage(chatId, text) {
  const telegramToken = "YOUR_TELEGRAM_BOT_TOKEN";
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}
