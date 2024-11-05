import { AvailableRoles } from "../index.ts";
import { supabase } from "./supabase.ts";

//#region Funciones CRUD para colaboradores
export async function saveCollaborator(
  userId: number | undefined,
  answers: string[],
  telegramUsername: string | undefined,
): Promise<void> {
  if (!userId || answers.length < 5) return;

  const [
    nombreCompleto,
    telefono,
    profesion,
    formacionExperiencia,
    tipoAyuda,
    numeroColegiado = null,
  ] = answers;

  const { error } = await supabase.from("colaboradores").insert({
    telegram_id: userId,
    nombre_completo: nombreCompleto,
    telefono: telefono,
    profesion: profesion,
    formacion_experiencia: formacionExperiencia,
    tipo_ayuda: tipoAyuda,
    numero_colegiado: numeroColegiado,
    telegram_username: telegramUsername,
  });

  if (error) {
    console.error("Error saving collaborator:", error);
  }
}

export async function checkCollaboratorExists(
  userId: number | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.from("colaboradores").select("id").eq(
    "telegram_id",
    userId,
  ).single();

  if (error) {
    console.error("Error checking collaborator:", error);
    return false;
  }

  return !!data;
}

export async function getCollaborator(userId: number | undefined) {
  if (!userId) return null;
  const { data, error } = await supabase.from("collaborator").select("*").eq(
    "telegram_id",
    userId,
  ).single();
  return data ?? null;
}

//#endregion

//#region Formularios

export async function handleCollaboratorButtonsCallbacks(ctx: any) {
  // TODO: Añadir lógica para manejar los botones

  if (
    choice === "retry_username" &&
    ctx.session.collaboratorQuestionIndex !== undefined
  ) {
    await askCollaboratorFormQuestions(
      ctx,
      ctx.session.collaboratorQuestionIndex,
    );
  }
}

export async function handleCollaboratorTextCallbacks(ctx: any) {
  // TODO: Añadir lógica para manejar los textos
  if (ctx.session.collaboratorQuestionIndex != undefined) {
    const questionIndex = ctx.session.collaboratorQuestionIndex;
    ctx.session.collaboratorAnswers[questionIndex] = ctx.message.text;
    await askCollaboratorFormQuestions(ctx, questionIndex + 1);
  }
}

// Preguntas iniciales para los colaboradores
export const initialCollaboratorFormQuestions = [
  "Escribe tu nombre completo",
  "Escribe tu teléfono de contacto",
  "¿Cuál es tu profesión?",
  "¿Cuál es tu formación y experiencia en el área maternoinfantil?",
  "Escribe el tipo de ayuda que puedes ofrecer (especialidad)",
  "Escribe tu número de colegiado (opcional)",
];

// Función para hacer preguntas del formulario inicial para colaboradores
export async function askCollaboratorFormQuestions(
  ctx: any,
  questionIndex: number,
) {
  if (questionIndex < initialCollaboratorFormQuestions.length) {
    ctx.session.collaboratorQuestionIndex = questionIndex;
    await ctx.reply(initialCollaboratorFormQuestions[questionIndex]);
  } else {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply(
        "No he podido conseguir tu nombre de usuario de Telegram. Por favor, establece un usuario de telegram y vuelve a intentarlo.",
        {
          reply_markup: {
            inline_keyboard: [[{
              text: "Reintentar",
              callback_data: "retry_username",
            }]],
          },
        },
      );
      return;
    }

    await saveCollaborator(
      ctx.from?.id,
      ctx.session.collaboratorAnswers,
      ctx.from?.username,
    );
    await ctx.reply(
      "Formulario de colaborador completado. Gracias por ofrecer tu ayuda.",
    );
    ctx.session.role = AvailableRoles.COLLABORATOR;
    ctx.session.collaboratorQuestionIndex = undefined;
    ctx.session.collaboratorAnswers = [];
  }
}
//#endregion

//#region Menús
export async function showCollaboratorMenu(ctx: any) {
  // Obteniendo el colaborador actual
  await ctx.reply("Menú de colaborador (TODO)");
}
//#endregion
