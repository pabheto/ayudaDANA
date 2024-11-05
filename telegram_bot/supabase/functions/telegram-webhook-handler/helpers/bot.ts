import { Bot } from "https://deno.land/x/grammy@v1.8.3/mod.ts";

const telegramBot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

export default telegramBot;
