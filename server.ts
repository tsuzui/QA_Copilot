import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for JSON
  app.use(express.json({ limit: '50mb' }));

  // Gemini API Integration
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API routes
  app.post("/api/generate", async (req, res) => {
    const maxRetries = 5;
    let attempt = 0;
    const initialModel = req.body.modelConfig?.model || "gemini-3.5-flash";
    const fallbackModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
    // Create a unique queue starting with the requested/detected model
    const modelQueue = Array.from(new Set([initialModel, ...fallbackModels]));
    
    const executeGeneration = async (modelName: string) => {
      const { contents, modelConfig, systemInstruction } = req.body;
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          ...modelConfig
        }
      });
      return response;
    };

    while (attempt < maxRetries) {
      const currentModel = modelQueue[attempt % modelQueue.length];
      try {
        const response = await executeGeneration(currentModel);
        return res.json({ text: response.text });
      } catch (error: any) {
        attempt++;
        const isRetryable = 
          error.message?.includes("503") || 
          error.status === 503 || 
          error.message?.includes("500") || 
          error.status === 500 || 
          error.message?.includes("overloaded") || 
          error.message?.includes("high demand") ||
          error.message?.includes("UNAVAILABLE") ||
          error.message?.includes("INTERNAL");
        
        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          const nextModel = modelQueue[attempt % modelQueue.length];
          console.log(`Gemini API Retryable Error (${error.status || 'unknown'}) on ${currentModel}: "${error.message}". Retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries}) switching to model ${nextModel}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error("Gemini API Error after retries:", error);
        return res.status(error.status || 500).json({ 
          error: error.message,
          status: error.status || 500
        });
      }
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React Router (though we might only have one page)
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
