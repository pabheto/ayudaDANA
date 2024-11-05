import { AvailableRoles } from "../index.ts";
import { supabase } from "./supabase.ts";

//#region Funciones CRUD para colaboradores
export async function saveCollaborator(
  userId: number | undefined,
  answers: string[]
): Promise<void> {
  if (!userId || answers.length < 5) return;

  const [
    nombreCompleto,
    contacto,
    profesion,
    formacionExperiencia,
    tipoAyuda,
    numeroColegiado = null,
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
  }
}

export async function checkCollaboratorExists(
  userId: number | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id")
    .eq("telegram_id", userId)
    .single();

  if (error) {
    console.error("Error checking collaborator:", error);
    return false;
  }

  return !!data;
}
//#endregion

//#region Formulario inicial de registro para colaboradores
// Preguntas iniciales para los colaboradores
export const initialCollaboratorFormQuestions = [
  "Nombre completo",
  "Contacto",
  "Profesión",
  "Formación y experiencia en el área maternoinfantil",
  "Tipo de ayuda que puedes ofrecer (especialidad)",
  "Número de colegiado (opcional)",
];

// Función para hacer preguntas del formulario inicial para colaboradores
export async function askCollaboratorFormQuestions(
  ctx: any,
  questionIndex: number
) {
  if (questionIndex < initialCollaboratorFormQuestions.length) {
    ctx.session.collaboratorQuestionIndex = questionIndex;
    await ctx.reply(initialCollaboratorFormQuestions[questionIndex]);
  } else {
    ctx.session.role = AvailableRoles.COLLABORATOR;
    await saveCollaborator(ctx.from?.id, ctx.session.collaboratorAnswers);
    await ctx.reply(
      "Formulario de colaborador completado. Gracias por ofrecer tu ayuda."
    );
    ctx.session.collaboratorAnswers = [];
    ctx.session.collaboratorQuestionIndex = undefined;
  }
}
//#endregion
