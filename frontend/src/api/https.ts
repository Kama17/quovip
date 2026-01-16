const BASE_URL = `https://${import.meta.env.VITE_BACKEND_URL}`;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method: HttpMethod;
  token?: string;
  body?: BodyInit;
  json?: unknown;
}

async function request<T = any>(
  endpoint: string,
  { method, token, body, json }: RequestOptions
): Promise<T> {
  const headers: HeadersInit = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.detail || data?.message || res.statusText);
  }

  return data as T;
}

export const https = {
  /* ---------------- INVITE USER ---------------- */
  inviteUserToChat(chatId: string, telegramUserId: string, token: string) {
    return request('/api/chats/send-invitation', {
      method: 'POST',
      token,
      json: {
        chat_id: chatId,
        telegram_user_id: telegramUserId,
      },
    });
  },

  /* ---------------- REMOVE USER ---------------- */
  removeUserFromChat(chatId: string, telegramUserId: string, token: string) {
    return request('/api/chats/remove-user', {
      method: 'POST',
      token,
      json: {
        chat_id: chatId,
        telegram_user_id: telegramUserId,
      },
    });
  },

  /* ---------------- BROADCAST MESSAGE ---------------- */
  broadcastMessage(formData: FormData, token: string) {
    return request('/api/chats/broadcast-message', {
      method: 'POST',
      token,
      body: formData, // FormData → no content-type
    });
  },
};
