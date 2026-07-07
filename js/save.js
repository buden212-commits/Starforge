const SAVE_KEY = "starforge_save_v2";

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem("starforge_save_v1");
      if (legacy) return { ...JSON.parse(legacy), twinBeeMode: false };
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function createDefaultSave(defaults) {
  return {
    build: { ...defaults.DEFAULT_BUILD },
    inventory: JSON.parse(JSON.stringify(defaults.DEFAULT_INVENTORY)),
    affixes: {},
    runs: 0,
    kills: 0,
    bosses: 0,
    twinBeeMode: false,
  };
}

export function getOrCreateSave(defaults) {
  const existing = loadSave();
  if (existing) {
    if (existing.twinBeeMode === undefined) existing.twinBeeMode = false;
    return existing;
  }
  const fresh = createDefaultSave(defaults);
  writeSave(fresh);
  return fresh;
}
