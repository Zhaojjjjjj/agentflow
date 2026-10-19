// Inngest background functions for AgentFlow Studio.
import { writeEpisode } from "./functions/write-episode";
import { generateCover } from "./functions/generate-cover";

export const functions = [writeEpisode, generateCover];
