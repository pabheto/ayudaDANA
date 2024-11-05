import { supabase } from "./supabase.ts";

export const ADMINISTRATORS_CHATS_ID = [7591438074];
const PAGE_SIZE = 5;

export function isAdministrator(ctx: any) {
  return ctx.from?.id && ADMINISTRATORS_CHATS_ID.includes(ctx.from?.id);
}

export async function handleAdministrationButtonsCallbacks(ctx: any) {
  const callbackData = ctx.callbackQuery?.data;

  if (callbackData.startsWith("ver_colaboradores_page_")) {
    const page = parseInt(callbackData.split("_").pop() as string, 10);
    await verColaboradores(ctx, page);
  } else if (callbackData === "menu_principal") {
    await showAdministrationMenu(ctx);
  }
}

export async function handleAdministrationTextCallbacks(ctx: any) {
  // TODO: Añadir lógica para manejar los textos
}

export async function showAdministrationMenu(ctx: any) {
  await ctx.reply("Este es el menú de administración");
  await ctx.reply("¿Qué quieres hacer?", {
    reply_markup: {
      inline_keyboard: [[{ text: "Ver colaboradores", callback_data: "ver_colaboradores_page_1" }]],
    },
  });
}

async function verColaboradores(ctx: any, page: number = 1) {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const { data, error } = await supabase.from("colaboradores").select("nombre").range(start, end);

  if (error) {
    console.error("Error al obtener colaboradores:", error);
    await ctx.reply("Hubo un error al obtener la lista de colaboradores.");
    return;
  }

  if (!data || data.length === 0) {
    await ctx.reply("No hay colaboradores registrados.");
    return;
  }

  const colaboradoresList = data.map((colaborador: any) => `- ${colaborador.nombre}`).join("\n");
  const botones = [[{ text: "Atrás al Menú Principal", callback_data: "menu_principal" }]];

  if (page > 1) {
    botones.unshift([{ text: "Página Anterior", callback_data: `ver_colaboradores_page_${page - 1}` }]);
  }

  const { count } = await supabase.from("colaboradores").select("id", { count: "exact", head: true });

  if (end + 1 < (count ?? 0)) {
    botones.push([{ text: "Página Siguiente", callback_data: `ver_colaboradores_page_${page + 1}` }]);
  }

  await ctx.reply(`Lista de colaboradores (Página ${page}):\n\n${colaboradoresList}`, {
    reply_markup: {
      inline_keyboard: botones,
    },
  });
}
