import { getMother, showMainMotherMenu } from "./mothers.ts";
import { supabase } from "./supabase.ts";
import telegramBot from "./bot.ts";
import { getCollaborator } from "./collaborators.ts";
import { MAIN_PROFESSIONAL_CHAT_ID } from "../index.ts";

//#region Funciones CRUD para solicitudes de ayuda
export async function saveHelpRequest(userId: number | undefined, answers: string[]): Promise<number | undefined> {
  if (!userId || answers.length < 3) return;

  const [nivelUrgencia, especialidad, motivoConsulta] = answers;

  const { data, error } = await supabase
    .from("help_requests")
    .insert({
      mother_telegram_id: userId,
      nivel_urgencia: nivelUrgencia,
      especialidad: especialidad,
      motivo_consulta: motivoConsulta,
      estado_solicitud: "PENDIENTE",
    })
    .select("id")
    .single();

  if (error) console.error("Error saving help request:", error);

  // Retornar el id de la solicitud de ayuda
  return data?.id;
}

export async function getHelpRequest(helpRequestId: number) {
  const { data, error } = await supabase.from("help_requests").select("*").eq("id", helpRequestId).single();

  if (error) console.error("Error getting help request:", error);

  return data;
}
//#endregion

//#region Formularios
export const helpRequestQuestions = [
  "¿Cuál es el nivel de urgencia? (Alto/Medio/Bajo)",
  "¿Qué tipo de especialista necesitas?",
  "Describe brevemente el motivo de tu consulta",
];

export enum HelpUrgencyOptions {
  ALTO = "Alto",
  MEDIO = "Medio",
  BAJO = "Bajo",
}

function createUrgencyKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: HelpUrgencyOptions.ALTO, callback_data: "urgency_ALTO" },
          { text: HelpUrgencyOptions.MEDIO, callback_data: "urgency_MEDIO" },
          { text: HelpUrgencyOptions.BAJO, callback_data: "urgency_BAJO" },
        ],
      ],
    },
  };
}

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

export async function askHelpRequestQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < helpRequestQuestions.length) {
    ctx.session.helpRequestQuestionIndex = questionIndex;
    const question = helpRequestQuestions[questionIndex];

    if (questionIndex === 0) {
      await ctx.reply(question, createUrgencyKeyboard());
    } else if (questionIndex === 1) {
      // Por cada especialidad, mostrar un botón
      await ctx.reply(question, createSpecialitiesKeyboard());
    } else {
      await ctx.reply(question);
    }
  } else if (questionIndex === helpRequestQuestions.length) {
    // Enviando una confirmación para que la madre verifique los datos de su solicitud
    const [nivelUrgencia, especialidad, motivoConsulta] = ctx.session.helpRequestAnswers;
    const resumen = `Resumen de tu solicitud de ayuda:
    - Nivel de urgencia: ${nivelUrgencia}
    - Especialidad: ${especialidad}
    - Motivo de consulta: ${motivoConsulta}
    `;

    await ctx.reply(resumen, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Confirmar", callback_data: "confirm_help_request" }],
          [{ text: "Rehacer formulario", callback_data: "redo_help_request" }],
          [{ text: "Cancelar", callback_data: "cancel_help_request" }],
        ],
      },
    });
  }

  /* else {
    
    console.log("Saving help request", ctx.session.helpRequestAnswers);
    const helpRequestId = await saveHelpRequest(ctx.from?.id, ctx.session.helpRequestAnswers);
    // Enviar la solicitud de ayuda a los chats de streaming
    streamHelpRequest(helpRequestId);

    await ctx.reply("Solicitud de ayuda enviada. Pronto nos pondremos en contacto contigo.");
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = undefined;
  } */
}

// Callback para manejar las respuestas de las solicitudes de ayuda
export async function handleHelpRequestsTextCallbacks(ctx: any) {
  if (ctx.session.helpRequestQuestionIndex != null) {
    const questionIndex = ctx.session.helpRequestQuestionIndex;

    if (questionIndex === 0) {
      // Estamos esperando respuesta de un botón, no de un texto
      // Enviar un mensaje diciendo que se debe seleccionar una opción
      await ctx.reply("Por favor, selecciona una opción pulsando en el botón ", createUrgencyKeyboard());
    } else if (questionIndex === 1) {
      // Estamos esperando respuesta de un botón, no de un texto
      // Enviar un mensaje diciendo que se debe seleccionar una opción
      await ctx.reply("Por favor, selecciona una opción pulsando en el botón ", createSpecialitiesKeyboard());
    } else {
      // Estamos esperando respuesta de un texto
      ctx.session.helpRequestAnswers[questionIndex] = ctx.message.text;
      await askHelpRequestQuestions(ctx, questionIndex + 1);
    }
  }
}

