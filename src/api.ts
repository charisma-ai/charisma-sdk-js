import fetch from "isomorphic-unfetch";
import querystring from "query-string";

import { Emotion, Impact, Memory, Message } from "./types";

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

let globalBaseUrl = "https://play.charisma.ai";

export const getGlobalBaseUrl = (): string => globalBaseUrl;

export const setGlobalBaseUrl = (newBaseUrl: string): void => {
  globalBaseUrl = newBaseUrl;
};

export type CommonApiOptions = {
  baseUrl?: string;
};

export type CreatePlaythroughTokenOptions = {
  /**
   * The `id` of the story that you want to create a new playthrough for. The story must be published, unless a Charisma.ai user token has been passed and the user matches the owner of the story.
   */
  storyId: number;
  /**
   * The `version` of the story that you want to create a new playthrough for. If omitted, it will default to the most recent published version. To get the draft version of a story, pass `-1` and an `apiKey`.
   */
  version?: number;
  /**
   * It is recommended to use the more secure `apiKey` instead of `userToken`. To access draft, test or unpublished versions of your story, pass a `userToken`.
   */
  userToken?: string;
  /**
   * To access draft, test or unpublished versions of your story, pass an `apiKey`. The API key can be found on the story overview page.
   */
  apiKey?: string;
  /**
   * To play a story in a language other than English (`en`, the default), pass a BCP-47 `languageCode`. For example, to play in Italian, use `it`.
   */
  languageCode?: string;
};

export type CreatePlaythroughTokenResult = string;

export async function createPlaythroughToken(
  options: CreatePlaythroughTokenOptions,
  apiOptions?: CommonApiOptions,
): Promise<CreatePlaythroughTokenResult> {
  if (
    options.version === -1 &&
    options.userToken === undefined &&
    options.apiKey === undefined
  ) {
    throw new Error(
      "To play the draft version (-1) of a story, an `apiKey` or `userToken` must also be passed.",
    );
  }

  let authHeader: string | undefined;
  if (options.apiKey) {
    authHeader = `API-Key ${options.apiKey}`;
  } else if (options.userToken) {
    authHeader = `Bearer ${options.userToken}`;
  }

  try {
    const { token } = await fetchHelper<{ token: string }>(
      `${apiOptions?.baseUrl || globalBaseUrl}/play/token`,
      {
        body: JSON.stringify({
          storyId: options.storyId,
          version: options.version,
          languageCode: options.languageCode,
        }),
        headers: authHeader ? { Authorization: authHeader } : undefined,
        method: "POST",
      },
    );
    return token;
  } catch (err) {
    throw new Error(`A playthrough token could not be generated: ${err}`);
  }
}

export async function createConversation(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<number> {
  const { conversationId } = await fetchHelper<{
    conversationId: number;
  }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/conversation`, {
    body: JSON.stringify({}),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return conversationId;
}

export async function createCharacterConversation(
  token: string,
  characterId: number,
  apiOptions?: CommonApiOptions,
): Promise<number> {
  const { conversationId } = await fetchHelper<{
    conversationId: number;
  }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/conversation/character`, {
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
  apiOptions?: CommonApiOptions,
): Promise<GetMessageHistoryResult> {
  const query = querystring.stringify({ conversationId, minEventId });
  const result = await fetchHelper<GetMessageHistoryResult>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/message-history?${query}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

export interface GetPlaythroughInfoResult {
  emotions: Emotion[];
  memories: Memory[];
  impacts: Impact[];
}

export async function getPlaythroughInfo(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<GetPlaythroughInfoResult> {
  const result = await fetchHelper<GetPlaythroughInfoResult>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/playthrough-info`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

// export interface SetMoodResult {
//   characterId: number;
//   mood: Mood;
// }

// export async function setMood(
//   token: string,
//   characterIdOrName: number | string,
//   modifier: Partial<Mood>,
//   apiOptions?: CommonApiOptions,
// ): Promise<SetMoodResult> {
//   const result = await fetchHelper<SetMoodResult>(
//     `${apiOptions?.baseUrl || globalBaseUrl}/play/set-mood`,
//     {
//       body: JSON.stringify({
//         ...(typeof characterIdOrName === "number"
//           ? { characterId: characterIdOrName }
//           : { characterName: characterIdOrName }),
//         modifier,
//       }),
//       headers: { Authorization: `Bearer ${token}` },
//       method: "POST",
//     },
//   );
//   return result;
// }

export type MemoryToSet = { recallValue: string; saveValue: string | null };

export async function setMemory(
  token: string,
  memoryRecallValue: string,
  saveValue: string | null,
  apiOptions?: CommonApiOptions,
): Promise<void>;
export async function setMemory(
  token: string,
  memoriesToSet: MemoryToSet[],
  apiOptions?: CommonApiOptions,
): Promise<void>;
export async function setMemory(
  token: string,
  memoryRecallValueOrMemories: string | MemoryToSet[],
  saveValueOrApiOptions?: string | null | CommonApiOptions,
  apiOptions?: CommonApiOptions,
): Promise<void> {
  let resolvedApiOptions = apiOptions;

  let memories: MemoryToSet[] = [];
  if (Array.isArray(memoryRecallValueOrMemories)) {
    memories = memoryRecallValueOrMemories;
    resolvedApiOptions = saveValueOrApiOptions as CommonApiOptions | undefined;
  } else {
    memories = [
      {
        recallValue: memoryRecallValueOrMemories,
        saveValue: saveValueOrApiOptions as string | null,
      },
    ];
  }

  await fetchHelper<void>(
    `${resolvedApiOptions?.baseUrl || globalBaseUrl}/play/set-memory`,
    {
      body: JSON.stringify({
        memories,
      }),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}

export async function restartFromEpisodeId(
  token: string,
  episodeId: number,
  apiOptions?: CommonApiOptions,
): Promise<void> {
  await fetchHelper<void>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/restart-from-episode`,
    {
      body: JSON.stringify({ episodeId }),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}

export async function restartFromEpisodeIndex(
  token: string,
  episodeIndex: number,
  apiOptions?: CommonApiOptions,
): Promise<void> {
  await fetchHelper<void>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/restart-from-episode`,
    {
      body: JSON.stringify({ episodeIndex }),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}

export async function restartFromEventId(
  token: string,
  eventId: string,
  apiOptions?: CommonApiOptions,
): Promise<void> {
  await fetchHelper<void>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/restart-from-event`,
    {
      body: JSON.stringify({ eventId }),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}

export type ForkPlaythroughTokenResult = {
  token: string;
  /** @deprecated */
  playthroughId: number;
  playthroughUuid: string;
};

export async function forkPlaythroughToken(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<ForkPlaythroughTokenResult> {
  const result = await fetchHelper<ForkPlaythroughTokenResult>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/fork-playthrough`,
    {
      body: JSON.stringify({}),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
  return result;
}
