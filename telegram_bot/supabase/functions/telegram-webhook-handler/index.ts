import { Bot, webhookCallback } from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import { createClient } from "https://deno.land/x/supabase@1.0.0/mod.ts"; // Versión específica de Supabase

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

// Preguntas iniciales para las madres que solicitan ayuda
const initialFormQuestions = [
  "Nombre completo",
  "Contacto",
  "Ubicación",
  "Pueblo afectado",
  "Código postal",
  "Descripción de la situación DANA",
];

// Preguntas iniciales para los colaboradores
const initialCollaboratorFormQuestions = [
  "Nombre completo",
  "Contacto",
  "Profesión",
  "Formación y experiencia en el área maternoinfantil",
  "Tipo de ayuda que puedes ofrecer (especialidad)",
  "Número de colegiado (opcional)",
];

// Preguntas de solicitud de ayuda
const helpRequestQuestions = ["Nivel de urgencia", "¿Qué profesional necesitas?", "Motivo de consulta"];

// Lista de especialidades
const specialities = [
  "PSICOLOGÍA PERINATAL",
  "PSICOLOGÍA INFANTIL",
  "PEDIATRÍA",
  "MATRONA Y GINECOLOGÍA",
  "ENFERMERÍA PEDIÁTRICA",
  "LOGOPEDIA NEONATAL",
  "FISIOTERAPIA PEDIÁTRICA Y RESPIRATORIA",
  "FISIOTERAPIA DE SUELO PÉLVICO",
  "DOULA",
  "ASESORÍA DE LACTANCIA",
];

// Comando /start para iniciar el flujo de selección
bot.command("start", async (ctx) => {
  await ctx.reply("Bienvenido. ¿Eres madre o colaborador?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Madre", callback_data: "madre" }],
        [{ text: "Colaborador", callback_data: "colaborador" }],
      ],
    },
  });
});

// Manejo de selección de "Madre" o "Colaborador"
bot.on("callback_query:data", async (ctx) => {
  const choice = ctx.callbackQuery?.data;

  if (choice === "madre") {
    await ctx.reply("Gracias por tu interés. Vamos a completar el formulario inicial.");
    await askMotherFormQuestions(ctx, 0); // Inicia las preguntas para madre
  } else if (choice === "colaborador") {
    await ctx.reply("Gracias por tu interés en colaborar. Vamos a completar el formulario de profesional.");
    await askCollaboratorFormQuestions(ctx, 0); // Inicia las preguntas para colaborador
  }
});

// Función para hacer preguntas del formulario inicial para madres
async function askMotherFormQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < initialMotherFormQuestions.length) {
    ctx.session.motherQuestionIndex = questionIndex;
    await ctx.reply(initialMotherFormQuestions[questionIndex]);
  } else {
    await saveMother(ctx.from?.id, ctx.session.answers); // Guardar respuestas en la base de datos
    await ctx.reply("Formulario completado. Ahora puedes solicitar ayuda con el comando /ayuda.");
    ctx.session.answers = [];
  }
}

// Función para hacer preguntas del formulario inicial para colaboradores
async function askCollaboratorFormQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < initialCollaboratorFormQuestions.length) {
    ctx.session.collaboratorQuestionIndex = questionIndex;
    await ctx.reply(initialCollaboratorFormQuestions[questionIndex]);
  } else {
    await saveCollaborator(ctx.from?.id, ctx.session.collaboratorAnswers); // Guardar respuestas en la base de datos
    await ctx.reply("Formulario de colaborador completado. Gracias por ofrecer tu ayuda.");
    ctx.session.collaboratorAnswers = [];
  }
}

// Responder al formulario de madre
bot.on("message:text", async (ctx) => {
  if (ctx.session.motherQuestionIndex != null) {
    const questionIndex = ctx.session.motherQuestionIndex;
    ctx.session.answers[questionIndex] = ctx.message.text;
    await askMotherFormQuestions(ctx, questionIndex + 1);
  } else if (ctx.session.collaboratorQuestionIndex != null) {
    // Responder al formulario de colaborador
    const questionIndex = ctx.session.collaboratorQuestionIndex;
    ctx.session.collaboratorAnswers[questionIndex] = ctx.message.text;
    await askCollaboratorFormQuestions(ctx, questionIndex + 1);
  }
});