// Callback para manejar los botones de las solicitudes de ayuda
export async function handleHelpRequestsButtonsCallbacks(ctx: any) {
  // Gestión de los botones de la especialidad

  if (ctx.session.helpRequestQuestionIndex === 0) {
    console.log("Seleccionado botón de urgencia ", ctx.callbackQuery);
    if (!ctx.callbackQuery?.data.startsWith("urgency_")) {
      await ctx.reply("Por favor, selecciona una opción válida del botón de urgencias ", createUrgencyKeyboard());
      return false;
    }

    const urgencyKey = ctx.callbackQuery.data.replace("urgency_", "");
    let urgencyContent = HelpUrgencyOptions[urgencyKey];

    if (!urgencyContent) {
      urgencyContent = HelpUrgencyOptions.BAJO;
    }

    ctx.session.helpRequestAnswers[ctx.session.helpRequestQuestionIndex] = urgencyContent;

    // Show selected speciality and move to next question
    await ctx.reply(`Urgencia seleccionada: ${urgencyContent}`);
    await askHelpRequestQuestions(ctx, ctx.session.helpRequestQuestionIndex + 1);

    // Answer the callback query to remove loading state
    // await ctx.answerCallbackQuery();

    // Delete the menu message
    // await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

    return true; // Handled the callback
  } else if (ctx.session.helpRequestQuestionIndex === 1) {
    console.log("Seleccionado botón de especialidad ", ctx.callbackQuery);
    if (!ctx.callbackQuery?.data.startsWith("speciality_")) {
      await ctx.reply("Por favor, selecciona una opción ", createSpecialitiesKeyboard());
      return false;
    }

    const specialityKey = ctx.callbackQuery.data.replace("speciality_", "");
    // ctx.session.helpRequestAnswers[ctx.session.helpRequestQuestionIndex] = speciality;
    let specialityContent = HelpSpecialities[specialityKey];
    if (!specialityContent) {
      specialityContent = HelpSpecialities.OTROS;
    }
    ctx.session.helpRequestAnswers[ctx.session.helpRequestQuestionIndex] = specialityContent;

    // Show selected speciality and move to next question
    await ctx.reply(`Especialidad seleccionada: ${specialityContent}`);
    await askHelpRequestQuestions(ctx, ctx.session.helpRequestQuestionIndex + 1);

    // Answer the callback query to remove loading state
    // await ctx.answerCallbackQuery();

    // Delete the menu message
    // await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

    return true; // Handled the callback
  }

  if (ctx.callbackQuery?.data === "confirm_help_request") {
    const helpRequestId = await saveHelpRequest(ctx.from?.id, ctx.session.helpRequestAnswers);
    await streamHelpRequest(helpRequestId);
    await ctx.reply("Solicitud de ayuda confirmada y enviada. Pronto un profesional se pondrá en contacto contigo.");
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = undefined;

    await showMainMotherMenu(ctx);
  } else if (ctx.callbackQuery?.data === "redo_help_request") {
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = 0;
    await ctx.reply("Vamos a empezar el formulario de nuevo.");
    await askHelpRequestQuestions(ctx, 0);
  } else if (ctx.callbackQuery?.data === "cancel_help_request") {
    await ctx.reply("Solicitud de ayuda cancelada.");
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = undefined;

    await showMainMotherMenu(ctx);
  }

  if (ctx.callbackQuery?.data.startsWith("helpRequest_attend_")) {
    const helpRequestId = ctx.callbackQuery.data.replace("helpRequest_attend_", "");
    await attendHelpRequest(ctx, helpRequestId);
  }
}

//#endregion

//#region Gestión de solicitudes de ayuda en tiempo real
// const STREAM_HELP_REQUEST_CHAT_IDS = [412430132, 9150852, 280023];

