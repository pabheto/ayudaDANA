import {
  Bot,
  session,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import { askCollaboratorFormQuestions } from "./helpers/collaborators.ts";
import { askHelpRequestQuestions } from "./helpers/helpRequests.ts";
import {
  askMotherFormQuestions,
  checkMotherExists,
  showMainMotherMenu,
} from "./helpers/mothers.ts";
import { supabase } from "./helpers/supabase.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

export enum AvailableRoles {
  MOTHER,
  COLLABORATOR,
}

export interface SessionData {
  motherQuestionIndex?: number; // Índice de la pregunta actual en el formulario de madres
  collaboratorQuestionIndex?: number; // Índice de la pregunta actual en el formulario de colaboradores
  helpRequestQuestionIndex?: number; // Índice de la pregunta actual en el formulario de solicitud de ayuda
  motherAnswers?: string[]; // Respuestas acumuladas del formulario de madres
  collaboratorAnswers?: string[]; // Respuestas acumuladas del formulario de colaboradores
  helpRequestAnswers?: string[]; // Respuestas acumuladas del formulario de solicitud de ayuda
  role?: AvailableRoles; // Rol del usuario
}

const initialSessionData: SessionData = {
  motherQuestionIndex: undefined,
  collaboratorQuestionIndex: undefined,
  helpRequestQuestionIndex: undefined,
  motherAnswers: [],
  collaboratorAnswers: [],
  helpRequestAnswers: [],
  role: undefined,
};

const supabaseSessionStorage = {
  async read(key: string): Promise<SessionData | undefined> {
    const { data, error } = await supabase
      .from("telegram_grammy_sessions")
      .select("*")
      .eq("session_id", key)
      .single();

    if (error) {
      console.error("Error reading session from database:", error);
      return undefined;
    }

    return data?.session_data || undefined;
  },

  async write(key: string, value: SessionData): Promise<void> {
    try {
      const { error } = await supabase.from("telegram_grammy_sessions").upsert(
        {
          session_id: key,
          session_data: value,
        },
        {
          onConflict: "session_id",
        }
      );

      if (error) {
        console.error("Error writing session to database:", error);
      }
    } catch (error) {
      console.error("Error writing session to database:", error);
    }
  },

  async delete(key: string): Promise<void> {
    const { error } = await supabase
      .from("telegram_grammy_sessions")
      .delete()
      .eq("session_id", key);

    if (error) {
      console.error("Error deleting session from database:", error);
    }
  },
};

// Middleware para usar el almacenamiento de sesión en Supabase
bot.use(
  session({
    initial: (): SessionData => initialSessionData,
    storage: supabaseSessionStorage,
  })
);

// Comando /start para iniciar el flujo de selección
bot.command("start", async (ctx) => {
  if (ctx.session.role === AvailableRoles.MOTHER) {
    return await showMainMotherMenu(ctx);
  }

  await ctx.reply("Bienvenido. ¿Eres madre o colaborador?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Madre", callback_data: "role_madre" }],
        [{ text: "Colaborador", callback_data: "role_colaborador" }],
      ],
    },
  });
});

// Manejo de selección de "Madre" o "Colaborador"
bot.on("callback_query:data", async (ctx) => {
  const choice = ctx.callbackQuery?.data;

  if (choice === "role_madre") {
    await ctx.reply(
      "Gracias por tu interés. Vamos a completar el formulario inicial."
    );
    await askMotherFormQuestions(ctx, 0); // Inicia las preguntas para madre
  } else if (choice === "role_colaborador") {
    await ctx.reply(
      "Gracias por tu interés en colaborar. Vamos a completar el formulario de profesional."
    );
    await askCollaboratorFormQuestions(ctx, 0); // Inicia las preguntas para colaborador
  }
});

// Responder al formulario de madre
bot.on("message:text", async (ctx) => {
  // Primero, comprobar si se está rellenando algún formulario
  if (ctx.session?.motherQuestionIndex != undefined) {
    const questionIndex = ctx.session.motherQuestionIndex;
    ctx.session.motherAnswers[questionIndex] = ctx.message.text;
    await askMotherFormQuestions(ctx, questionIndex + 1);
  } else if (ctx.session.collaboratorQuestionIndex != undefined) {
    // Responder al formulario de colaborador
    const questionIndex = ctx.session.collaboratorQuestionIndex;
    ctx.session.collaboratorAnswers[questionIndex] = ctx.message.text;
    await askCollaboratorFormQuestions(ctx, questionIndex + 1);
  }
});

// Comando /ayuda para solicitar asistencia específica
bot.command("ayuda", async (ctx) => {
  const userId = ctx.from?.id;

  if (ctx.role === AvailableRoles.MOTHER) {
    const motherExists = await checkMotherExists(userId); // Verificar si la madre ya está registrada
    if (motherExists) {
      await ctx.reply("Por favor responde las siguientes preguntas:");
      await askHelpRequestQuestions(ctx, 0); // Iniciamos el formulario de solicitud
    } else {
      await ctx.reply(
        "Primero debes completar el formulario inicial usando el comando /start."
      );
    }
  }
});

// Responder al formulario de solicitud de ayuda
bot.on("message:text", async (ctx) => {
  if (ctx.session.helpRequestQuestionIndex != null) {
    const questionIndex = ctx.session.helpRequestQuestionIndex;
    ctx.session.helpRequestAnswers[questionIndex] = ctx.message.text;
    await askHelpRequestQuestions(ctx, questionIndex + 1);
  }
});

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response("not allowed", { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
  }
});
