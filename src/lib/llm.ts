import OpenAI from "openai";

export const llm = new OpenAI({
  apiKey: process.env.UPSTAGE_API_KEY!,
  baseURL: process.env.UPSTAGE_BASE_URL!, // https://api.upstage.ai/v1
});