const STREAM_HELP_REQUEST_THREAD_IDS_MAP: Record<HelpSpecialities, { chatId: number; threadId: string }[]> = {
  [HelpSpecialities.PSICOLOGIA_PERINATAL]: [
    {
      chatId: -1002266155232,
      threadId: "20",
    },
  ],
  [HelpSpecialities.PSICOLOGIA_INFANTIL]: [
    {
      chatId: -1002266155232,
      threadId: "23",
    },
  ],
  [HelpSpecialities.PEDIATRIA]: [
    {
      chatId: -1002266155232,
      threadId: "25",
    },
  ],
  /*[HelpSpecialities.OTROS]: [
    {
      chatId: -1002266155232,
      threadId: "49",
    },
  ],*/
  [HelpSpecialities.MATRONA_GINECOLOGIA]: [
    {
      chatId: -1002266155232,
      threadId: "27",
    },
  ],
  [HelpSpecialities.ENFERMERIA_PEDIATRICA]: [
    {
      chatId: -1002266155232,
      threadId: "29",
    },
  ],
  [HelpSpecialities.LOGOPEDIA_NEONATAL]: [
    {
      chatId: -1002266155232,
      threadId: "31",
    },
  ],
  [HelpSpecialities.FISIOTERAPIA_PEDIATRICA_RESPIRATORIA]: [
    {
      chatId: -1002266155232,
      threadId: "33",
    },
  ],
  [HelpSpecialities.FISIOTERAPIA_SUELO_PELVICO]: [
    {
      chatId: -1002266155232,
      threadId: "35",
    },
  ],
  [HelpSpecialities.DOULA]: [
    {
      chatId: -1002266155232,
      threadId: "37",
    },
  ],
  [HelpSpecialities.ASESORIA_LACTANCIA]: [
    {
      chatId: -1002266155232,
      threadId: "39",
    },
  ],
};

export async function streamHelpRequest(helpRequestId: number | undefined) {
  console.log("Streaming help request", helpRequestId);
  if (!helpRequestId) return;
  const helpRequest = await getHelpRequest(helpRequestId);

  if (!helpRequest) {
    console.error("Help request not found");
    return;
  }

  const mother = await getMother(helpRequest.mother_telegram_id);

  if (!mother) {
    console.error("Mother not found ", helpRequest.mother_telegram_id);
    return;
  }

  const message =
    `*Nueva solicitud de ayuda*\n\n` +
    `*Nombre:* ${mother.nombre_completo}\n` +
    `*Nivel de urgencia:* ${helpRequest.nivel_urgencia} ${
      helpRequest.nivel_urgencia === "Alto" ? "🚨" : helpRequest.nivel_urgencia === "Medio" ? "🟠" : "🟢"
    }\n` +
    `*Especialidad:* ${helpRequest.especialidad}\n` +
    `*Motivo de consulta:* ${helpRequest.motivo_consulta}`;

  // Obtener la especialidad de la solicitud de ayuda
  const speciality = helpRequest.especialidad;

  // Enviar el mensaje a los chats de streaming de la especialidad
  const targetThreads = STREAM_HELP_REQUEST_THREAD_IDS_MAP[speciality as HelpSpecialities];

  if (!targetThreads) {
    // targetThreads = STREAM_HELP_REQUEST_THREAD_IDS_MAP[HelpSpecialities.OTROS];
  }

  const messageIds: {
    chatId: number;
    messageId: number;
    threadId: string;
  }[] = [];
  for (const threadInfo of targetThreads) {
    console.log("Sending message to thread", threadInfo.chatId, threadInfo.threadId);
    const messageResponse = await telegramBot.api.sendMessage(threadInfo.chatId, message, {
      message_thread_id: threadInfo.threadId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "Atender Solicitud", callback_data: `helpRequest_attend_${helpRequestId}` }]],
      },
    });
    console.log("Message sent to thread", threadInfo.chatId, messageResponse);
    const messageId = messageResponse.message_id;

    messageIds.push({
      chatId: threadInfo.chatId,
      messageId,
      threadId: threadInfo.threadId,
    });
  }

  // Guardar los ids de los mensajes en la base de datos
  await supabase
    .from("help_requests")
    .update({
      streaming_message_ids: JSON.stringify({
        messages: messageIds,
      }),
    })
    .eq("id", helpRequestId);

  console.log("Help request streamed and stored", helpRequestId);
  return true;
}

