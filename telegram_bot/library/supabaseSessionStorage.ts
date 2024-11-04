export interface SessionData {
  motherQuestionIndex?: number; // Índice de la pregunta actual en el formulario de madres
  collaboratorQuestionIndex?: number; // Índice de la pregunta actual en el formulario de colaboradores
  helpRequestQuestionIndex?: number; // Índice de la pregunta actual en el formulario de solicitud de ayuda
  answers?: string[]; // Respuestas acumuladas del formulario de madres
  collaboratorAnswers?: string[]; // Respuestas acumuladas del formulario de colaboradores
  helpRequestAnswers?: string[]; // Respuestas acumuladas del formulario de solicitud de ayuda
}

const supabaseSessionStorage = {
  async read(key: string): Promise<SessionData | undefined> {
    const { data, error } = await supabase.from("sessions").select("session_data").eq("id", key).single();

    if (error) {
      console.error("Error reading session from database:", error);
      return undefined;
    }

    return data?.session_data || undefined;
  },

  async write(key: string, value: SessionData): Promise<void> {
    const { error } = await supabase.from("sessions").upsert({
      id: key,
      session_data: value,
    });

    if (error) {
      console.error("Error writing session to database:", error);
    }
  },

  async delete(key: string): Promise<void> {
    const { error } = await supabase.from("sessions").delete().eq("id", key);

    if (error) {
      console.error("Error deleting session from database:", error);
    }
  },
};

export default supabaseSessionStorage;
