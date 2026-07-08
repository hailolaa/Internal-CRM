import { config } from "../config/index.js";
import logger from "../utils/logger.js";

export interface CallTranscriptionInput {
  contactName: string;
  direction: string;
  duration: number;
  notes: string;
  outcome: string | null;
  recordingUrl: string;
}

export interface CallTranscriptionGeneration {
  fallbackReason: string | null;
  model: string | null;
  provider: "deterministic" | "openai";
  transcript: string;
}

interface TranscriptionResponsePayload {
  text?: string;
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fallbackTranscript(input: CallTranscriptionInput) {
  const context = [
    `${input.contactName} ${input.direction} call`,
    `${Math.round(input.duration / 60)} minute duration`,
    `outcome ${input.outcome || "not set"}`,
    input.notes ? `notes: ${input.notes}` : "",
  ].filter(Boolean);

  return `Transcript unavailable. Generated from call metadata: ${context.join("; ")}.`;
}

function filenameFromUrl(recordingUrl: string) {
  try {
    const pathname = new URL(recordingUrl).pathname;
    const filename = pathname.split("/").filter(Boolean).pop();
    if (filename && /\.[a-z0-9]+$/i.test(filename)) return filename;
  } catch {
    // Ignore malformed URL parsing here; the fetch path will report the real issue.
  }

  return "call-recording.mp3";
}

function withTwilioDownloadFormat(recordingUrl: string) {
  if (!recordingUrl.includes("api.twilio.com") || /\.[a-z0-9]+($|\?)/i.test(recordingUrl)) {
    return recordingUrl;
  }

  return `${recordingUrl}.mp3`;
}

function twilioAuthHeader(recordingUrl: string) {
  if (!recordingUrl.includes("api.twilio.com")) return null;
  if (!config.twilio.accountSid || !config.twilio.authToken) return null;

  return `Basic ${Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64")}`;
}

export class OpenAICallTranscriptionService {
  async transcribe(input: CallTranscriptionInput): Promise<CallTranscriptionGeneration> {
    const deterministicTranscript = fallbackTranscript(input);

    if (!config.openai.callTranscriptionEnabled) {
      return this.fallback(deterministicTranscript, "disabled");
    }

    if (!config.openai.apiKey) {
      return this.fallback(deterministicTranscript, "missing_api_key");
    }

    try {
      const recording = await this.downloadRecording(input.recordingUrl);
      const formData = new FormData();
      formData.append("model", config.openai.callTranscriptionModel);
      formData.append(
        "file",
        new Blob([recording.bytes], { type: recording.contentType }),
        filenameFromUrl(recording.url),
      );

      const response = await fetch(config.openai.transcriptionApiUrl, {
        method: "POST",
        signal: AbortSignal.timeout(config.openai.timeoutMs),
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: formData,
      });

      const body = await response.text();
      let payload: TranscriptionResponsePayload | { error?: unknown } | undefined;

      try {
        payload = body ? JSON.parse(body) : undefined;
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        logger.warn("OpenAI call transcription failed", {
          response: payload || body,
          status: response.status,
        });
        return this.fallback(deterministicTranscript, `http_${response.status}`);
      }

      const transcript = compact((payload as TranscriptionResponsePayload | undefined)?.text || "");
      if (!transcript) {
        logger.warn("OpenAI call transcription returned empty transcript");
        return this.fallback(deterministicTranscript, "empty_response");
      }

      return {
        fallbackReason: null,
        model: config.openai.callTranscriptionModel,
        provider: "openai",
        transcript,
      };
    } catch (error) {
      logger.warn("OpenAI call transcription threw", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback(deterministicTranscript, "request_failed");
    }
  }

  private async downloadRecording(recordingUrl: string) {
    const url = withTwilioDownloadFormat(recordingUrl);
    const authHeader = twilioAuthHeader(recordingUrl);
    const requestInit: RequestInit = {
      signal: AbortSignal.timeout(config.openai.timeoutMs),
    };
    if (authHeader) {
      requestInit.headers = { Authorization: authHeader };
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      throw new Error(`Recording download failed with status ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    return {
      bytes,
      contentType: response.headers.get("content-type") || "audio/mpeg",
      url,
    };
  }

  private fallback(transcript: string, reason: string | null): CallTranscriptionGeneration {
    return {
      fallbackReason: reason,
      model: null,
      provider: "deterministic",
      transcript,
    };
  }
}

export const openAICallTranscriptionService = new OpenAICallTranscriptionService();
