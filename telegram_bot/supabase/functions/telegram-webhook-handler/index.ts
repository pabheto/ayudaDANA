import {
  session,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import {
  askCollaboratorFormQuestions,
  checkCollaboratorExists,
  handleCollaboratorButtonsCallbacks,
  handleCollaboratorTextCallbacks,
  showCollaboratorMenu,
} from "./helpers/collaborators.ts";
import {
  handleHelpRequestsButtonsCallbacks,
  handleHelpRequestsTextCallbacks,
} from "./helpers/helpRequests.ts";
import {
  askMotherFormQuestions,
  checkMotherExists,
  handleMotherButtonsCallbacks,
  handleMotherTextCallbacks,
  showMainMotherMenu,
} from "./helpers/mothers.ts";
import { supabase } from "./helpers/supabase.ts";
import telegramBot from "./helpers/bot.ts";
import {
  handleAdministrationButtonsCallbacks,
  handleAdministrationTextCallbacks,
  isAdministrator,
  showAdministrationMenu,
} from "./helpers/administration.ts";

export enum AvailableRoles {
  MOTHER,
  COLLABORATOR,
  ADMINISTRATOR,
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

export async function flushSessionForms(ctx: any) {
  // Function para resetear todos los states de los formularios en la sesión
  ctx.session.motherQuestionIndex = undefined;
  ctx.session.collaboratorQuestionIndex = undefined;
  ctx.session.helpRequestQuestionIndex = undefined;
  ctx.session.motherAnswers = [];
  ctx.session.collaboratorAnswers = [];
  ctx.session.helpRequestAnswers = [];
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
    const { data, error } = await supabase.from("telegram_grammy_sessions")
      .select("*").eq("session_id", key).single();

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
        },
      );

      if (error) {
        console.error("Error writing session to database:", error);
      }
    } catch (error) {
      console.error("Error writing session to database:", error);
    }
  },

  async delete(key: string): Promise<void> {
    const { error } = await supabase.from("telegram_grammy_sessions").delete()
      .eq("session_id", key);

    if (error) {
      console.error("Error deleting session from database:", error);
    }
  },
};

// Middleware para usar el almacenamiento de sesión en Supabase
telegramBot.use(
  session({
    initial: (): SessionData => initialSessionData,
    storage: supabaseSessionStorage,
  }),
);

// Comando /start para iniciar el flujo de selección
telegramBot.command("start", async (ctx) => {
  if (isAdministrator(ctx)) {
    console.debug("User is administrator");
    await showAdministrationMenu(ctx);

    return;
  }

  // If the user has no session role, ensure all the data is reset
  if (!ctx.session.role) {
    await flushSessionForms(ctx);
  }

  // If the user is a mother, check if they exist in the database
  if (ctx.session.role === AvailableRoles.MOTHER) {
    console.debug("User is mother, checking if exists in database");
    const motherExists = await checkMotherExists(ctx.from?.id);
    if (motherExists) {
      // Mother exists, show main mother menu
      console.debug("Mother exists, showing main mother menu");
      return await showMainMotherMenu(ctx);
    } else {
      // If mother doesn't exist, reset the session
      console.warn("Mother doesn't exist, resetting session");
      await flushSessionForms(ctx);
      ctx.session.role = undefined;
    }
  }

  // Safeguard to check if a professional exists in the database if they have the role
  if (ctx.session.role === AvailableRoles.COLLABORATOR) {
    console.debug("User is collaborator, checking if exists in database");
    const collaboratorExists = await checkCollaboratorExists(ctx.from?.id);

    if (collaboratorExists) {
      // Collaborator exists, show main collaborator menu
      console.debug("Collaborator exists, showing main collaborator menu");
      return await showCollaboratorMenu(ctx);
    } else {
      // If collaborator doesn't exist, reset the session
      console.warn("Collaborator doesn't exist, resetting session");
      await flushSessionForms(ctx);
      ctx.session.role = undefined;
    }
  }

  await ctx.reply("Bienvenido. ¿Eres madre o profesional?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Madre", callback_data: "role_madre" }],
        [{ text: "Profesional", callback_data: "role_colaborador" }],
      ],
    },
  });
});

