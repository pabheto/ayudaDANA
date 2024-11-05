import { AvailableRoles, flushSessionForms, showRegistrationMainMenu } from "../index.ts";
import { askHelpRequestQuestions } from "./helpRequests.ts";
import { supabase } from "./supabase.ts";

//#region Funciones CRUD para madres
export async function getMother(userId: number | undefined): Promise<any> {
  if (!userId) return null;
  const { data, error } = await supabase.from("mothers").select("*").eq("telegram_id", userId).single();

  if (error) {
    console.error("Error getting mother:", error);
    return null;
  }

  return data;
}

export async function saveMother(
  userId: number | undefined,
  answers: string[],
  telegramUsername: string | undefined
): Promise<void> {
  if (!userId || answers.length < 6) return;

  const [nombreCompleto, telefono, calleNumeroPiso, puebloAfectado, codigoPostal, descripcion] = answers;

  const { error } = await supabase.from("mothers").insert({
    telegram_id: userId,
    nombre_completo: nombreCompleto,
    telefono: telefono,
    calle_numero_piso: calleNumeroPiso,
    pueblo_afectado: puebloAfectado,
    codigo_postal: codigoPostal,
    descripcion_dana: descripcion,
    telegram_username: telegramUsername,
  });

  if (error) console.error("Error saving mother:", error);
}

export async function checkMotherExists(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.from("mothers").select("id").eq("telegram_id", userId).single();

  if (error) {
    // If error.details contains "contains 0 rows" it means the mother doesn't exist yet
    // Do not log an error
    if (error.details.includes("contains 0 rows")) {
      console.log("Mother not found");
    } else {
      console.warn("Error checking mother:", error);
    }

    // Return false if there was an error
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

export async function handleMotherButtonsCallbacks(ctx: any) {
  const choice = ctx.callbackQuery?.data;

  if (choice === "mother_pedir_ayuda") {
    await flushSessionForms(ctx); // Resetear los formularios en la sesión
    await askHelpRequestQuestions(ctx, 0); // Iniciamos el formulario de solicitud
  }

  if (choice === "mother_mis_datos") {
    await showMotherDataMenu(ctx);
  }

  if (choice === "mother_mis_solicitudes") {
    await showMotherHelpRequestsMenu(ctx);
  }

  if (choice === "mother_menu_principal") {
    await showMainMotherMenu(ctx);
  }

  // Manejo de cada campo para editar
  const fieldMapping: { [key: string]: string } = {
    edit_nombre_completo: "nombre_completo",
    edit_telefono: "telefono",
    edit_direccion: "calle_numero_piso",
    edit_pueblo: "pueblo_afectado",
    edit_codigo_postal: "codigo_postal",
    edit_descripcion: "descripcion_dana",
  };

  if (fieldMapping[choice]) {
    ctx.session.currentEditingField = fieldMapping[choice];
    await ctx.reply(`Introduce el nuevo valor para ${fieldMapping[choice].replace("_", " ")}:`);
  }

  if (choice === "confirm_mother_registration") {
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
                  callback_data: "confirm_mother_registration",
                },
              ],
            ],
          },
        }
      );
      return;
    }

    // Si no hay más preguntas, guardar respuestas y cambiar el rol a madre
    await saveMother(ctx.from?.id, ctx.session.motherAnswers, ctx.from?.username); // Guardar respuestas en la base de datos
    await ctx.reply("Formulario completado. Ahora puedes solicitar ayuda desde el menu abajo.");
    ctx.session.role = AvailableRoles.MOTHER;
    ctx.session.motherQuestionIndex = undefined;
    ctx.session.motherAnswers = [];
    await showMainMotherMenu(ctx);

  }

  if (choice === "cancel_mother_registration") {
    await ctx.reply("No te preocupes, vuelve a intentarlo cuando quieras.");
    ctx.session.motherQuestionIndex = undefined;
    ctx.session.motherAnswers = [];
    await showRegistrationMainMenu(ctx);
  }
}

