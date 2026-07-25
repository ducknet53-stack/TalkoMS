import express from 'express';
import { createServer as createViteServer } from 'vite';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;

    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      const contents = (history || []).map((msg: any) => ({
        role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text || '' }]
      }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: "Sen Talko AI'sın. Talko'nun resmi yapay zeka asistanısın. Kullanıcıların sorularını yanıtlarsın. Kullanıcılara yardım et ve nazik ol."
        }
      });

      for await (const chunk of responseStream) {
        const content = chunk.text;
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (githubToken) {
      const ai = new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: githubToken,
      });

      const formattedHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await ai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Sen Talko AI'sın. Talko'nun resmi yapay zeka asistanısın. Kullanıcıların sorularını yanıtlarsın. Kullanıcılara yardım et ve nazik ol."
          },
          ...formattedHistory,
          { role: "user", content: message }
        ],
        stream: true,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    throw new Error("Ne GEMINI_API_KEY ne de GITHUB_TOKEN ayarlanmış.");
  } catch (err: any) {
    console.error('AI error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
