import type { Emotion, Impact, JSONValue, Memory } from "./types.js";

const createSearchParams = <
  Params extends Record<string, number | string | string[]>,
>(
  params: Params,
) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number") {
      query.append(key, value.toString());
    } else if (Array.isArray(value)) {
      value.forEach((valueInner) => query.append(key, valueInner));
    }
  });
  return query;
};

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

export type CreatePlaythroughTokenResult = {
  /**
   * The playthrough token, used for connecting to this playthrough. It never expires,
   * so can be saved in a secure place for players to continue playing between sessions.
   *
   * To create a playthrough with the token, use `new Playthrough(token)`.
   */
  token: string;
  /**
   * The unique identifier of the playthrough, encoded inside the token. It can be useful
   * as a debugging tool.
   */
  playthroughUuid: string;
};

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
    const result = await fetchHelper<{
      token: string;
      playthroughUuid: string;
    }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/token`, {
      body: JSON.stringify({
        storyId: options.storyId,
        version: options.version,
        languageCode: options.languageCode,
      }),
      headers: authHeader ? { Authorization: authHeader } : undefined,
      method: "POST",
    });
    return result;
  } catch (err) {
    throw new Error(`A playthrough token could not be generated: ${err}`);
  }
}

export type CreateConversationResult = {
  /**
   * The unique identifier of the created conversation. Pass this into `playthrough.joinConversation`
   * to get a scoped `Conversation` instance.
   */
  conversationUuid: string;
};

export async function createConversation(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<CreateConversationResult> {
  const result = await fetchHelper<{
    conversationUuid: string;
  }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/conversation`, {
    body: JSON.stringify({}),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return result;
}

export type CreateCharacterConversationResult = {
  /**
   * The unique identifier of the created conversation. Pass this into `playthrough.joinConversation`
   * to get a scoped `Conversation` instance.
   */
  conversationUuid: string;
};

export async function createCharacterConversation(
  token: string,
  characterId: number,
  apiOptions?: CommonApiOptions,
): Promise<CreateCharacterConversationResult> {
  const result = await fetchHelper<{
    conversationUuid: string;
  }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/conversation/character`, {
    body: JSON.stringify({ characterId }),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return result;
}

export type EventType =
  | "start"
  | "message_player"
  | "message_character"
  | "set_mood"
  | "resume"
  | "set_memory"
  | "tap"
  | "restart"
  | "episode_complete"
  | "fork";

export type Event = {
  id: string;
  type: EventType;
  timestamp: string;
  conversationUuid: string | null;
  playthroughUuid: string;
  payload: unknown;
};

export type GetEventHistoryOptions = {
  conversationUuid?: string;
  eventTypes?: EventType[];
  minEventId?: string;
  maxEventId?: string;
  limit: number;
  sort?: "asc" | "desc";
};

export type GetEventHistoryResult = {
  events: Event[];
};

/**
 * Gets the events that have happened in the playthrough, such as character and player messages amongst others. The returned events can be filtered by using options.
 */
export async function getEventHistory(
  token: string,
  // eslint-disable-next-line default-param-last
  options: GetEventHistoryOptions = { limit: 1000 },
  apiOptions?: CommonApiOptions,
): Promise<GetEventHistoryResult> {
  const query = createSearchParams(options);
  const result = await fetchHelper<GetEventHistoryResult>(
    `${
      apiOptions?.baseUrl || globalBaseUrl
    }/play/event-history?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

export type GetPlaythroughInfoResult = {
  emotions: Emotion[];
  memories: Memory[];
  impacts: Impact[];
};

/**
 * Returns current information about the playthrough, such as character emotions and memories.
 */
export async function getPlaythroughInfo(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<GetPlaythroughInfoResult> {
  const result = await fetchHelper<GetPlaythroughInfoResult>(
    `${
      apiOptions?.baseUrl || globalBaseUrl
    }/play/playthrough-info?use_typed_memories=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return result;
}

export type MemoryToSet = { recallValue: string; saveValue: JSONValue | null };

/**
 * Directly sets a memory in Charisma. The promise resolves when the memory has been committed so is guaranteed to be set, but it may take a short amount of time (usually < 1s) for the updated value to propagate to any active playthrough instances.
 *
 * It is highly recommended to call `setMemory` with an array instead of calling `setMemory` multiple times, to only cause one refetch of the current memory values in the chat engine.
 */
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
        saveValue: saveValueOrApiOptions as JSONValue | null,
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
  /**
   * The playthrough token, used for connecting to this playthrough. It never expires,
   * so can be saved in a secure place for players to continue playing between sessions.
   *
   * To create a playthrough with the token, use `new Playthrough(token)`.
   */
  token: string;
  /**
   * The unique identifier of the playthrough, encoded inside the token. It can be useful
   * as a debugging tool.
   */
  playthroughUuid: string;
};

/**
 * Creates a clone of the playthrough, including memories and emotions, and returns a new playthrough linked to the latest promoted story version.
 *
 * This is useful when you've published a new story version. Since playthroughs are bound to a particular story version, you need to "fork" the playthrough in order to move a player over to the newly published version.
 */
export async function forkPlaythroughToken(
  token: string,
  apiOptions?: CommonApiOptions,
): Promise<ForkPlaythroughTokenResult> {
  const result = await fetchHelper<{
    token: string;
    playthroughUuid: string;
  }>(`${apiOptions?.baseUrl || globalBaseUrl}/play/fork-playthrough`, {
    body: JSON.stringify({}),
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  return result;
}

export type ResetPlaythroughOptions = {
  /**
   * The event ID to reset the playthrough to.
   */
  eventId: string;
};

/**
 * Resets a playthrough's state to a particular event ID. If this playthrough has been forked, the event ID can be from any of this playthrough's ancestors. This resets memories and emotions **ONLY**.
 */
export async function resetPlaythrough(
  token: string,
  options: ResetPlaythroughOptions,
  apiOptions?: CommonApiOptions,
): Promise<void> {
  await fetchHelper<void>(
    `${apiOptions?.baseUrl || globalBaseUrl}/play/reset-playthrough`,
    {
      body: JSON.stringify(options),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}
