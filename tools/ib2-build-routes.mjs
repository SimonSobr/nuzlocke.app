import fs from "node:fs/promises";
import vm from "node:vm";

const URL_GROUPS =
  "https://raw.githubusercontent.com/FrostFalcon/NCB2/main/Pages/Encounters.js";
const URL_POOLS =
  "https://raw.githubusercontent.com/FrostFalcon/NCB2/main/Data/EncounterPools.js";

function slugifySpecies(name) {
  let s = name.trim();

  // Collapse forms like "Minior (2)" -> "Minior"
  s = s.replace(/\s*\([^)]*\)\s*/g, "");

  // Common tracker slug special cases
  const special = {
    "Mr. Mime": "mr-mime",
    "Mime Jr.": "mime-jr",
    "Farfetch'd": "farfetchd",
    "Sirfetch'd": "sirfetchd",
    "Nidoran♀": "nidoran-f",
    "Nidoran♂": "nidoran-m",
    "Porygon-Z": "porygon-z",
    "Ho-Oh": "ho-oh",
    "Type: Null": "type-null",
    "Jangmo-o": "jangmo-o",
    "Hakamo-o": "hakamo-o",
    "Kommo-o": "kommo-o",
    "Tapu Koko": "tapu-koko",
    "Tapu Lele": "tapu-lele",
    "Tapu Bulu": "tapu-bulu",
    "Tapu Fini": "tapu-fini",
    "Mr. Rime": "mr-rime",
  };
  if (special[s]) return special[s];

  return s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function uniqueEncounterList(poolData) {
  const seen = new Set();
  const out = [];

  // Seasons on the site are numeric keys 0..3
  for (const seasonKey of Object.keys(poolData)) {
    const seasonPools = poolData[seasonKey];
    if (!Array.isArray(seasonPools)) continue;

    for (const encounterMethod of seasonPools) {
      // Structure is like ["Land", "Sneasel", 0.2, "Lunatone", 0.2, ...]
      for (let i = 1; i < encounterMethod.length; i += 2) {
        const rawName = encounterMethod[i];
        if (typeof rawName !== "string") continue;

        const slug = slugifySpecies(rawName);
        if (!seen.has(slug)) {
          seen.add(slug);
          out.push(slug);
        }
      }
    }
  }

  return out;
}

function makeCheckpoint(name, value, group, boss) {
  return { type: "gym", name, value, group, boss };
}

const groupsSrc = await fetch(URL_GROUPS).then((r) => r.text());
const poolsSrc = await fetch(URL_POOLS).then((r) => r.text());

const groupSandbox = {};
vm.runInNewContext(`${groupsSrc}; globalThis.__groups = groups;`, groupSandbox);

const poolSandbox = {};
vm.runInNewContext(`${poolsSrc}; globalThis.__pools = encounterPools;`, poolSandbox);

const groups = groupSandbox.__groups;
const encounterPools = poolSandbox.__pools;

// Backbone from the site
const gymOrder = [
  ["First Gym", "1"],
  ["Second Gym", "2"],
  ["Third Gym", "3"],
  ["Fourth Gym", "4"],
  ["Fifth Gym", "5"],
  ["Sixth Gym", "6"],
  ["Seventh Gym", "7"],
  ["Eighth Gym", "8"],
  ["Elite Four", "e4"],
];

const routes = [];

// Optional starter row — delete this if you don't want it
routes.push({
  type: "route",
  name: "Starter",
  encounters: ["snivy", "tepig", "oshawott"],
});

for (const [groupName, bossId] of gymOrder) {
  for (const area of groups[groupName]) {
    const pool = encounterPools[area];
    routes.push({
      type: "route",
      name: area,
      encounters: pool ? uniqueEncounterList(pool) : [],
    });
  }

  if (groupName === "Elite Four") {
    routes.push(
      makeCheckpoint("Pokémon League", "e1", "elite-four", "Elite Four"),
      makeCheckpoint("Pokémon Champion", "c", "elite-four", "Champion")
    );
  } else {
    routes.push(
      makeCheckpoint(groupName, bossId, "gym-leader", groupName)
    );
  }
}

await fs.writeFile(
  "ib2.routes.generated.json",
  JSON.stringify(routes, null, 2),
  "utf8"
);

console.log("Wrote ib2.routes.generated.json");