export async function handleMotherTextCallbacks(ctx: any) {
  if (ctx.session.motherQuestionIndex != null) {
    await askMotherFormQuestions(ctx, ctx.session.motherQuestionIndex);
  }

  if (ctx.session?.motherQuestionIndex != undefined) {
    const questionIndex = ctx.session.motherQuestionIndex;
    ctx.session.motherAnswers[questionIndex] = ctx.message.text;
    await askMotherFormQuestions(ctx, questionIndex + 1);
  }

  if (ctx.session.currentEditingField) {
    const field = ctx.session.currentEditingField;
    const newValue = ctx.message.text;

    // Actualiza el campo en la base de datos
    const { error } = await supabase
      .from("mothers")
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
    await showMotherDataMenu(ctx);
    return;
  }
}

export async function askMotherFormQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < initialMotherFormQuestions.length) {
    // Si hay más preguntas, preguntar la siguiente
    ctx.session.motherQuestionIndex = questionIndex;
    await ctx.reply(initialMotherFormQuestions[questionIndex]);
  } else if (questionIndex === initialMotherFormQuestions.length) {
    // Enviar un mensaje de confirmación antes de registrar la madre
    const [nombreCompleto, telefono, calleNumeroPiso, puebloAfectado, codigoPostal, descripcion] =
      ctx.session.motherAnswers;
    const summaryMessage = `Te estás registrando como una madre que solicita ayuda. Aquí tienes un resumen de tus datos:
    
Nombre: ${nombreCompleto}
Teléfono: ${telefono}
Dirección: ${calleNumeroPiso}
Pueblo afectado: ${puebloAfectado}
Código Postal: ${codigoPostal}
Descripción: ${descripcion}`;
    await ctx.reply(summaryMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Confirm", callback_data: "confirm_mother_registration" }],
          [{ text: "Corregir", callback_data: "cancel_mother_registration" }],
        ],
      },
    });
  }
  /* else {
    // Intentar conseguir el nombre de usuario, si no hay, pedir que se lo haga y lo vuelva a intentar
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
                  callback_data: "retry_username",
                },
              ],
            ],
          },
        }
      );
      return;
    }

    // Si no hay más preguntas, guardar respuestas y cambiar el rol a madre
    await saveMother(ctx.from?.id, ctx.session.motherAnswers, ctx.from?.username); // Guardar respuestas en la base de datos
    await ctx.reply("Formulario completado. Ahora puedes solicitar ayuda desde el menu abajo.");
    ctx.session.role = AvailableRoles.MOTHER;
    ctx.session.motherQuestionIndex = undefined;
    ctx.session.motherAnswers = [];
    await showMainMotherMenu(ctx);
  } */
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

// Función para mostrar el menú "Mis Datos" con opciones de modificación
export async function showMotherDataMenu(ctx: any) {
  const mother = await getMother(ctx.from?.id);

  if (!mother) {
    await ctx.reply("No se encontraron datos. Asegúrate de haber completado el registro.");
    return;
  }

  // Mostrar cada dato con un botón de modificación
  await ctx.reply("Aquí puedes ver y modificar tus datos personales:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: `Nombre: ${mother.nombre_completo}`, callback_data: "edit_nombre_completo" }],
        [{ text: `Teléfono: ${mother.telefono}`, callback_data: "edit_telefono" }],
        [{ text: `Dirección: ${mother.calle_numero_piso}`, callback_data: "edit_direccion" }],
        [{ text: `Pueblo afectado: ${mother.pueblo_afectado}`, callback_data: "edit_pueblo" }],
        [{ text: `Código Postal: ${mother.codigo_postal}`, callback_data: "edit_codigo_postal" }],
        [{ text: `Descripción: ${mother.descripcion_dana}`, callback_data: "edit_descripcion" }],
        [{ text: "Volver al Menú Principal", callback_data: "mother_menu_principal" }],
      ],
    },
  });
}

export async function showMotherHelpRequestsMenu(ctx: any) {
  await ctx.reply("Aquí puedes ver y modificar tus solicitudes de ayuda. (TODO)");

  // TODO: Añadir opciones para ver y modificar solicitudes de ayuda
}
//#endregion
