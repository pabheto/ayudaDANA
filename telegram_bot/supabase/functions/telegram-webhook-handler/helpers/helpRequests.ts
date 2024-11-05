import { getMother } from "./mothers.ts";
import { supabase } from "./supabase.ts";
import telegramBot from "./bot.ts";

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
  OTROS = "Otros",
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
  } else {
    const helpRequestId = await saveHelpRequest(ctx.from?.id, ctx.session.helpRequestAnswers);
    // Enviar la solicitud de ayuda a los chats de streaming
    streamHelpRequest(helpRequestId);

    await ctx.reply("Solicitud de ayuda enviada. Pronto nos pondremos en contacto contigo.");
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = undefined;
  }
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
  }

  if (ctx.session.helpRequestQuestionIndex === 1) {
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
}

//#endregion

//#region Gestión de solicitudes de ayuda en tiempo real
const STREAM_HELP_REQUEST_CHAT_IDS = [412430132, 9150852, 280023];

const STREAM_HELP_REQUEST_THREAD_IDS_MAP: Record<HelpSpecialities, { chatId: number; threadId: string }[]> = {
  [HelpSpecialities.PSICOLOGIA_PERINATAL]: [],
  [HelpSpecialities.PSICOLOGIA_INFANTIL]: [],
  [HelpSpecialities.PEDIATRIA]: [],
  [HelpSpecialities.OTROS]: [
    {
      chatId: -1002266155232,
      threadId: "49",
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

  const message = `Nueva solicitud de ayuda de ${mother.nombre_completo} (${mother.telegram_id})
    - Nivel de urgencia: ${helpRequest.nivel_urgencia}
    - Especialidad: ${helpRequest.especialidad}
    - Motivo de consulta: ${helpRequest.motivo_consulta}`;

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [[{ text: "Atender Solicitud", callback_data: `helpRequest_attend_${helpRequestId}` }]],
    },
  };

  // Obtener la especialidad de la solicitud de ayuda
  const speciality = helpRequest.especialidad;

  // Enviar el mensaje a los chats de streaming de la especialidad
  let targetThreads = STREAM_HELP_REQUEST_THREAD_IDS_MAP[speciality as HelpSpecialities];

  if (!targetThreads) {
    targetThreads = STREAM_HELP_REQUEST_THREAD_IDS_MAP[HelpSpecialities.OTROS];
  }

  for (const threadInfo of targetThreads) {
    await telegramBot.api.sendMessage(threadInfo.chatId, message, {
      message_thread_id: threadInfo.threadId,
    });
  }
}

export async function attendHelpRequest(helpRequestId: number) {
  const helpRequest = await getHelpRequest(helpRequestId);
}

//#endregion
