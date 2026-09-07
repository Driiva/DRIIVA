/**
 * AI routes: the per-trip driving coach and the general ask endpoint.
 * Extracted verbatim from server/routes.ts. Both are requireAuth; the coach is
 * additionally behind coachLimiter (5 req/min per user, distributed-safe —
 * see server/middleware/security.ts).
 */
import type { Express } from "express";
import { coachLimiter } from "../middleware/security";
import { requireAuth, type AuthRequest } from "../middleware/auth";

/** The slice of the Anthropic messages response the coach reads. */
interface AnthropicMessagesResponse {
  content?: Array<{ text?: string }>;
}

/** The slice of the Perplexity chat-completions response the coach reads. */
interface PerplexityChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * The slice /api/ask reads. Required rather than optional because the handler
 * indexes straight into it: a malformed response throws inside the try and is
 * answered as a 500, which is the behaviour this endpoint has always had.
 */
interface PerplexityAskResponse {
  choices: Array<{ message: { content: string } }>;
  citations?: unknown[];
}

export function registerAiRoutes(app: Express): void {
  // Perplexity AI endpoint (protected)
  // -------------------------------------------------------------------------
  // AI Driiva — structured driving feedback per trip
  // -------------------------------------------------------------------------

  // coachLimiter: 5 req/min per user, distributed-safe (see middleware/security.ts)
  app.post("/api/ai/coach", requireAuth, coachLimiter, async (req: AuthRequest, res) => {
    try {
      const {
        score,
        scoreBreakdown,
        events,
        distanceMeters,
        durationSeconds,
        context,
        averageScore,
        totalTrips,
      } = req.body;

      if (score == null || !scoreBreakdown) {
        return res.status(400).json({ message: "Missing required trip score data" });
      }

      const distanceMiles = ((distanceMeters ?? 0) / 1609.34).toFixed(1);
      const durationMins = Math.round((durationSeconds ?? 0) / 60);

      const userPrompt = [
        `Trip data:`,
        `  Overall score: ${score}/100`,
        `  Speed score: ${scoreBreakdown.speedScore}, Braking: ${scoreBreakdown.brakingScore}, Acceleration: ${scoreBreakdown.accelerationScore}, Cornering: ${scoreBreakdown.corneringScore}, Phone: ${scoreBreakdown.phoneUsageScore}`,
        `  Hard braking events: ${events?.hardBrakingCount ?? 0}, Hard acceleration: ${events?.hardAccelerationCount ?? 0}, Speeding: ${events?.speedingSeconds ?? 0}s, Sharp turns: ${events?.sharpTurnCount ?? 0}`,
        `  Distance: ${distanceMiles} miles, Duration: ${durationMins} minutes`,
        context?.isNightDriving ? '  Night driving: yes' : '',
        context?.isRushHour ? '  Rush hour: yes' : '',
        context?.weatherCondition ? `  Weather: ${context.weatherCondition}` : '',
        averageScore != null ? `  Driver average score: ${averageScore}` : '',
        totalTrips != null ? `  Total trips recorded: ${totalTrips}` : '',
      ].filter(Boolean).join('\n');

      const systemPrompt =
        "You are Driiva's AI Driving Coach. Analyse the driving trip data and respond with ONLY valid JSON (no markdown, no backticks) in this exact shape: " +
        '{"headline":"<one sentence insight>","tips":["<tip1>","<tip2>","<tip3 optional>"],"encouragement":"<one encouraging sentence about strengths>"}. ' +
        "Tips should be specific, actionable, and based on the weakest scores. Be concise, warm, data-specific. Use UK English.";

      const provider = process.env.AI_COACH_PROVIDER ?? 'perplexity';
      const apiKey = process.env.AI_COACH_API_KEY ?? process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        return res.status(503).json({ message: "AI Driiva is not configured" });
      }

      let result: { headline: string; tips: string[]; encouragement: string };

      if (provider === 'anthropic') {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (!anthropicRes.ok) {
          const err = await anthropicRes.text();
          throw new Error(`Anthropic API error: ${anthropicRes.status} — ${err}`);
        }
        const anthropicData = await anthropicRes.json() as AnthropicMessagesResponse;
        const text = anthropicData.content?.[0]?.text ?? '{}';
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error("AI provider returned non-JSON response");
        }
      } else {
        const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            stream: false,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            return_images: false,
            return_related_questions: false,
          }),
        });
        if (!perplexityRes.ok) {
          const err = await perplexityRes.text();
          throw new Error(`Perplexity API error: ${perplexityRes.status} — ${err}`);
        }
        const perplexityData = await perplexityRes.json() as PerplexityChatResponse;
        const raw = perplexityData.choices?.[0]?.message?.content ?? '{}';
        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error("AI provider returned non-JSON response");
        }
      }

      if (!result.headline || !Array.isArray(result.tips) || !result.encouragement) {
        throw new Error("Invalid response shape from AI provider");
      }

      res.json(result);
    } catch (error) {
      console.error("[AI Driiva] Error:", error);
      res.status(500).json({ message: "AI Coach error" });
    }
  });

  // -------------------------------------------------------------------------
  // General AI ask endpoint
  // -------------------------------------------------------------------------

  app.post("/api/ask", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar-pro",
          stream: false,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          return_images: false,
          return_related_questions: false
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Perplexity API error:", response.status, errorData);
        throw new Error(`Perplexity API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as PerplexityAskResponse;
      
      res.json({
        answer: data.choices[0].message.content,
        citations: data.citations || []
      });
    } catch (error) {
      console.error("AI backend error:", error);
      res.status(500).json({ message: "AI backend error" });
    }
  });
}
