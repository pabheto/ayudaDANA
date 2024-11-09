import { AvailableRoles, showRegistrationMainMenu } from "../index.ts";
import telegramBot from "./bot.ts";
import { supabase } from "./supabase.ts";

//#region Funciones CRUD para colaboradores
export async function saveCollaborator(
  userId: number | undefined,
  answers: string[],
  telegramUsername: string | undefined
): Promise<void> {
  if (!userId || answers.length < 5) return;

  const [nombreCompleto, telefono, profesion, formacionExperiencia, tipoAyuda, numeroColegiado = null] = answers;

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

export async function checkCollaboratorExists(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.from("collaborator").select("id").eq("telegram_id", userId).single();

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
  const { data, error } = await supabase.from("collaborator").select("*").eq("telegram_id", userId).single();
  return data ?? null;
}

//#endregion

//#region Formularios
// Callbacks para los botones

// Función para mostrar el menú de datos del colaborador con opciones de edición
export async function showCollaboratorDataMenu(ctx: any) {
  const collaborator = await getCollaborator(ctx.from?.id);

  if (!collaborator) {
    await ctx.reply("No se encontraron tus datos. Asegúrate de estar registrado como colaborador.");
    return;
  }

  await ctx.reply("Aquí puedes ver y editar tus datos personales:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: `Nombre: ${collaborator.nombre_completo}`, callback_data: "edit_nombre_completo" }],
        [{ text: `Teléfono: ${collaborator.telefono}`, callback_data: "edit_telefono" }],
        [{ text: `Profesión: ${collaborator.profesion}`, callback_data: "edit_profesion" }],
        [
          {
            text: `Formación y experiencia: ${collaborator.formacion_experiencia}`,
            callback_data: "edit_formacion_experiencia",
          },
        ],
        [{ text: `Especialidad: ${collaborator.tipo_ayuda}`, callback_data: "edit_tipo_ayuda" }],
        [
          {
            text: `Número de colegiado: ${collaborator.numero_colegiado || "No especificado"}`,
            callback_data: "edit_numero_colegiado",
          },
        ],
        [{ text: "Volver al Menú Principal", callback_data: "menu_principal" }],
      ],
    },
  });
}
export async function handleCollaboratorButtonsCallbacks(ctx: any) {
  const choice = ctx.callbackQuery?.data;

  if (choice === "collaborator_edit_data") {
    await showCollaboratorDataMenu(ctx); // Muestra el menú de edición de datos
    return;
  }

  // Gestión de los botones de la especialidad
  if (ctx.session.collaboratorQuestionIndex === 4) {
    console.log("Seleccionado botón de especialidad ", ctx.callbackQuery);
    if (!ctx.callbackQuery?.data.startsWith("speciality_")) {
      await ctx.reply("Por favor, selecciona una opción ", createSpecialitiesKeyboard());
      return false;
    }

    const specialityKey = ctx.callbackQuery.data.replace("speciality_", "");
    let specialityContent = HelpSpecialities[specialityKey];
    if (!specialityContent) {
      specialityContent = HelpSpecialities.OTROS;
    }
    ctx.session.collaboratorAnswers[ctx.session.collaboratorQuestionIndex] = specialityContent;

    // Show selected speciality and move to next question
    await ctx.reply(`Especialidad seleccionada: ${specialityContent}`);
    await askCollaboratorFormQuestions(ctx, ctx.session.collaboratorQuestionIndex + 1);

    // Answer the callback query to remove loading state
    // await ctx.answerCallbackQuery();

    // Delete the menu message
    // await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

    return true; // Handled the callback
  }

  if (choice === "confirm_collaborator_registration") {
    // Guardar el colaborador
    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply(
        "No he podido conseguir tu nombre de usuario de Telegram. Por favor, establece un usuario de telegram y vuelve a intentarlo.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Reintentar",
                  callback_data: "confirm_collaborator_registration",
                },
              ],
            ],
          },
        }
      );
      return;
    }

    await saveCollaborator(ctx.from?.id, ctx.session.collaboratorAnswers, ctx.from?.username);
    await ctx.reply("Formulario de colaborador completado. Gracias por ofrecer tu ayuda.");

    // Add telegram user to the group with id -1002266155232c
    try {
      // Use grammy
      const chatLink = await telegramBot.api.createChatInviteLink("-1002266155232", { member_limit: 1 });
      await ctx.reply(
        "Por favor, únete al grupo de colaboradores para poder colaborar con el resto de profesionales. " +
          chatLink.invite_link
      );
    } catch (error) {
      console.error("Error adding user to group:", error);
      await ctx.reply("Ha habido un error al añadirte al grupo. Por favor, contacta con el administrador.");
    }

    ctx.session.role = AvailableRoles.COLLABORATOR;
    ctx.session.collaboratorQuestionIndex = undefined;
    ctx.session.collaboratorAnswers = [];
  }

  if (choice === "cancel_collaborator_registration") {
    await ctx.reply("No te preocupes, vuelve a intentarlo cuando quieras.");
    ctx.session.collaboratorQuestionIndex = undefined;
    ctx.session.collaboratorAnswers = [];
    await showRegistrationMainMenu(ctx);
  }

  // Mapear los botones de edición a los campos de la base de datos
  const fieldMapping: { [key: string]: string } = {
    edit_nombre_completo: "nombre_completo",
    edit_telefono: "telefono",
    edit_profesion: "profesion",
    edit_formacion_experiencia: "formacion_experiencia",
    edit_tipo_ayuda: "tipo_ayuda",
    edit_numero_colegiado: "numero_colegiado",
  };

  if (fieldMapping[choice]) {
    ctx.session.currentEditingField = fieldMapping[choice];
    await ctx.reply(`Introduce el nuevo valor para ${fieldMapping[choice].replace("_", " ")}:`);
  }
}