// Comando /ayuda para solicitar asistencia específica
bot.command("ayuda", async (ctx) => {
  const userId = ctx.from?.id;
  const motherExists = await checkMotherExists(userId); // Verificar si la madre ya está registrada
  if (motherExists) {
    await ctx.reply("Por favor responde las siguientes preguntas:");
    await askHelpRequestQuestions(ctx, 0); // Iniciamos el formulario de solicitud
  } else {
    await ctx.reply("Primero debes completar el formulario inicial usando el comando /start.");
  }
});

// Función para hacer preguntas del formulario de solicitud de ayuda
async function askHelpRequestQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < helpRequestQuestions.length) {
    ctx.session.helpRequestQuestionIndex = questionIndex;
    const question = helpRequestQuestions[questionIndex];
    if (questionIndex === 1) {
      await ctx.reply(question + "\n" + specialities.join("\n"));
    } else {
      await ctx.reply(question);
    }
  } else {
    await saveHelpRequest(ctx.from?.id, ctx.session.helpRequestAnswers); // Guardar solicitud en la base de datos
    await ctx.reply("Solicitud de ayuda enviada. Pronto nos pondremos en contacto contigo.");
    ctx.session.helpRequestAnswers = [];
  }
}

// Responder al formulario de solicitud de ayuda
bot.on("message:text", async (ctx) => {
  if (ctx.session.helpRequestQuestionIndex != null) {
    const questionIndex = ctx.session.helpRequestQuestionIndex;
    ctx.session.helpRequestAnswers[questionIndex] = ctx.message.text;
    await askHelpRequestQuestions(ctx, questionIndex + 1);
  }
});

async function checkMotherExists(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.from("mothers").select("id").eq("telegram_id", userId).single();

  if (error) {
    console.error("Error checking mother:", error);
    return false;
  }

  return !!data;
}

async function saveMother(userId: number | undefined, answers: string[]): Promise<void> {
  if (!userId || answers.length < 6) return;

  const [nombreCompleto, contacto, ubicacion, puebloAfectado, codigoPostal, descripcion] = answers;

  const { error } = await supabase.from("mothers").insert({
    telegram_id: userId,
    nombre_completo: nombreCompleto,
    contacto: contacto,
    ubicacion: ubicacion,
    pueblo_afectado: puebloAfectado,
    codigo_postal: codigoPostal,
    descripcion_dana: descripcion,
  });

  if (error) console.error("Error saving mother:", error);
}

async function saveCollaborator(userId: number | undefined, answers: string[]): Promise<void> {
  if (!userId || answers.length < 5) return;

  const [
    nombreCompleto,
    contacto,
    profesion,
    formacionExperiencia,
    tipoAyuda,
    numeroColegiado = null, // Este campo es opcional
  ] = answers;

  const { error } = await supabase.from("colaboradores").insert({
    telegram_id: userId,
    nombre_completo: nombreCompleto,
    contacto: contacto,
    profesion: profesion,
    formacion_experiencia: formacionExperiencia,
    tipo_ayuda: tipoAyuda,
    numero_colegiado: numeroColegiado,
  });

  if (error) {
    console.error("Error saving collaborator:", error);
  } else {
    console.log("Collaborator saved successfully");
  }
}

async function saveHelpRequest(userId: number | undefined, answers: string[]): Promise<void> {
  if (!userId || answers.length < 3) return;

  const [nivelUrgencia, especialidad, motivoConsulta] = answers;

  const { error } = await supabase.from("help_requests").insert({
    telegram_id: userId,
    nivel_urgencia: nivelUrgencia,
    especialidad: especialidad,
    motivo_consulta: motivoConsulta,
    timestamp: new Date().toISOString(), // Para registrar la fecha/hora de la solicitud
  });

  if (error) console.error("Error saving help request:", error);
}

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
