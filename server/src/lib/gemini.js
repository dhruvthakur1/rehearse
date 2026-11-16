import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { AppError } from './errors.js';

let client;
let clientKey;

export const aiEnabled = () => Boolean(config.geminiApiKey);

function getClient() {
  if (!client || clientKey !== config.geminiApiKey) {
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
    clientKey = config.geminiApiKey;
  }
  return client;
}

// The main model gets a shorter budget so there is time left to fall back.
const PRIMARY_TIMEOUT_MS = 35_000;
const FALLBACK_TIMEOUT_MS = 30_000;

// Overloaded (503), rate-limited (429) or too slow: worth trying the lighter model.
const isTransient = (err) => [429, 500, 503, 'timeout'].includes(err?.status ?? err?.code);

async function callModel(ai, model, request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await ai.models.generateContent({
      ...request,
      model,
      config: { ...request.config, abortSignal: controller.signal },
    });
    return response.text;
  } catch (err) {
    if (controller.signal.aborted) throw Object.assign(new Error(`${model} timed out`), { status: 'timeout' });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Turns SDK/HTTP failures into messages a user can act on.
function toAppError(err, model) {
  if (err instanceof AppError) return err;
  const status = err?.status ?? err?.code;
  if (status === 'timeout') return new AppError(504, 'The AI took too long to respond. Please try again.');
  if (status === 429) return new AppError(429, 'The AI is getting a lot of requests right now. Wait a minute and try again.');
  if (status === 503 || status === 500) return new AppError(503, 'The AI service is busy right now. Please try again in a moment.');
  if (status === 404) {
    console.error(`Gemini model "${model}" is unavailable:`, err?.message);
    return new AppError(502, `The AI model "${model}" isn’t available for this API key. Set GEMINI_MODEL on the server to a current model.`);
  }
  if (status === 400 || status === 401 || status === 403) {
    console.error('Gemini rejected the request:', err?.message);
    return new AppError(502, 'The AI service rejected the request. Check the GEMINI_API_KEY on the server.');
  }
  console.error('Gemini request failed:', err);
  return new AppError(502, 'The AI service is unavailable right now. Please try again.');
}

// The main model first, then the lighter fallback (unless they're the same).
export const defaultModels = () => [config.geminiModel, config.geminiFallbackModel].filter((m, i, all) => m && all.indexOf(m) === i);

/**
 * Asks Gemini for JSON matching `schema`, then validates it with `parse` (which should
 * throw on bad output). Falls back to the next model when one is overloaded or slow, and
 * retries once on malformed output, because models occasionally return incomplete JSON.
 * `prompt` is either text or an array of content parts (e.g. audio plus instructions).
 */
export async function generateJson(
  {
    system,
    prompt,
    schema,
    parse,
    temperature = 0.8,
    models: modelNames = defaultModels(),
    timeouts = [PRIMARY_TIMEOUT_MS, FALLBACK_TIMEOUT_MS],
  },
  { client: injected } = {}
) {
  const ai = injected || getClient();
  const request = {
    contents: typeof prompt === 'string' ? prompt : [{ role: 'user', parts: prompt }],
    config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema: schema, temperature },
  };
  const models = modelNames.map((name, i) => ({ name, timeout: timeouts[Math.min(i, timeouts.length - 1)] }));

  let modelIndex = 0;
  let badOutputs = 0;
  let lastError;

  while (modelIndex < models.length) {
    const model = models[modelIndex];
    let text;
    try {
      text = await callModel(ai, model.name, request, model.timeout);
    } catch (err) {
      lastError = err;
      if (isTransient(err) && modelIndex < models.length - 1) {
        console.warn(`Gemini ${model.name} failed (${err.status ?? err.code}); falling back to ${models[modelIndex + 1].name}`);
        modelIndex++;
        continue;
      }
      throw toAppError(err, model.name);
    }

    try {
      return parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
      if (++badOutputs >= 2) break;
    }
  }

  console.error('Gemini returned unusable output:', lastError?.message);
  throw new AppError(502, 'The AI returned an unexpected answer. Please try again.');
}
