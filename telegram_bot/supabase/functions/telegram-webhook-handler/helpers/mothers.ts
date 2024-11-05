import { AvailableRoles } from "../index.ts";
import { supabase } from "./supabase.ts";

//#region Funciones CRUD para madres
export async function getMother(userId: number | undefined): Promise<any> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("mothers")
    .select("*")
    .eq("telegram_id", userId)
    .single();
}

export async function saveMother(
  userId: number | undefined,
  answers: string[],
): Promise<void> {
  if (!userId || answers.length < 6) return;

  const [
    nombreCompleto,
    telefono,
    calleNumeroPiso,
    puebloAfectado,
    codigoPostal,
    descripcion,
  ] = answers;

  const { error } = await supabase.from("mothers").insert({
    telegram_id: userId,
    nombre_completo: nombreCompleto,
    telefono: telefono,
    calle_numero_piso: calleNumeroPiso,
    pueblo_afectado: puebloAfectado,
    codigo_postal: codigoPostal,
    descripcion_dana: descripcion,
  });

  if (error) console.error("Error saving mother:", error);
}

export async function checkMotherExists(
  userId: number | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("mothers")
    .select("id")
    .eq("telegram_id", userId)
    .single();

  if (error) {
    console.error("Error checking mother:", error);
    return false;
  }

  return !!data;
}
//#endregion

//#region Formulario inicial de registro para madres
// Preguntas iniciales para las madres que solicitan ayuda
const initialMotherFormQuestions = [
  "Dime tu nombre y apellidos",
  "Escribe tu teléfono de contacto",
  "⁠Escribe tu dirección",
  "¿En qué pueblo afectado por DANA te encuentras?",
  "Escribe el código postal",
  "Describe qué daños te ha causado la situación DANA y cuál es tu situación actual.",
];

//#endregion

//#region Formularios
// Registro de madres
export async function askMotherFormQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < initialMotherFormQuestions.length) {
    // Si hay más preguntas, preguntar la siguiente
    ctx.session.motherQuestionIndex = questionIndex;
    await ctx.reply(initialMotherFormQuestions[questionIndex]);
  } else {
    // Si no hay más preguntas, guardar respuestas y cambiar el rol a madre
    ctx.session.role = AvailableRoles.MOTHER;
    ctx.session.motherQuestionIndex = undefined;
    ctx.session.motherAnswers = [];
    await saveMother(ctx.from?.id, ctx.session.motherAnswers); // Guardar respuestas en la base de datos
    await ctx.reply(
      "Formulario completado. Ahora puedes solicitar ayuda con el comando /ayuda.",
    );
  }
}
//#endregion

//#region Menús
// Función para mostrar el menú principal con opciones "Pedir Ayuda" y "Mis Datos"
export async function showMainMotherMenu(ctx: any) {
  await ctx.reply("¿Qué deseas hacer?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Pedir Ayuda", callback_data: "mother_pedir_ayuda" }],
        [{ text: "Mis Datos", callback_data: "mother_mis_datos" }],
      ],
    },
  });
}

// Menú para ver y modificar los datos de una madreS
export async function showMotherDataMenu(ctx: any) {
  await ctx.reply("Aquí puedes ver y modificar tus datos personales.");
  const mother = await getMother(ctx.from?.id);
  // Imprimir datos principales
  await ctx.reply(`Nombre: ${mother?.nombre_completo}`);
  await ctx.reply(`Contacto: ${mother?.telefono}`);
  await ctx.reply(`Direccion: ${mother?.calle_numero_piso}`);
  await ctx.reply(`Pueblo afectado: ${mother?.pueblo_afectado}`);
  await ctx.reply(`Código postal: ${mother?.codigo_postal}`);
  await ctx.reply(
    `Descripción de la situación DANA: ${mother?.descripcion_dana}`,
  );

  // TODO: Añadir opciones para modificar los datos
  await showMainMotherMenu(ctx);
}

export async function showMotherHelpRequestsMenu(ctx: any) {
  await ctx.reply(
    "Aquí puedes ver y modificar tus solicitudes de ayuda. (TODO)",
  );

  // TODO: Añadir opciones para ver y modificar solicitudes de ayuda
}
//#endregion