export async function attendHelpRequest(ctx: any, helpRequestId: number) {
  try {
    const helpRequest = await getHelpRequest(helpRequestId);

    if (!helpRequest) {
      console.error("Help request not found");
      await ctx.answerCallbackQuery();
      return;
    }

    const userId = ctx.from?.id;

    if (!userId) {
      console.error("User ID not found when attending help request");
      await ctx.answerCallbackQuery();
      return;
    }

    const mother = await getMother(helpRequest.mother_telegram_id);

    if (!mother) {
      console.error("Mother not found when attending help request", helpRequest.mother_telegram_id);
      await ctx.answerCallbackQuery();
      return;
    }

    const collaborator = await getCollaborator(userId);

    if (!collaborator) {
      await ctx.answerCallbackQuery({
        text: "No estás registrado como colaborador. Por favor, contacta con el bot o con nuestro soporte.",
        show_alert: true,
      });
      console.warn("Collaborator not found when attending help request", userId);
      return;
    }

    if (collaborator?.bloqueado) {
      await ctx.answerCallbackQuery({
        text: "No puedes atender solicitudes porque estás bloqueado. Por favor, contacta con el bot o con nuestro soporte.",
        show_alert: true,
      });
      console.warn("Collaborator is blocked when attending help request", userId);

      try {
        // Eliminando al usuario del grupo
        await telegramBot.api.banChatMember(MAIN_PROFESSIONAL_CHAT_ID, userId);
        console.log("Collaborator banned from chat", collaborator.chat_id);
      } catch (banError) {
        console.error("Error banning collaborator from chat:", banError);
      }
      return;
    }

    // Intento de actualizar la solicitud en la base de datos
    try {
      console.log("Modificando solicitud de ayuda", helpRequest.id);
      await supabase
        .from("help_requests")
        .update({
          attended_by_chat_id: collaborator.telegram_id,
          attended_at: new Date().toISOString(),
          atendido_por_nombre: collaborator.nombre_completo,
          estado_solicitud: "ATENDIDA",
        })
        .eq("id", helpRequest.id);
    } catch (dbError) {
      console.error("Error updating help request in database:", dbError);
      await ctx.answerCallbackQuery({
        text: "Hubo un problema al registrar la solicitud. Inténtalo de nuevo.",
        show_alert: true,
      });
      return;
    }

    // Enviar mensajes de notificación
    try {
      const messageTemplate = `Hola ${mother.nombre_completo}. Soy ${collaborator?.nombre_completo}, ${collaborator?.profesion},
      Estoy aquí para atender tu solicitud: "${helpRequest.motivo_consulta}"`;
      const encodedMessage = encodeURIComponent(messageTemplate);

      await telegramBot.api.sendMessage(
        userId,
        `Gracias por atender la solicitud de ayuda de ${mother.nombre_completo}.

Enviada en: ${helpRequest.created_at}
Solicitud: ${helpRequest.motivo_consulta}

Por favor, contacta con ella a través de su Telegram: [${mother.nombre_completo}](https://t.me/${mother.telegram_username}?text=${encodedMessage})`,
        {
          parse_mode: "Markdown",
        }
      );

      await telegramBot.api.sendMessage(
        helpRequest.mother_telegram_id,
        `Hola ${mother.nombre_completo}. El profesional *${collaborator?.nombre_completo}* te está contactando para atender tu solicitud: "${helpRequest.motivo_consulta}"
Puedes ponerte en contacto con él a través de su Telegram si no te ha contactado en los próximos minutos: [${collaborator.nombre_completo}](https://t.me/${collaborator.telegram_username})
        `,
        {
          parse_mode: "Markdown",
        }
      );
    } catch (messageError) {
      console.error("Error sending messages to collaborator and mother:", messageError);
      await ctx.answerCallbackQuery({
        text: "Hubo un problema al enviar mensajes. Revisa tus mensajes de Telegram.",
        show_alert: true,
      });
      return;
    }

    // Intento de eliminar mensajes de streaming
    try {
      console.log("Removing streaming messages", helpRequest.streaming_message_ids);
      const messagesToRemove = JSON.parse(helpRequest.streaming_message_ids).messages;

      for (const message of messagesToRemove) {
        const { chatId, messageId } = message;
        await telegramBot.api.deleteMessage(chatId, messageId);
      }
    } catch (deleteError) {
      console.error("Error deleting streaming messages:", deleteError);
    }

    // Mensaje de confirmación al usuario que atendió la solicitud
    await ctx.answerCallbackQuery({
      text: "Gracias por atender esta solicitud, por favor, revisa tus mensajes privados y ponte en contacto con la persona que te ha solicitado el bot.",
      show_alert: true,
    });
  } catch (error) {
    console.error("Unexpected error in attendHelpRequest:", error);
    ctx.answerCallbackQuery({
      text: "Hubo un error inesperado. Por favor, inténtalo de nuevo.",
      show_alert: true,
    });
  }
}

//#endregion
