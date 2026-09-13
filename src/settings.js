export const SETTINGS_KEY = "china-miner-settings-v1";
export function loadSettings(storage) {
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) || "{}");
    return {
      hardcore: raw?.hardcore === true,
      reducedMotion: raw?.reducedMotion === true,
    };
  } catch {
    return { hardcore: false, reducedMotion: false };
  }
}
export function saveSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