export async function handleCollaboratorTextCallbacks(ctx: any) {
  if (ctx.session.currentEditingField) {
    const field = ctx.session.currentEditingField;
    const newValue = ctx.message.text;

    // Actualizar el campo en la base de datos
    const { error } = await supabase
      .from("collaborator")
      .update({ [field]: newValue })
      .eq("telegram_id", ctx.from?.id);

    if (error) {
      console.error("Error al actualizar el campo:", error);
      await ctx.reply("Hubo un error al actualizar el dato. Inténtalo de nuevo.");
    } else {
      await ctx.reply(`El campo ${field.replace("_", " ")} ha sido actualizado exitosamente.`);
    }

    // Limpiar el estado de edición y mostrar el menú de datos actualizado
    ctx.session.currentEditingField = undefined;
    await showCollaboratorMenu(ctx);
    return;
  }

  if (ctx.session.collaboratorQuestionIndex != undefined || ctx.session.collaboratorQuestionIndex != null) {
    const questionIndex = ctx.session.collaboratorQuestionIndex;

    if (questionIndex === 4) {
      // Estamos esperando respuesta de un botón, no de un texto
      // Enviar un mensaje diciendo que se debe seleccionar una opción
      await ctx.reply("Por favor, selecciona una opción pulsando en el botón ", createSpecialitiesKeyboard());
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
  "Escribe el tipo de ayuda que puedes ofrecer (especialidad; si tienes más de una, selecciona una y una vez dentro podrás entrar en la otra)",
  "Escribe tu número de colegiado (para especialidad sanitaria, si no, escribe “no soy sanitaria”)",
];

export enum HelpSpecialities {
  PSICOLOGIA_PERINATAL = "Psicología perinatal",
  PSICOLOGIA_INFANTIL = "Psicología infantil",
  PEDIATRIA = "Pediatría",
  MATRONA_GINECOLOGIA = "Matrona y ginecología",
  ENFERMERIA_PEDIATRICA = "Enfermería pediátrica",
  LOGOPEDIA_NEONATAL = "Logopedia neonatal",
  FISIOTERAPIA_PEDIATRICA_RESPIRATORIA = "Fisioterapia pediátrica y respiratoria",
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
export async function askCollaboratorFormQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < initialCollaboratorFormQuestions.length) {
    ctx.session.collaboratorQuestionIndex = questionIndex;
    const question = initialCollaboratorFormQuestions[questionIndex];

    if (questionIndex === 4) {
      // Por cada especialidad, mostrar un botón
      await ctx.reply(question, createSpecialitiesKeyboard());
    } else {
      await ctx.reply(question);
    }
  } else if (questionIndex === initialCollaboratorFormQuestions.length) {
    // Enviar un mensaje de confirmación
    const [nombreCompleto, telefono, profesion, formacionExperiencia, tipoAyuda, numeroColegiado] =
      ctx.session.collaboratorAnswers;
    const summaryMessage = `Te estás registrando como un profesional que puede ofrecer ayuda. Aquí tienes un resumen de tus datos:
    
Nombre: ${nombreCompleto}
Teléfono: ${telefono}
Profesión: ${profesion}
Formación y experiencia: ${formacionExperiencia}
Especialidad: ${tipoAyuda}
Número de colegiado: ${numeroColegiado}

¿Son correctos estos datos?`;

    await ctx.reply(summaryMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Confirmar", callback_data: "confirm_collaborator_registration" }],
          [{ text: "Corregir", callback_data: "cancel_collaborator_registration" }],
        ],
      },
    });
  }
  /* else {
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
  } */
}
//#endregion

//#region Menús
export async function showCollaboratorMenu(ctx: any) {
  // Obteniendo el colaborador actual
  // await ctx.reply("He visto que ya estas dado de alta como profesional");

  await ctx.reply("¿Qué deseas hacer?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Editar mis datos", callback_data: "collaborator_edit_data" }],
        /*[
          {
            text: "Eliminar cuenta",
            callback_data: "collaborator_delete_account",
          },
        ], */
      ],
    },
  });
}
//#endregion
