import fetch from "isomorphic-unfetch";
import querystring from "query-string";

import { Message, Mood } from "./types";

const fetchHelper = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  // Always default to `Accept: application/json`
  let headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (
    typeof options.method === "string" &&
    options.method.toLowerCase() === "post"
  ) {
    // If it's a POST method, default to `Content-Type: application/json` for the body
    headers = { "Content-Type": "application/json", ...headers };
  }

  const response = await fetch(endpoint, { mode: "cors", ...options, headers });

  let data: unknown = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    data = await response.json();
  } catch (err) {
    // Some endpoints just return a status code and no JSON body data.
  }

  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ||
        `Something went wrong calling \`${endpoint}\``,
    );
  }

  return data as T;
};

let baseUrl = "https://api.charisma.ai";

export const getBaseUrl = (): string => baseUrl;

export const setBaseUrl = (newBaseUrl: string): void => {
  baseUrl = newBaseUrl;
};

export interface CreatePlaythroughTokenOptions {
  /**
   * The `id` of the story that you want to create a new playthrough for. The story must be published, unless a Charisma.ai user token has been passed and the user matches the owner of the story.
   */
  storyId: number;
  /**
   * The `version` of the story that you want to create a new playthrough for. If omitted, it will default to the most recent published version. To get the draft version of a story, pass `-1` and a `userToken`.
   */
  version?: number;
  /**
   * If the story is unpublished, pass a `userToken` to be able to access your story.
   */
  userToken?: string;
}

export type CreatePlaythroughTokenResult = string;

export async function createPlaythroughToken(
  options: CreatePlaythroughTokenOptions,
): Promise<CreatePlaythroughTokenResult> {
  if (options.version === -1 && options.userToken === undefined) {
    throw new Error(
      "To play the draft version (-1) of a story, a `userToken` must also be passed.",
    );
  }
  try {
    const { token } = await fetchHelper<{ token: string }>(
      `${baseUrl}/play/token`,
      {
        body: JSON.stringify({
          storyId: options.storyId,
          version: options.version,
        }),
        headers:
          options.userToken !== undefined
            ? { Authorization: `Bearer ${options.userToken}` }
            : undefined,
        method: "POST",
      },
    );
    return token;
  } catch (err) {
    throw new Error(`A playthrough token could not be generated: ${err}`);
  }
}

export async function createConversation(token: string): Promise<number> {
  const { conversationId } = await fetchHelper<{
    conversationId: number;
  }>(`${baseUrl}/play/conversation`, {
    body: JSON.stringify({}),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return conversationId;
}

export async function createCharacterConversation(
  token: string,
  characterId: number,
): Promise<number> {
  const { conversationId } = await fetchHelper<{
    conversationId: number;
  }>(`${baseUrl}/play/conversation/character`, {
    body: JSON.stringify({ characterId }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return conversationId;
}

export interface GetMessageHistoryResult {
  messages: Message[];
}

export async function getMessageHistory(
  token: string,
  conversationId?: number | undefined,
  minEventId?: string | undefined,
): Promise<GetMessageHistoryResult> {
  const query = querystring.stringify({ conversationId, minEventId });
  const result = await fetchHelper<GetMessageHistoryResult>(
    `${baseUrl}/play/message-history?${query}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

export interface GetPlaythroughInfoResult {
  characterMoods: {
    id: number;
    name: string;
    mood: Mood;
  }[];
  memories: {
    id: number;
    recallValue: string;
    saveValue: string | null;
  }[];
  impacts: {
    id: number;
    impact: string;
  }[];
}

export async function getPlaythroughInfo(
  token: string,
): Promise<GetPlaythroughInfoResult> {
  const result = await fetchHelper<GetPlaythroughInfoResult>(
    `${baseUrl}/play/playthrough-info`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

export interface SetMoodResult {
  characterId: number;
  mood: Mood;
}

export async function setMood(
  token: string,
  characterIdOrName: number | string,
  modifier: Partial<Mood>,
): Promise<SetMoodResult> {
  const result = await fetchHelper<SetMoodResult>(`${baseUrl}/play/set-mood`, {
    body: JSON.stringify({
      ...(typeof characterIdOrName === "number"
        ? { characterId: characterIdOrName }
        : { characterName: characterIdOrName }),
      modifier,
    }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return result;
}

export async function setMemory(
  token: string,
  memoryIdOrRecallValue: number | string,
  saveValue: string | null,
): Promise<void> {
  await fetchHelper<void>(`${baseUrl}/play/set-memory`, {
    body: JSON.stringify({
      ...(typeof memoryIdOrRecallValue === "number"
        ? { memoryId: memoryIdOrRecallValue }
        : { memoryRecallValue: memoryIdOrRecallValue }),
      saveValue,
    }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
}

export async function restartFromEpisodeId(
  token: string,
  episodeId: number,
): Promise<void> {
  await fetchHelper<void>(`${baseUrl}/play/restart-from-episode`, {
    body: JSON.stringify({ episodeId }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
}

export async function restartFromEpisodeIndex(
  token: string,
  episodeIndex: number,
): Promise<void> {
  await fetchHelper<void>(`${baseUrl}/play/restart-from-episode`, {
    body: JSON.stringify({ episodeIndex }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
}

export async function restartFromEventId(
  token: string,
  eventId: string,
): Promise<void> {
  await fetchHelper<void>(`${baseUrl}/play/restart-from-event`, {
    body: JSON.stringify({ eventId }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
}
