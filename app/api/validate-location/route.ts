// app/api/validate-location/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { query } = await req.json();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Is "${query}" a famous, real-world geographical landmark? 
  If yes, return only the name of the place. 
  If no, return "NO_SUCH_PLACE".`;

  const result = await model.generateContent(prompt);
  const response = result.response.text().trim();

  return Response.json({ result: response });
}