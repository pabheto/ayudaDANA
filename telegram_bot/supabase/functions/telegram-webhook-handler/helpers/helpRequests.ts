import { supabase } from "./supabase.ts";

//#region Funciones CRUD para solicitudes de ayuda
export async function saveHelpRequest(
  userId: number | undefined,
  answers: string[]
): Promise<void> {
  if (!userId || answers.length < 3) return;

  const [nivelUrgencia, especialidad, motivoConsulta] = answers;

  const { error } = await supabase.from("help_requests").insert({
    telegram_id: userId,
    nivel_urgencia: nivelUrgencia,
    especialidad: especialidad,
    motivo_consulta: motivoConsulta,
  });

  if (error) console.error("Error saving help request:", error);
}
//#endregion

//#region Formularios
export const helpRequestQuestions = [
  "¿Cuál es el nivel de urgencia? (Alto/Medio/Bajo)",
  "¿Qué tipo de especialista necesitas?",
  "Describe brevemente el motivo de tu consulta",
];

export const specialities = [
  "- Psicología",
  "- Pediatría",
  "- Lactancia",
  "- Nutrición",
  "- Fisioterapia",
  "- Otro",
];

export async function askHelpRequestQuestions(ctx: any, questionIndex: number) {
  if (questionIndex < helpRequestQuestions.length) {
    ctx.session.helpRequestQuestionIndex = questionIndex;
    const question = helpRequestQuestions[questionIndex];
    if (questionIndex === 1) {
      await ctx.reply(question + "\n" + specialities.join("\n"));
    } else {
      await ctx.reply(question);
    }
  } else {
    await saveHelpRequest(ctx.from?.id, ctx.session.helpRequestAnswers);
    await ctx.reply(
      "Solicitud de ayuda enviada. Pronto nos pondremos en contacto contigo."
    );
    ctx.session.helpRequestAnswers = [];
    ctx.session.helpRequestQuestionIndex = undefined;
  }
}
//#endregion
