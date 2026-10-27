// Inngest background functions for AgentFlow Studio.
import { writeEpisode } from "./functions/write-episode";
import { generateImage } from "./functions/generate-image";

export const functions = [writeEpisode, generateImage];
