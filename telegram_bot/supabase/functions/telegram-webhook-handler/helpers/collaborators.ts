import { AvailableRoles } from "../index.ts";
import telegramBot from "./bot.ts";
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

  console.debug("Saving collaborator:", {
    userId,
    nombreCompleto,
    telefono,
    profesion,
    formacionExperiencia,
    tipoAyuda,
    numeroColegiado,
    telegramUsername,
  });

  const { error } = await supabase.from("collaborator").insert({
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
  const { data, error } = await supabase.from("collaborator").select("id").eq(
    "telegram_id",
    userId,
  ).single();

  if (error) {
    // If error.details contains "contains 0 rows" it means the collaborator doesn't exist yet
    // Do not log an error
    if (error.details.includes("contains 0 rows")) {
      console.log("Collaborator not found");
    } else {
      console.warn("Error checking collaborator:", error);
    }

    // Return false if there was an error
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
// Callbacks para los botones
export async function handleCollaboratorButtonsCallbacks(ctx: any) {
  // Gestión de los botones de la especialidad
  if (ctx.session.collaboratorQuestionIndex === 4) {
    console.log("Seleccionado botón de especialidad ", ctx.callbackQuery);
    if (!ctx.callbackQuery?.data.startsWith("speciality_")) {
      await ctx.reply(
        "Por favor, selecciona una opción ",
        createSpecialitiesKeyboard(),
      );
      return false;
    }

    const specialityKey = ctx.callbackQuery.data.replace("speciality_", "");
    let specialityContent = HelpSpecialities[specialityKey];
    if (!specialityContent) {
      specialityContent = HelpSpecialities.OTROS;
    }
    ctx.session.collaboratorAnswers[ctx.session.collaboratorQuestionIndex] =
      specialityContent;

    // Show selected speciality and move to next question
    await ctx.reply(`Especialidad seleccionada: ${specialityContent}`);
    await askCollaboratorFormQuestions(
      ctx,
      ctx.session.collaboratorQuestionIndex + 1,
    );

    // Answer the callback query to remove loading state
    // await ctx.answerCallbackQuery();

    // Delete the menu message
    // await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

    return true; // Handled the callback
  }

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
  if (
    ctx.session.collaboratorQuestionIndex != undefined ||
    ctx.session.collaboratorQuestionIndex != null
  ) {
    const questionIndex = ctx.session.collaboratorQuestionIndex;

    if (questionIndex === 4) {
      // Estamos esperando respuesta de un botón, no de un texto
      // Enviar un mensaje diciendo que se debe seleccionar una opción
      await ctx.reply(
        "Por favor, selecciona una opción pulsando en el botón ",
        createSpecialitiesKeyboard(),
      );
    } else {
      // Estamos esperando respuesta de un texto
      ctx.session.collaboratorAnswers[questionIndex] = ctx.message.text;
      await askCollaboratorFormQuestions(ctx, questionIndex + 1);
    }
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

export enum HelpSpecialities {
  PSICOLOGIA_PERINATAL = "Psicología perinatal",
  PSICOLOGIA_INFANTIL = "Psicología infantil",
  PEDIATRIA = "Pediatría",
  MATRONA_GINECOLOGIA = "Matrona y ginecología",
  ENFERMERIA_PEDIATRICA = "Enfermería pediátrica",
  LOGOPEDIA_NEONATAL = "Logopedia neonatal",
  FISIOTERAPIA_PEDIATRICA_RESPIRATORIA =
    "Fisioterapia pediátrica y respiratoria",
  FISIOTERAPIA_SUELO_PELVICO = "Fisioterapia de suelo pélvico",
  DOULA = "Doula",
  ASESORIA_LACTANCIA = "Asesoría de lactancia",
  // OTROS = "Otros",
}

function createSpecialitiesKeyboard() {
  // Crear dos columnas para mostrar las especialidades

  // Inicializar el teclado
  const keyboard = [];

  // Crear dos columnas
  const specialities = Object.entries(HelpSpecialities);

  for (let i = 0; i < specialities.length; i += 2) {
    const row = [];

    for (let j = 0; j < 2; j++) {
      const index = i + j;
      if (index < specialities.length) {
        const [key, value] = specialities[index];
        row.push({
          text: value,
          callback_data: `speciality_${key}`,
        });
      }
    }

    keyboard.push(row);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

// Función para hacer preguntas del formulario inicial para colaboradores
export async function askCollaboratorFormQuestions(
  ctx: any,
  questionIndex: number,
) {
  if (questionIndex < initialCollaboratorFormQuestions.length) {
    ctx.session.collaboratorQuestionIndex = questionIndex;
    const question = initialCollaboratorFormQuestions[questionIndex];

    if (questionIndex === 4) {
      // Por cada especialidad, mostrar un botón
      await ctx.reply(question, createSpecialitiesKeyboard());
    } else {
      await ctx.reply(question);
    }
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

    // Add telegram user to the group with id -1002266155232
    try {
      // Use grammy
      const chatLink = await telegramBot.api.createChatInviteLink(
        "-1002266155232",
        { member_limit: 1 },
      );
      await ctx.reply(
        "Por favor, únete al grupo de colaboradores para poder colaborar con el resto de profesionales. " +
          chatLink.invite_link,
      );
    } catch (error) {
      console.error("Error adding user to group:", error);
      await ctx.reply(
        "Ha habido un error al añadirte al grupo. Por favor, contacta con el administrador.",
      );
    }

    ctx.session.role = AvailableRoles.COLLABORATOR;
    ctx.session.collaboratorQuestionIndex = undefined;
    ctx.session.collaboratorAnswers = [];
  }
}
//#endregion

//#region Menús
export async function showCollaboratorMenu(ctx: any) {
  // Obteniendo el colaborador actual
  await ctx.reply(
    "He visto que ya estas dado de alta como profesional",
  );

  await ctx.reply("¿Qué deseas hacer?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Editar mis datos", callback_data: "collaborator_edit_data" }],
        [{
          text: "Eliminar cuenta",
          callback_data: "collaborator_delete_account",
        }],
      ],
    },
  });
}
//#endregion
