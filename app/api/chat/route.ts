// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';

const generateChatReply = (message: string, characterName: string, persona: string, history: any[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT || '',
        username: process.env.SNOWFLAKE_USERNAME || '',
        password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(err);

      const systemPrompt = `You are ${characterName}. Your persona is: ${persona}. 
      You are talking to a time traveler. Keep your responses short (1-2 sentences), in character, and react to what they say. Do NOT use JSON. Just reply with plain dialogue.`;

      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      history.forEach(msg => {
        messages.push({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.text
        });
      });

      messages.push({ role: 'user', content: message });

      // Create clean JSON without hacky string replacements
      const messagesJson = JSON.stringify(messages);

      // Use Snowflake's $$ syntax to safely wrap the raw JSON string
      const sqlText = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-8b', 
            PARSE_JSON($$${messagesJson}$$),
            {'temperature': 0.7}
        ) as AI_RESPONSE;
      `;

      connection.execute({
        sqlText,
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          if (!rows || rows.length === 0) return reject("No data");
          
          try {
             let reply = rows[0].AI_RESPONSE;
             if (typeof reply !== 'string' && reply?.choices) {
                 reply = reply.choices[0].messages || reply.choices[0].message.content;
             }
             resolve(reply.replace(/"/g, '').trim());
          } catch (e) {
             resolve("*glitches* I... I cannot hear you clearly across the timeline.");
          }
        }
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reply = await generateChatReply(body.message, body.characterName, body.persona, body.history || []);
    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    console.error("[Chat Error]:", error);
    return NextResponse.json({ error: "Failed to generate chat" }, { status: 500 });
  }
}