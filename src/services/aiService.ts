import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function matchJobsWithSeeker(jobs: Job[], seeker: UserProfile) {
  if (!seeker.skills || seeker.skills.length === 0) return jobs;

  const prompt = `
    Analyze the following job vacancies and a job seeker's profile.
    Sort and rank the jobs based on how well they match the seeker's skills and location preference.
    Return a score (0 to 100) and a brief reason for the match for each job.

    Seeker Profile:
    - Name: ${seeker.name}
    - Skills: ${seeker.skills.join(", ")}
    - Bio: ${seeker.bio || "No bio provided"}
    - Location: ${seeker.location || "Anywhere"}

    Jobs:
    ${jobs.map((job, index) => `
    Job ${index}:
    - Title: ${job.title}
    - Description: ${job.description}
    - Required Skills: ${job.skills.join(", ")}
    - Location: ${job.location.microdistrict}, ${job.location.city}
    `).join("\n")}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jobIndex: { type: Type.INTEGER },
              score: { type: Type.INTEGER },
              reason: { type: Type.STRING }
            },
            required: ["jobIndex", "score", "reason"]
          }
        }
      }
    });

    const matches = JSON.parse(response.text || "[]");
    return matches.map((match: any) => ({
      ...jobs[match.jobIndex],
      aiScore: match.score,
      aiReason: match.reason
    })).sort((a: any, b: any) => b.aiScore - a.aiScore);
  } catch (error) {
    console.error("AI Choice failed:", error);
    return jobs;
  }
}
