const TOKEN_KEY = "podbor.access_token";
const USER_KEY = "podbor.user";
const PROFILE_KEY = "podbor.profile";

const clearedListeners = new Set();

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Приватный режим или переполненное хранилище — демо продолжает работать без сохранения.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ничего не делаем: данные просто останутся до закрытия вкладки.
  }
}

export function getAccessToken() {
  return read(TOKEN_KEY);
}

export function setAccessToken(token) {
  write(TOKEN_KEY, token);
}

export function clearAccessToken() {
  remove(TOKEN_KEY);
  for (const listener of clearedListeners) listener();
}

export function onAccessTokenCleared(listener) {
  clearedListeners.add(listener);
  return () => clearedListeners.delete(listener);
}

export function getStoredUser() {
  return parseJson(read(USER_KEY));
}

export function setStoredUser(user) {
  write(USER_KEY, JSON.stringify(user));
}

export function getProfile() {
  return parseJson(read(PROFILE_KEY));
}

export function setProfile(profile) {
  write(PROFILE_KEY, JSON.stringify(profile));
}

export function resetSession() {
  remove(USER_KEY);
  remove(PROFILE_KEY);
  clearAccessToken();
}

export function hasSession() {
  return Boolean(getAccessToken());
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
