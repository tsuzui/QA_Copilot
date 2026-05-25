import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Agent, setGlobalDispatcher } from "undici";

// Configure undici global dispatcher to prevent HeadersTimeoutError
const globalAgent = new Agent({
  connect: {
    timeout: 300000, // 5 minutes
  },
  headersTimeout: 300000, // 5 minutes
  bodyTimeout: 300000, // 5 minutes
});
setGlobalDispatcher(globalAgent);

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
      timeout: 300000, // 5 minutes
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
    const fallbackModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    // Create a unique queue starting with the requested/detected model
    let modelQueue = Array.from(new Set([initialModel, ...fallbackModels]));
    
    const executeGeneration = async (modelName: string) => {
      const { contents, modelConfig, systemInstruction } = req.body;
      
      // Separate model and other non-config parameters from modelConfig
      // to avoid passing "model" inside the nested config object (which causes strict type errors)
      const { model, ...cleanConfig } = modelConfig || {};
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1, // Faster and more deterministic output for perfect JSON structure matching
          ...cleanConfig
        }
      });
      return response;
    };

    while (attempt < maxRetries) {
      if (modelQueue.length === 0) {
        console.error("No models remaining in the model queue.");
        break;
      }
      const currentModel = modelQueue[attempt % modelQueue.length];
      try {
        const response = await executeGeneration(currentModel);
        const text = response.text;
        
        if (!text) {
          throw new Error("AI returned empty or null text response");
        }

        let cleanedText = text.trim();
        // Automatically strip Markdown backticks code blocks on the server side
        if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n?/, "");
          cleanedText = cleanedText.replace(/\n?```$/, "");
        }
        cleanedText = cleanedText.trim();

        return res.json({ text: cleanedText });
      } catch (error: any) {
        attempt++;
        const errMsg = (error.message || "").toString();
        const isQuotaExceeded = 
          errMsg.includes("Quota exceeded") || 
          errMsg.includes("quota exceeded") || 
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("You exceeded your current quota") ||
          errMsg.includes("daily limit") ||
          error.status === 429;
        
        if (isQuotaExceeded) {
          console.log(`Model ${currentModel} hit a rate/quota limit. Removing from queue to stop wasting retry attempts.`);
          modelQueue = modelQueue.filter(m => m !== currentModel);
        }

        const isRetryable = 
          error.message?.includes("503") || 
          error.status === 503 || 
          error.message?.includes("500") || 
          error.status === 500 || 
          error.message?.includes("429") || 
          error.status === 429 || 
          error.message?.includes("overloaded") || 
          error.message?.includes("high demand") ||
          error.message?.includes("quota") || 
          error.message?.includes("RESOURCE_EXHAUSTED") ||
          error.message?.includes("UNAVAILABLE") ||
          error.message?.includes("INTERNAL") ||
          error.message?.includes("empty") || // Retry on empty responses
          error.message?.includes("null") ||
          isQuotaExceeded;
        
        if (isRetryable && attempt < maxRetries && modelQueue.length > 0) {
          // Faster, tighter retry timing for instant fallback with minimal jitter (500-1000ms instead of seconds)
          const delay = 500 + Math.random() * 500;
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
