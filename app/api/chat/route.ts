import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const schema: any = {
  description: "Detailed music track parameters for song generation",
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: "The AI Producer's conversational response or question to the user.",
    },
    track_parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tempo: { type: SchemaType.STRING },
        genre: { type: SchemaType.STRING },
        mood: { type: SchemaType.STRING },
        primary_instrumentation: { type: SchemaType.STRING },
        percussion: { type: SchemaType.STRING },
        vocal_element: {
          type: SchemaType.OBJECT,
          properties: {
            style: { type: SchemaType.STRING },
            melody_description: { type: SchemaType.STRING },
            lyrics: { type: SchemaType.STRING },
          }
        }
      }
    },
    active_parameter: {
      type: SchemaType.STRING,
      description: "The ID of the parameter currently being discussed (e.g., 'mood', 'tempo').",
    }
  },
  required: ["message", "track_parameters", "active_parameter"],
};

export async function POST(req: NextRequest) {
  try {
    const { messages, currentParameters } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
      systemInstruction: `You are "The Producer", a world-class AI music producer. Your goal is to help the user define a song by asking sequential questions.
      
      RULES:
      1. Be professional, creative, and encouraging.
      2. Follow an INTERVIEW STYLE: Ask ONE question at a time to fill in the musical parameters.
      3. Maintain the JSON state of the "track_parameters" gathered so far.
      4. Valid parameters: mood, genre, tempo, primary_instrumentation, percussion, vocal_element.
      5. "active_parameter" should be the ID of the field you are CURRENTLY asking about.
      6. If you have all the info, confirm the final project and set "active_parameter" to "complete".`,
    });

    const result = await model.generateContent(JSON.stringify({
      history: messages,
      current_state: currentParameters
    }));

    const responseText = result.response.text();
    return NextResponse.json(JSON.parse(responseText));
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