// Manejo de las respuestas a botones
telegramBot.on("callback_query:data", async (ctx) => {
  console.debug("Received callback query");
  console.debug("Session:", ctx.session);
  console.debug("Callback data:", ctx.callbackQuery?.data);

  // Gestión de administración
  if (isAdministrator(ctx)) {
    await handleAdministrationButtonsCallbacks(ctx);

    return;
  }

  // Handlers for mother question callbacks
  if (
    ctx.session.role === AvailableRoles.MOTHER ||
    ctx.session.motherQuestionIndex !== undefined
  ) {
    console.debug("Handling mother question callbacks");
    await handleHelpRequestsButtonsCallbacks(ctx);
    await handleMotherButtonsCallbacks(ctx);

    return;
  }

  // Handlers for collaborator question callbacks
  if (
    ctx.session.role === AvailableRoles.COLLABORATOR ||
    ctx.session.collaboratorQuestionIndex !== undefined
  ) {
    console.debug("Handling collaborator question callbacks");
    await handleCollaboratorButtonsCallbacks(ctx);

    return;
  }

  // Callbacks for main menu buttons
  const choice = ctx.callbackQuery?.data;

  if (choice === "role_madre") {
    console.debug("New user selected role madre");

    await ctx.reply(
      "Gracias. Vamos a completar el formulario inicial para crear la conexión madre-profesional.",
    );
    await flushSessionForms(ctx); // Resetear los formularios en la sesión
    await askMotherFormQuestions(ctx, 0); // Inicia las preguntas para madre
  }

  if (choice === "role_colaborador") {
    console.debug("New user selected role colaborador");

    await ctx.reply(
      "Gracias por tu interés en colaborar. Vamos a completar el formulario de profesional.",
    );
    await flushSessionForms(ctx);
    await askCollaboratorFormQuestions(ctx, 0); // Inicia las preguntas para colaborador
  }
});

// Respuesta a mensajes de texto (principalmente para responder formularios)
telegramBot.on("message:text", async (ctx) => {
  // Gestión de administración
  if (isAdministrator(ctx)) {
    await handleAdministrationTextCallbacks(ctx);

    return;
  }

  // Primero, comprobar si se está rellenando algún formulario

  if (
    ctx.session.collaboratorQuestionIndex != undefined ||
    ctx.session.role === AvailableRoles.COLLABORATOR
  ) {
    await handleCollaboratorTextCallbacks(ctx);
  }

  if (
    ctx.session.motherQuestionIndex != undefined ||
    ctx.session.role === AvailableRoles.MOTHER
  ) {
    await handleMotherTextCallbacks(ctx);
  }

  if (ctx.session.role === AvailableRoles.MOTHER) {
    await handleHelpRequestsTextCallbacks(ctx);
  }
});

// Comando /ayuda para solicitar asistencia específica
/* telegramBot.command("ayuda", async (ctx) => {
  const userId = ctx.from?.id;

  if (ctx.role === AvailableRoles.MOTHER) {
    const motherExists = await checkMotherExists(userId); // Verificar si la madre ya está registrada
    if (motherExists) {
      await ctx.reply("Por favor responde las siguientes preguntas:");
      await askHelpRequestQuestions(ctx, 0); // Iniciamos el formulario de solicitud
      return;
    }
  }

  if (ctx.role === AvailableRoles.COLLABORATOR) {
    const collaboratorExists = await checkCollaboratorExists(userId);
    if (collaboratorExists) {
      await showCollaboratorMenu(ctx);
      return;
    }
  }

  await ctx.reply("Primero te debes registrar como persona afectada en el sistema usando el comando /start.");
}); */

/* -------------------------------- Handlers -------------------------------- */
// Handler para manejar las actualizaciones de Telegram
const handleUpdate = webhookCallback(telegramBot, "std/http");

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
