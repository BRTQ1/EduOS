import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Gun from "gun";
import { cn } from "./utils/cn";

type StudyMode = "two" | "three";
type DeckCategory =
  | "Matematyka"
  | "Jezyk polski"
  | "Fizyka"
  | "Chemia"
  | "Historia"
  | "Geografia"
  | "Jezyk angielski"
  | "Informatyka"
  | "Inne";
type AppId = "flashcards" | "tutor" | "calculator" | "notes" | "settings" | "progress" | "market" | "cloud" | "designer";
type ThemeId = "winBlue" | "mist" | "night";
type FontId = "inter" | "segoe" | "poppins" | "jetbrains";
type SystemLanguage = "pl" | "en";
type SkillLevel = "podstawowy" | "sredni" | "zaawansowany";
type CalcTab = "basic" | "expression" | "equation" | "geometry" | "log";
type GeometryShape = "kolo" | "trojkat" | "prostokat" | "trapez" | "prostopadloscian";

type Flashcard = { id: string; question: string; hint: string; answer: string };
type Deck = {
  id: string;
  title: string;
  source: "template" | "user";
  category: DeckCategory;
  preferredMode: StudyMode;
  cards: Flashcard[];
};
type TutorMessage = { id: string; role: "user" | "assistant"; content: string };
type WindowState = { id: AppId; z: number; minimized: boolean; maximized: boolean; x: number; y: number; w: number; h: number };
type UiSettings = { theme: ThemeId; font: FontId; language: SystemLanguage; compact: boolean; transparency: boolean; animations: boolean };
type Profile = {
  configured: boolean;
  displayName: string;
  classLevel: number;
  skillLevel: SkillLevel;
};
type DesktopIcon = { id: AppId; x: number; y: number };
type ProgressStats = {
  sessionsDone: number;
  masteredCards: number;
  totalUsageSeconds: number;
  appUsageSeconds: Partial<Record<AppId, number>>;
  appOpens: Partial<Record<AppId, number>>;
  tutorQuestions: number;
  notesSaved: number;
  notesDeleted: number;
  notesCreated: number;
  marketInstalls: number;
  cloudUploads: number;
  calcInteractions: number;
  streakDays: number;
  lastActiveDay: string;
};
type NoteDoc = { id: string; title: string; content: string; updatedAt: number };
type CloudFileRecord = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "text" | "image" | "video" | "audio" | "other";
  textContent?: string;
  dataUrl?: string;
  updatedAt: number;
};
type SketchShape = {
  id: string;
  type: "rect" | "circle" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
  label?: string;
};
type OnlineVaultPayload = {
  encrypted: string;
  iv: string;
  salt: string;
  updatedAt: number;
};

const OPENROUTER_FREE_MODEL = "openrouter/free";

const categoryOrder: DeckCategory[] = [
  "Matematyka",
  "Jezyk polski",
  "Fizyka",
  "Chemia",
  "Historia",
  "Geografia",
  "Jezyk angielski",
  "Informatyka",
  "Inne",
];

const templateDecksBase: Deck[] = [
  {
    id: "tpl-polish",
    title: "Jezyk polski - klasa 2 technikum",
    source: "template",
    category: "Jezyk polski",
    preferredMode: "three",
    cards: [
      { id: "pl-1", question: "Co to jest narracja pierwszoosobowa?", hint: "Narrator jest uczestnikiem.", answer: "Sposob opowiadania, gdzie narrator mowi jako ja." },
      { id: "pl-2", question: "Co to jest archaizm?", hint: "Wyraz dawny.", answer: "Wyraz lub forma charakterystyczna dla dawnej polszczyzny." },
      { id: "pl-3", question: "Co to jest motyw literacki?", hint: "Powtarzalny element tresci.", answer: "Powracajacy temat, obraz lub sytuacja w literaturze." },
      { id: "pl-4", question: "Funkcja impresywna jezyka", hint: "Wplywa na odbiorce.", answer: "Funkcja jezyka naklaniajaca odbiorce do reakcji." },
    ],
  },
  {
    id: "tpl-math",
    title: "Matematyka - funkcje i rownania",
    source: "template",
    category: "Matematyka",
    preferredMode: "three",
    cards: [
      { id: "ma-1", question: "Wzor funkcji liniowej", hint: "ax + b", answer: "f(x) = ax + b" },
      { id: "ma-2", question: "Kiedy funkcja liniowa jest rosnaca?", hint: "wspolczynnik a", answer: "Jest rosnaca, gdy a > 0." },
      { id: "ma-3", question: "Delta rownania kwadratowego", hint: "b2 - 4ac", answer: "Delta = b^2 - 4ac" },
      { id: "ma-4", question: "Miejsca zerowe trojmianu", hint: "zalezne od delty", answer: "x1,2 = (-b +- sqrt(delta)) / 2a" },
    ],
  },
  {
    id: "tpl-physics",
    title: "Fizyka - energia i moc",
    source: "template",
    category: "Fizyka",
    preferredMode: "three",
    cards: [
      { id: "ph-1", question: "Wzor na prace", hint: "sila razy droga", answer: "W = F * s" },
      { id: "ph-2", question: "Wzor na moc", hint: "praca przez czas", answer: "P = W / t" },
      { id: "ph-3", question: "Energia kinetyczna", hint: "1/2 m v2", answer: "Ek = m * v^2 / 2" },
      { id: "ph-4", question: "Zasada zachowania energii", hint: "w ukladzie izolowanym", answer: "Calkowita energia pozostaje stala." },
    ],
  },
];

const storage = {
  decks: "do-nauki-user-decks",
  removedTemplates: "do-nauki-removed-templates",
  tutorApiKey: "do-nauki-tutor-api-key",
  tutorSubject: "do-nauki-tutor-subject",
  tutorClass: "do-nauki-tutor-class",
  tutorStyle: "do-nauki-tutor-style",
  tutorGrade: "do-nauki-tutor-grade",
  tutorTokens: "do-nauki-tutor-tokens",
  tutorMessages: "do-nauki-tutor-messages",
  notes: "do-nauki-notes",
  profile: "do-nauki-profile",
  ui: "do-nauki-ui",
  windows: "do-nauki-windows",
  progress: "do-nauki-progress",
  desktopIcons: "do-nauki-desktop-icons",
  installedApps: "do-nauki-installed-apps",
  cloudFiles: "do-nauki-cloud-files",
  onlineVaultId: "do-nauki-online-vault-id",
  onlineSyncCode: "do-nauki-online-sync-code",
  designerState: "do-nauki-designer-state",
};

const defaultProfile: Profile = {
  configured: false,
  displayName: "Uczen",
  classLevel: 2,
  skillLevel: "sredni",
};

const defaultUi: UiSettings = { theme: "winBlue", font: "segoe", language: "pl", compact: false, transparency: true, animations: true };
const defaultProgress: ProgressStats = {
  sessionsDone: 0,
  masteredCards: 0,
  totalUsageSeconds: 0,
  appUsageSeconds: {},
  appOpens: {},
  tutorQuestions: 0,
  notesSaved: 0,
  notesDeleted: 0,
  notesCreated: 0,
  marketInstalls: 0,
  cloudUploads: 0,
  calcInteractions: 0,
  streakDays: 1,
  lastActiveDay: "",
};
const defaultDesktopIcons: DesktopIcon[] = [{ id: "market", x: 20, y: 120 }];

const defaultInstalledApps: AppId[] = ["market", "settings"];

const fontMap: Record<FontId, string> = {
  inter: "Inter, system-ui, sans-serif",
  segoe: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  poppins: "Poppins, Inter, system-ui, sans-serif",
  jetbrains: "'JetBrains Mono', 'Cascadia Code', monospace",
};

const themePreview: Record<ThemeId, string[]> = {
  winBlue: ["#60a5fa", "#2563eb", "#1e40af"],
  mist: ["#bfdbfe", "#93c5fd", "#dbeafe"],
  night: ["#334155", "#0f172a", "#020617"],
};

const themeMap: Record<ThemeId, { desktop: string; taskbar: string; window: string; border: string; text: string }> = {
  winBlue: {
    desktop: "bg-[radial-gradient(circle_at_20%_20%,_#61a8ff,_#2b74d9_45%,_#1455b2_80%)]",
    taskbar: "bg-slate-900/80",
    window: "bg-white/95",
    border: "border-slate-200",
    text: "text-slate-900",
  },
  mist: {
    desktop: "bg-[radial-gradient(circle_at_20%_20%,_#dbeafe,_#bfdbfe_40%,_#93c5fd_90%)]",
    taskbar: "bg-slate-900/75",
    window: "bg-white/95",
    border: "border-slate-200",
    text: "text-slate-900",
  },
  night: {
    desktop: "bg-[radial-gradient(circle_at_20%_20%,_#334155,_#0f172a_45%,_#020617_90%)]",
    taskbar: "bg-black/70",
    window: "bg-slate-900/95",
    border: "border-slate-700",
    text: "text-slate-200",
  },
};

const THEME_IDS: ThemeId[] = ["winBlue", "mist", "night"];
const FONT_IDS: FontId[] = ["segoe", "inter", "poppins", "jetbrains"];
const CLASS_LEVELS = [1, 2, 3, 4, 5];
const SKILL_LEVELS: SkillLevel[] = ["podstawowy", "sredni", "zaawansowany"];
const CALC_TABS: CalcTab[] = ["basic", "expression", "equation", "geometry", "log"];
const GEOMETRY_SHAPES: GeometryShape[] = ["kolo", "trojkat", "prostokat", "trapez", "prostopadloscian"];
const APP_LABELS: Record<AppId, string> = {
  flashcards: "Fiszki",
  tutor: "Korepetytor",
  calculator: "Kalkulator",
  notes: "Notatnik",
  designer: "TechSketch",
  settings: "Ustawienia",
  progress: "Postepy",
  market: "EduMarket",
  cloud: "Chmura",
};

const CALC_TAB_LABELS: Record<CalcTab, string> = {
  basic: "Podstawowy",
  expression: "Rozszerzony",
  equation: "Rownania",
  geometry: "Geometria",
  log: "Logarytmy",
};
const SHAPE_LABELS: Record<GeometryShape, string> = {
  kolo: "Kolo",
  trojkat: "Trojkat",
  prostokat: "Prostokat",
  trapez: "Trapez",
  prostopadloscian: "Prostopadloscian",
};

const APP_LABELS_EN: Record<AppId, string> = {
  flashcards: "Flashcards",
  tutor: "Tutor",
  calculator: "Calculator",
  notes: "Notebook",
  designer: "TechSketch",
  settings: "Settings",
  progress: "Progress",
  market: "EduMarket",
  cloud: "Cloud",
};

const MARKET_META: Record<Exclude<AppId, "market" | "settings">, { category: "Nauka" | "Narzedzia" | "Produktywnosc"; descriptionPl: string; descriptionEn: string; popularity: number }> = {
  flashcards: {
    category: "Nauka",
    descriptionPl: "Fiszki z trybem powtorek i rundami utrwalania. Tworzysz wlasne zestawy recznie lub przez AI, a system prowadzi sesje nauki karta po karcie.",
    descriptionEn: "Flashcards with repeat rounds and smart reinforcement. Create your own decks manually or with AI and study card by card in focused sessions.",
    popularity: 92,
  },
  tutor: {
    category: "Nauka",
    descriptionPl: "Korepetytor AI dopasowuje odpowiedzi do klasy, poziomu i celu oceny. Pomaga w nauce teorii, rozwiazywaniu zadan i porzadkowaniu materialu.",
    descriptionEn: "AI tutor adapts to your class, level and target grade. Great for theory revision, task solving and organizing study topics.",
    popularity: 89,
  },
  calculator: {
    category: "Narzedzia",
    descriptionPl: "Kalkulator szkolny do wyrazen, rownan, figur geometrycznych i logarytmow. Przydatny podczas nauki oraz szybkich sprawdzen wynikow.",
    descriptionEn: "School calculator for expressions, equations, geometry and logarithms. Useful for homework, practice and quick checks.",
    popularity: 86,
  },
  notes: {
    category: "Produktywnosc",
    descriptionPl: "Notatnik z formatowaniem, listámi, tabelami i asystentem AI. Pozwala porzadkowac material i rozbudowywac notatki o dodatkowe wyjasnienia.",
    descriptionEn: "Notebook with rich formatting, lists, tables and an AI assistant. Organize your material and expand notes with extra explanations.",
    popularity: 84,
  },
  designer: {
    category: "Narzedzia",
    descriptionPl: "Techniczne studio szkicow: rysowanie planow i schematow na siatce, podstawowe figury i szybkie generowanie konceptow SVG przez AI.",
    descriptionEn: "Technical sketch studio for plans and schemes on a grid, with basic shapes and fast AI SVG concept generation.",
    popularity: 78,
  },
  progress: {
    category: "Nauka",
    descriptionPl: "Rozbudowane statystyki nauki, czasu pracy i aktywnosci aplikacji. Otrzymujesz range oraz pasek postepu do kolejnego poziomu.",
    descriptionEn: "Advanced learning, activity and usage metrics. Includes rank progression and a next-level progress bar.",
    popularity: 74,
  },
  cloud: {
    category: "Produktywnosc",
    descriptionPl: "Chmura EduOS do importu plikow z Twojego komputera: tekstow i obrazow. Pliki tekstowe mozesz przenosic do Notatnika, a AI widzi kontekst zawartosci.",
    descriptionEn: "EduOS Cloud imports real files from your computer: text and images. Text files can be moved into Notebook and AI gets file context.",
    popularity: 81,
  },
};

const BUTTON_MOTION = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: { duration: 0.16 },
} as const;

const APP_COMMAND_MAP: Record<string, AppId> = {
  fiszki: "flashcards",
  korepetytor: "tutor",
  tutor: "tutor",
  kalkulator: "calculator",
  notatnik: "notes",
  projekt: "designer",
  techsketch: "designer",
  chmura: "cloud",
  cloud: "cloud",
  ustawienia: "settings",
  postepy: "progress",
  edumarket: "market",
};

const RANK_STEPS = [
  { name: "Bronze", min: 0, max: 199 },
  { name: "Silver", min: 200, max: 649 },
  { name: "Gold", min: 650, max: 1699 },
  { name: "Diamond", min: 1700, max: 4499 },
  { name: "EduMaster", min: 4500, max: Number.POSITIVE_INFINITY },
] as const;

type SessionSummary = { deckTitle: string; mastered: number; total: number; rounds: number };
type Notice = { id: string; kind: "info" | "success" | "warning" | "error"; title: string; detail?: string };

function appLabel(id: AppId, language: SystemLanguage) {
  return language === "en" ? APP_LABELS_EN[id] : APP_LABELS[id];
}

function categoryLabel(category: "Nauka" | "Narzedzia" | "Produktywnosc", language: SystemLanguage) {
  if (language !== "en") return category;
  if (category === "Nauka") return "Learning";
  if (category === "Narzedzia") return "Tools";
  return "Productivity";
}

function skillLabel(level: SkillLevel, language: SystemLanguage) {
  if (language !== "en") return level;
  if (level === "podstawowy") return "basic";
  if (level === "sredni") return "intermediate";
  return "advanced";
}

function learningRank(progress: ProgressStats) {
  const points = progress.masteredCards * 2 + progress.sessionsDone * 25 + progress.tutorQuestions * 3;
  const step = RANK_STEPS.find((s) => points >= s.min && points <= s.max);
  return step?.name ?? "EduMaster";
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseNumber(value: string) {
  return Number(value.replace(/,/g, "."));
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "Nieokreslone";
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toFixed(8)).toString();
}

function shuffleCards(cards: Flashcard[]) {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeCard(card: Record<string, unknown>): Flashcard | null {
  const question = typeof card.question === "string" ? card.question.trim() : "";
  const answer =
    (typeof card.answer === "string" ? card.answer.trim() : "") ||
    (typeof card.definition === "string" ? card.definition.trim() : "");
  const hint = typeof card.hint === "string" ? card.hint.trim() : "";
  if (!question || !answer) return null;
  return { id: typeof card.id === "string" ? card.id : generateId(), question, hint, answer };
}

function parseDecks(raw: string): Deck[] {
  const parsed = JSON.parse(raw) as Record<string, unknown>[];
  return parsed.reduce<Deck[]>((acc, item) => {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const categoryRaw = typeof item.category === "string" ? item.category : "Inne";
    const category = categoryOrder.includes(categoryRaw as DeckCategory) ? (categoryRaw as DeckCategory) : "Inne";
    const cardsRaw = Array.isArray(item.cards) ? item.cards : [];
    const cards = cardsRaw.map((card) => normalizeCard(card as Record<string, unknown>)).filter((card): card is Flashcard => Boolean(card));
    if (!title || cards.length === 0) return acc;
    acc.push({
      id: typeof item.id === "string" ? item.id : `user-${generateId()}`,
      title,
      source: "user",
      category,
      preferredMode: item.preferredMode === "three" ? "three" : "two",
      cards,
    });
    return acc;
  }, []);
}

function tutorStyleLabel(v: number) {
  if (v < 34) return "Na luzie";
  if (v < 67) return "Zbalansowany";
  return "Profesjonalny";
}

function recommendedGrade(skill: SkillLevel, classLevel: number) {
  if (skill === "podstawowy") return classLevel <= 2 ? 2 : 3;
  if (skill === "sredni") return classLevel >= 4 ? 4 : 3;
  return classLevel >= 4 ? 6 : 5;
}

function recommendedStyle(skill: SkillLevel) {
  if (skill === "podstawowy") return 22;
  if (skill === "sredni") return 50;
  return 82;
}

function recommendedTokens(skill: SkillLevel) {
  if (skill === "podstawowy") return 350;
  if (skill === "sredni") return 500;
  return 700;
}

function gradeInstruction(grade: number) {
  if (grade <= 2) return "Skup sie na absolutnych podstawach.";
  if (grade === 3) return "Tlumacz pod pewne zaliczenie i prosty schemat.";
  if (grade === 4) return "Tlumacz pod poziom dobry z typowymi zadaniami.";
  if (grade === 5) return "Tlumacz pod bardzo dobry wynik i typowe pulapki.";
  return "Tlumacz pod poziom celujacy z rozszerzeniem tematu.";
}

function lengthInstruction(maxTokens: number) {
  if (maxTokens <= 350) return "Odpowiedz bardzo krotko: maksymalnie 5-7 zdan.";
  if (maxTokens <= 650) return "Odpowiedz krotko: maksymalnie 10 zdan.";
  if (maxTokens <= 950) return "Odpowiedz srednio: maksymalnie 14 zdan.";
  return "Odpowiedz dluzsza, ale konkretna: maksymalnie 18 zdan.";
}

function cleanTutorAnswer(raw: string) {
  return raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html: string) {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function plainTextToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : "<p><br/></p>"))
    .join("");
}

function normalizeMathExpression(raw: string) {
  return raw
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/\^/g, "**")
    .replace(/π|PI/g, "pi")
    .replace(/\bln\(/g, "log(")
    .replace(/\blog\(/g, "log10(")
    .replace(/\broot\(/g, "nroot(")
    .replace(/√/g, "sqrt")
    .replace(/(\d)(x|pi|[a-z(])/gi, "$1*$2")
    .replace(/(x|pi|\))(\d|x|pi|[a-z(])/gi, "$1*$2");
}

function evaluateMathExpression(raw: string, xValue = 0) {
  const normalized = normalizeMathExpression(raw);
  if (!normalized) throw new Error("Puste wyrazenie.");
  if (!/^[0-9x+\-*/().,a-z*]+$/i.test(normalized)) throw new Error("Niedozwolone znaki.");
  const nroot = (n: number, value: number) => {
    if (n === 0) throw new Error("Stopien pierwiastka nie moze byc 0.");
    if (value < 0 && n % 2 === 0) throw new Error("Brak pierwiastka parzystego dla liczby ujemnej.");
    return Math.sign(value) * Math.abs(value) ** (1 / n);
  };
  const evaluator = new Function("Math", "x", "nroot", `with (Math) { const pi = PI; return (${normalized}); }`);
  const out = evaluator(Math, xValue, nroot) as number;
  if (typeof out !== "number" || Number.isNaN(out) || !Number.isFinite(out)) throw new Error("Bledne wyrazenie");
  return out;
}

function safeExpression(raw: string) {
  return evaluateMathExpression(raw);
}

function keypadUpdate(prev: string, token: string) {
  if (token === "C") return "";
  if (token === "DEL") return prev.slice(0, -1);
  if (token === "+/-") return prev.startsWith("-") ? prev.slice(1) : `-${prev || "0"}`;
  if (token === ".") return prev.includes(".") ? prev : `${prev || "0"}.`;
  if (prev === "0") return token;
  return `${prev}${token}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveCloudKey(accessCode: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(accessCode), "PBKDF2", false, ["deriveKey"]);
  const saltBytes = new Uint8Array(salt);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes as BufferSource,
      iterations: 180000,
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVaultPayload(data: CloudFileRecord[], accessCode: string): Promise<OnlineVaultPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveCloudKey(accessCode, salt);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    encrypted: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    updatedAt: Date.now(),
  };
}

async function decryptVaultPayload(payload: OnlineVaultPayload, accessCode: string): Promise<CloudFileRecord[]> {
  const iv = base64ToBytes(payload.iv);
  const salt = base64ToBytes(payload.salt);
  const data = base64ToBytes(payload.encrypted);
  const key = await deriveCloudKey(accessCode, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain)) as CloudFileRecord[];
}

function buildSyncCode(vaultId: string, accessCode: string) {
  return btoa(JSON.stringify({ v: vaultId, c: accessCode })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseSyncCode(syncCode: string): { vaultId: string; accessCode: string } | null {
  const legacy = syncCode.split(":");
  if (legacy.length === 2 && legacy[0] && legacy[1]) return { vaultId: legacy[0], accessCode: legacy[1] };
  try {
    const normalized = syncCode.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const parsed = JSON.parse(atob(`${normalized}${pad}`)) as { v?: string; c?: string };
    if (!parsed.v || !parsed.c) return null;
    return { vaultId: parsed.v, accessCode: parsed.c };
  } catch {
    return null;
  }
}

function cloudFileToDownload(file: CloudFileRecord) {
  if (file.kind === "text") {
    return { href: URL.createObjectURL(new Blob([file.textContent || ""], { type: file.mime || "text/plain" })), revoke: true };
  }
  if ((file.kind === "image" || file.kind === "video" || file.kind === "audio") && file.dataUrl) {
    return { href: file.dataUrl, revoke: false };
  }
  return null;
}

function appendImageToHtml(html: string, dataUrl: string, name: string) {
  const safeName = name.replace(/"/g, "'");
  return `${html || ""}<p><img src="${dataUrl}" alt="${safeName}" style="max-width:100%;border-radius:8px;" /></p>`;
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [ui, setUi] = useState<UiSettings>(defaultUi);
  const [clock, setClock] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingPhase, setOnboardingPhase] = useState<"welcome" | "intro" | "form">("welcome");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [booting, setBooting] = useState(true);

  const [templateDecks, setTemplateDecks] = useState<Deck[]>(templateDecksBase);
  const [removedTemplates, setRemovedTemplates] = useState<string[]>([]);
  const [userDecks, setUserDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState(templateDecksBase[0].id);
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [newDeckMode, setNewDeckMode] = useState<StudyMode>("two");
  const [newDeckCategory, setNewDeckCategory] = useState<DeckCategory>("Inne");
  const [newQuestion, setNewQuestion] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [draftCards, setDraftCards] = useState<Flashcard[]>([]);
  const [sessionDeck, setSessionDeck] = useState<Deck | null>(null);
  const [activeMode, setActiveMode] = useState<StudyMode>("two");
  const [studyPool, setStudyPool] = useState<Flashcard[]>([]);
  const [reviewPool, setReviewPool] = useState<Flashcard[]>([]);
  const [mastered, setMastered] = useState(0);
  const [round, setRound] = useState(1);
  const [face, setFace] = useState(0);
  const [nextFace, setNextFace] = useState<number | null>(null);
  const [flipping, setFlipping] = useState(false);

  const [tutorApiKey, setTutorApiKey] = useState("");
  const [tutorSubject, setTutorSubject] = useState("matematyka");
  const [tutorClass, setTutorClass] = useState(2);
  const [tutorStyle, setTutorStyle] = useState(35);
  const [tutorGrade, setTutorGrade] = useState(4);
  const [tutorMaxTokens, setTutorMaxTokens] = useState(500);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [aiDeckTopic, setAiDeckTopic] = useState("");
  const [aiDeckTitle, setAiDeckTitle] = useState("");
  const [aiDeckCount, setAiDeckCount] = useState(6);
  const [aiDeckMode, setAiDeckMode] = useState<StudyMode>("two");
  const [aiDeckCategory, setAiDeckCategory] = useState<DeckCategory>("Inne");
  const [aiDeckLoading, setAiDeckLoading] = useState(false);
  const [aiDeckError, setAiDeckError] = useState("");

  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteDraftTitle, setNoteDraftTitle] = useState("Nowy dokument");
  const [noteDraftContent, setNoteDraftContent] = useState("");
  const [noteAiPrompt, setNoteAiPrompt] = useState("");
  const [noteAiLoading, setNoteAiLoading] = useState(false);
  const [noteAiError, setNoteAiError] = useState("");
  const [cloudFiles, setCloudFiles] = useState<CloudFileRecord[]>([]);
  const [activeCloudFileId, setActiveCloudFileId] = useState<string | null>(null);
  const [onlineVaultId, setOnlineVaultId] = useState("");
  const [onlineSyncCode, setOnlineSyncCode] = useState("");
  const [onlineAccessCode, setOnlineAccessCode] = useState("");
  const [onlineFiles, setOnlineFiles] = useState<CloudFileRecord[]>([]);
  const [onlineCloudBusy, setOnlineCloudBusy] = useState(false);
  const [onlineCloudError, setOnlineCloudError] = useState("");
  const [cloudAiBusy, setCloudAiBusy] = useState(false);
  const [cloudAiError, setCloudAiError] = useState("");
  const imageCaptionPipelineRef = useRef<any>(null);
  const imageTextPipelineRef = useRef<any>(null);
  const gunRef = useRef<any>(null);
  const [sketchShapes, setSketchShapes] = useState<SketchShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [sketchGrid, setSketchGrid] = useState(true);
  const [sketchPrompt, setSketchPrompt] = useState("");
  const [sketchAiBusy, setSketchAiBusy] = useState(false);
  const [sketchAiError, setSketchAiError] = useState("");

  const [calcTab, setCalcTab] = useState<CalcTab>("basic");
  const [basicExpression, setBasicExpression] = useState("0");
  const [advancedExpression, setAdvancedExpression] = useState("sqrt(16)+2^3");
  const [activeCalcField, setActiveCalcField] = useState("eq-a");
  const [equationInput, setEquationInput] = useState("2x+3=7");
  const [geometryShape, setGeometryShape] = useState<GeometryShape>("kolo");
  const [calcFields, setCalcFields] = useState<Record<string, string>>({
    "eq-a": "1",
    "eq-b": "-3",
    "eq-c": "2",
    "root-x": "64",
    "root-n": "3",
    "g-r": "5",
    "g-a": "4",
    "g-b": "3",
    "g-c": "5",
    "g-d": "4",
    "g-h": "6",
    "log-base": "2",
    "log-value": "64",
  });

  const [windows, setWindows] = useState<WindowState[]>([]);
  const [installedApps, setInstalledApps] = useState<AppId[]>(defaultInstalledApps);
  const [desktopIcons, setDesktopIcons] = useState<DesktopIcon[]>(defaultDesktopIcons);
  const [iconPointerDown, setIconPointerDown] = useState<{ id: AppId; startX: number; startY: number; dx: number; dy: number } | null>(null);
  const [draggingIcon, setDraggingIcon] = useState<{ id: AppId; dx: number; dy: number } | null>(null);
  const [draggingWindow, setDraggingWindow] = useState<{ id: AppId; dx: number; dy: number } | null>(null);
  const [cmdDragging, setCmdDragging] = useState<{ dx: number; dy: number } | null>(null);
  const [cmdPos, setCmdPos] = useState({ x: 0, y: 0 });
  const [iconDragJustHappened, setIconDragJustHappened] = useState(false);
  const [progress, setProgress] = useState<ProgressStats>(defaultProgress);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdLog, setCmdLog] = useState<string[]>(["EduOS CMD ready. Wpisz ? aby zobaczyc komendy."]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);

  const ONBOARDING_STEPS = 7;

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setClock(`${h}:${m}`);
    };
    tick();
    const int = setInterval(tick, 1000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    let profileConfigured = false;

    const rawProfile = localStorage.getItem(storage.profile);
    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile) as Partial<Profile>;
        const merged = { ...defaultProfile, ...parsed };
        setProfile(merged);
        profileConfigured = merged.configured;
      } catch {
        profileConfigured = false;
      }
    }

    if (!rawProfile) profileConfigured = false;
    setOnboardingOpen(!profileConfigured);
    setOnboardingPhase(profileConfigured ? "intro" : "welcome");
    setBooting(profileConfigured);

    const rawUi = localStorage.getItem(storage.ui);
    if (rawUi) {
      try {
        setUi({ ...defaultUi, ...(JSON.parse(rawUi) as Partial<UiSettings>) });
      } catch {
        localStorage.removeItem(storage.ui);
      }
    }

    const rawRemoved = localStorage.getItem(storage.removedTemplates);
    if (rawRemoved) {
      try {
        const ids = JSON.parse(rawRemoved) as string[];
        if (Array.isArray(ids)) {
          setRemovedTemplates(ids);
          setTemplateDecks(templateDecksBase.filter((d) => !ids.includes(d.id)));
        }
      } catch {
        localStorage.removeItem(storage.removedTemplates);
      }
    }

    const rawDecks = localStorage.getItem(storage.decks);
    if (rawDecks) {
      try {
        setUserDecks(parseDecks(rawDecks));
      } catch {
        localStorage.removeItem(storage.decks);
      }
    }

    setTutorApiKey(localStorage.getItem(storage.tutorApiKey) ?? "");
    setTutorSubject(localStorage.getItem(storage.tutorSubject) ?? "matematyka");
    setTutorClass(Number(localStorage.getItem(storage.tutorClass) ?? 2));
    setTutorStyle(Number(localStorage.getItem(storage.tutorStyle) ?? 35));
    setTutorGrade(Number(localStorage.getItem(storage.tutorGrade) ?? 4));
    setTutorMaxTokens(Number(localStorage.getItem(storage.tutorTokens) ?? 500));

    const rawMessages = localStorage.getItem(storage.tutorMessages);
    if (rawMessages) {
      try {
        const parsed = JSON.parse(rawMessages) as TutorMessage[];
        if (Array.isArray(parsed)) setTutorMessages(parsed);
      } catch {
        localStorage.removeItem(storage.tutorMessages);
      }
    }

    const rawNotes = localStorage.getItem(storage.notes);
    if (rawNotes) {
      try {
        const parsed = JSON.parse(rawNotes) as NoteDoc[];
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .filter((n) => n && typeof n.title === "string" && typeof n.content === "string")
            .map((n) => ({ id: n.id || generateId(), title: n.title || "Dokument", content: n.content, updatedAt: Number(n.updatedAt) || Date.now() }));
          setNotes(normalized);
        }
      } catch {
        localStorage.removeItem(storage.notes);
      }
    }

    const rawCloudFiles = localStorage.getItem(storage.cloudFiles);
    if (rawCloudFiles) {
      try {
        const parsed = JSON.parse(rawCloudFiles) as CloudFileRecord[];
        if (Array.isArray(parsed)) {
          const normalized: CloudFileRecord[] = parsed
            .filter((f) => f && typeof f.name === "string" && typeof f.mime === "string")
            .map((f) => {
              const kind: CloudFileRecord["kind"] = f.kind === "image" || f.kind === "text" || f.kind === "video" || f.kind === "audio" ? f.kind : "other";
              return {
                id: f.id || generateId(),
                name: f.name,
                mime: f.mime,
                size: Number(f.size) || 0,
                kind,
                textContent: typeof f.textContent === "string" ? f.textContent : undefined,
                dataUrl: typeof f.dataUrl === "string" ? f.dataUrl : undefined,
                updatedAt: Number(f.updatedAt) || Date.now(),
              };
            });
          setCloudFiles(normalized);
        }
      } catch {
        localStorage.removeItem(storage.cloudFiles);
      }
    }

    setOnlineVaultId(localStorage.getItem(storage.onlineVaultId) ?? "");
    setOnlineSyncCode(localStorage.getItem(storage.onlineSyncCode) ?? "");

    localStorage.removeItem(storage.windows);

    const rawInstalledApps = localStorage.getItem(storage.installedApps);
    if (rawInstalledApps) {
      try {
        const parsed = JSON.parse(rawInstalledApps) as AppId[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduped = Array.from(new Set([...parsed, "market", "settings"])) as AppId[];
          setInstalledApps(deduped);
        }
      } catch {
        localStorage.removeItem(storage.installedApps);
      }
    }

    const rawDesktopIcons = localStorage.getItem(storage.desktopIcons);
    if (rawDesktopIcons) {
      try {
        const parsed = JSON.parse(rawDesktopIcons) as DesktopIcon[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDesktopIcons(parsed.map((icon) => ({ ...icon, y: Math.max(120, icon.y) })));
        }
      } catch {
        localStorage.removeItem(storage.desktopIcons);
      }
    }

    const rawProgress = localStorage.getItem(storage.progress);
    if (rawProgress) {
      try {
        setProgress({ ...defaultProgress, ...(JSON.parse(rawProgress) as Partial<ProgressStats>) });
      } catch {
        localStorage.removeItem(storage.progress);
      }
    }

    const rawDesigner = localStorage.getItem(storage.designerState);
    if (rawDesigner) {
      try {
        const parsed = JSON.parse(rawDesigner) as Partial<{ shapes: SketchShape[]; selectedShapeId: string | null; grid: boolean; prompt: string }>;
        if (Array.isArray(parsed.shapes)) setSketchShapes(parsed.shapes);
        if (typeof parsed.selectedShapeId === "string" || parsed.selectedShapeId === null) setSelectedShapeId(parsed.selectedShapeId ?? null);
        if (typeof parsed.grid === "boolean") setSketchGrid(parsed.grid);
        if (typeof parsed.prompt === "string") setSketchPrompt(parsed.prompt);
      } catch {
        localStorage.removeItem(storage.designerState);
      }
    }

    if (!profileConfigured) return;
    const bootTimeout = setTimeout(() => setBooting(false), 1950);
    return () => clearTimeout(bootTimeout);
  }, []);

  useEffect(() => {
    localStorage.setItem(storage.profile, JSON.stringify(profile));
    localStorage.setItem(storage.ui, JSON.stringify(ui));
    localStorage.setItem(storage.decks, JSON.stringify(userDecks));
    localStorage.setItem(storage.removedTemplates, JSON.stringify(removedTemplates));
    localStorage.setItem(storage.tutorApiKey, tutorApiKey);
    localStorage.setItem(storage.tutorSubject, tutorSubject);
    localStorage.setItem(storage.tutorClass, String(tutorClass));
    localStorage.setItem(storage.tutorStyle, String(tutorStyle));
    localStorage.setItem(storage.tutorGrade, String(tutorGrade));
    localStorage.setItem(storage.tutorTokens, String(tutorMaxTokens));
    localStorage.setItem(storage.tutorMessages, JSON.stringify(tutorMessages.slice(-40)));
    localStorage.setItem(storage.notes, JSON.stringify(notes));
    localStorage.setItem(storage.cloudFiles, JSON.stringify(cloudFiles));
    localStorage.setItem(storage.onlineVaultId, onlineVaultId);
    localStorage.setItem(storage.onlineSyncCode, onlineSyncCode);
    localStorage.setItem(storage.designerState, JSON.stringify({ shapes: sketchShapes, selectedShapeId, grid: sketchGrid, prompt: sketchPrompt }));
    localStorage.setItem(storage.windows, JSON.stringify(windows));
    localStorage.setItem(storage.desktopIcons, JSON.stringify(desktopIcons));
    localStorage.setItem(storage.progress, JSON.stringify(progress));
  }, [
    profile,
    ui,
    userDecks,
    removedTemplates,
    tutorApiKey,
    tutorSubject,
    tutorClass,
    tutorStyle,
    tutorGrade,
    tutorMaxTokens,
    tutorMessages,
    notes,
    cloudFiles,
    onlineVaultId,
    onlineSyncCode,
    sketchShapes,
    selectedShapeId,
    sketchGrid,
    sketchPrompt,
    windows,
    desktopIcons,
    progress,
  ]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setProgress((prev) => {
      if (!prev.lastActiveDay) return { ...prev, lastActiveDay: today, streakDays: 1 };
      if (prev.lastActiveDay === today) return prev;
      const prevDate = new Date(prev.lastActiveDay);
      const nowDate = new Date(today);
      const diffDays = Math.round((nowDate.getTime() - prevDate.getTime()) / 86400000);
      return {
        ...prev,
        lastActiveDay: today,
        streakDays: diffDays === 1 ? prev.streakDays + 1 : 1,
      };
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        const visible = windows.filter((w) => !w.minimized).map((w) => w.id);
        const appUsageSeconds = { ...prev.appUsageSeconds };
        visible.forEach((id) => {
          appUsageSeconds[id] = (appUsageSeconds[id] ?? 0) + 1;
        });
        return {
          ...prev,
          totalUsageSeconds: prev.totalUsageSeconds + 1,
          appUsageSeconds,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [windows]);
  useEffect(() => localStorage.setItem(storage.installedApps, JSON.stringify(installedApps)), [installedApps]);

  useEffect(() => {
    setInstalledApps((prev) => {
      const next = [...prev];
      if (!next.includes("market")) next.push("market");
      if (!next.includes("settings")) next.push("settings");
      return next;
    });
  }, []);

  useEffect(() => {
    setDesktopIcons((prev) => {
      const allowed = prev.filter((icon) => installedApps.includes(icon.id));
      const missing = installedApps.filter((appId) => !allowed.some((icon) => icon.id === appId));
      if (missing.length === 0) return allowed;
      const created = missing.map((id, idx) => ({ id, x: 20, y: 120 + (allowed.length + idx) * 100 }));
      return [...allowed, ...created];
    });
  }, [installedApps]);

  useEffect(() => {
    setTutorClass(profile.classLevel);
    setTutorGrade(recommendedGrade(profile.skillLevel, profile.classLevel));
    setTutorStyle(recommendedStyle(profile.skillLevel));
    setTutorMaxTokens(recommendedTokens(profile.skillLevel));
  }, [profile.classLevel, profile.skillLevel]);

  useEffect(() => {
    setProfile((prev) => (prev.classLevel === tutorClass ? prev : { ...prev, classLevel: tutorClass }));
  }, [tutorClass]);

  useEffect(() => {
    const blockContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", blockContext);
    return () => window.removeEventListener("contextmenu", blockContext);
  }, []);

  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason || "Nieznany blad");
      pushNotice("error", "Blad aplikacji", msg.slice(0, 220));
    };
    const onError = (event: ErrorEvent) => {
      pushNotice("error", "Blad aplikacji", (event.message || "Nieznany blad").slice(0, 220));
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("error", onError);
    };
  }, []);

  function pushNotice(kind: Notice["kind"], title: string, detail = "") {
    setNotice({ id: generateId(), kind, title, detail });
  }

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 3800);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (onboardingOpen || !booting) return;
    const timeout = setTimeout(() => setBooting(false), 1950);
    return () => clearTimeout(timeout);
  }, [onboardingOpen, booting]);

  useEffect(() => {
    if (!onboardingOpen || onboardingPhase !== "intro") return;
    const timeout = setTimeout(() => setOnboardingPhase("form"), 3600);
    return () => clearTimeout(timeout);
  }, [onboardingOpen, onboardingPhase]);

  useEffect(() => {
    if (!iconPointerDown && !draggingIcon && !draggingWindow && !cmdDragging) return;

    const handleMove = (e: MouseEvent) => {
      if (iconPointerDown && !draggingIcon) {
        const dist = Math.hypot(e.clientX - iconPointerDown.startX, e.clientY - iconPointerDown.startY);
        if (dist > 6) {
          setDraggingIcon({ id: iconPointerDown.id, dx: iconPointerDown.dx, dy: iconPointerDown.dy });
        }
      }

      if (draggingIcon) {
        const iconW = 112;
        const iconH = 110;
        const maxX = Math.max(0, window.innerWidth - iconW);
        const maxY = Math.max(0, window.innerHeight - 54 - iconH);
        setDesktopIcons((prev) =>
          prev.map((icon) =>
            icon.id === draggingIcon.id
              ? {
                  ...icon,
                  x: Math.min(maxX, Math.max(0, e.clientX - draggingIcon.dx)),
                  y: Math.min(maxY, Math.max(0, e.clientY - draggingIcon.dy)),
                }
              : icon
          )
        );
      }

      if (draggingWindow) {
        const maxX = Math.max(0, window.innerWidth - 220);
        const maxY = Math.max(0, window.innerHeight - 54 - 60);
        setWindows((prev) =>
          prev.map((w) =>
            w.id === draggingWindow.id
              ? {
                  ...w,
                  x: Math.min(maxX, Math.max(0, e.clientX - draggingWindow.dx)),
                  y: Math.min(maxY, Math.max(0, e.clientY - draggingWindow.dy)),
                }
              : w
          )
        );
      }

      if (cmdDragging) {
        const maxX = Math.max(0, window.innerWidth - 380);
        const maxY = Math.max(0, window.innerHeight - 230);
        setCmdPos({
          x: Math.min(maxX, Math.max(0, e.clientX - cmdDragging.dx)),
          y: Math.min(maxY, Math.max(0, e.clientY - cmdDragging.dy)),
        });
      }
    };

    const handleUp = () => {
      if (draggingIcon) {
        setIconDragJustHappened(true);
        setTimeout(() => setIconDragJustHappened(false), 180);
      }
      setIconPointerDown(null);
      setDraggingIcon(null);
      setDraggingWindow(null);
      setCmdDragging(null);
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [iconPointerDown, draggingIcon, draggingWindow, cmdDragging]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "`") return;
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (typing) return;
      e.preventDefault();
      setCmdOpen((v) => !v);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const theme = themeMap[ui.theme];
  const isNight = ui.theme === "night";
  const isEnglish = ui.language === "en";
  const visibleDesktopIcons = useMemo(() => desktopIcons.filter((icon) => installedApps.includes(icon.id)), [desktopIcons, installedApps]);
  const allDecks = useMemo(() => [...templateDecks, ...userDecks], [templateDecks, userDecks]);
  const selectedDeck = useMemo(() => allDecks.find((d) => d.id === selectedDeckId) ?? allDecks[0] ?? null, [allDecks, selectedDeckId]);
  const currentCard = studyPool[0];
  const sessionProgress = sessionDeck ? Math.round((mastered / sessionDeck.cards.length) * 100) : 0;
  const aiContext = useMemo(
    () =>
      JSON.stringify(
        {
          user: {
            configured: profile.configured,
            displayName: profile.displayName,
            classLevel: profile.classLevel,
            skillLevel: profile.skillLevel,
          },
          tutor: {
            subject: tutorSubject,
            classLevel: tutorClass,
            professionalism: tutorStyle,
            targetGrade: tutorGrade,
            maxTokens: tutorMaxTokens,
            recentMessages: tutorMessages.slice(-4).map((m) => ({ role: m.role, content: m.content.slice(0, 280) })),
          },
          learning: {
            progress,
            selectedDeck: selectedDeck?.title ?? null,
            totalDecks: allDecks.length,
            templateDecks: templateDecks.length,
            userDecks: userDecks.length,
            deckTitles: allDecks.map((d) => d.title).slice(0, 30),
            notes: {
              total: notes.length,
              list: notes.slice(0, 20).map((n) => ({ title: n.title, updatedAt: n.updatedAt, contentPreview: htmlToPlainText(n.content).slice(0, 180) })),
              activeTitle: (activeNoteId ? notes.find((n) => n.id === activeNoteId)?.title : null) ?? null,
              activeExcerpt: noteDraftContent.slice(0, 220),
              lastUpdatedAt: notes[0]?.updatedAt ?? null,
            },
            activeSession: sessionDeck
              ? {
                  deckTitle: sessionDeck.title,
                  round,
                  mastered,
                  reviewPool: reviewPool.length,
                  sessionProgress,
                }
              : null,
            calculator: {
              tab: calcTab,
              expression: advancedExpression,
              equation: equationInput,
              geometryShape,
              geometryFields: calcFields,
              activeField: activeCalcField,
            },
          },
          market: {
            installedApps,
            installableApps: (Object.keys(MARKET_META) as AppId[]).filter((id) => !installedApps.includes(id)),
          },
          cloud: {
            totalFiles: cloudFiles.length,
            files: cloudFiles.slice(0, 40).map((f) => ({
              name: f.name,
              kind: f.kind,
              mime: f.mime,
              size: f.size,
              textPreview: (f.textContent || "").slice(0, 700),
              imagePreviewDataUrl: (f.dataUrl || "").slice(0, 600),
            })),
            activeFile: activeCloudFileId,
            onlineVaultId,
            onlineFiles: onlineFiles.slice(0, 40).map((f) => ({
              name: f.name,
              kind: f.kind,
              size: f.size,
              textPreview: (f.textContent || "").slice(0, 500),
            })),
          },
          designer: {
            shapesTotal: sketchShapes.length,
            selectedShapeId,
            grid: sketchGrid,
            promptDraft: sketchPrompt,
            shapePreview: sketchShapes.slice(0, 25),
          },
          system: {
            theme: ui.theme,
            font: ui.font,
            language: ui.language,
            desktopIcons: visibleDesktopIcons.map((i) => ({ id: i.id, x: i.x, y: i.y })),
            windowsState: windows.map((w) => ({ id: w.id, minimized: w.minimized, maximized: w.maximized, x: w.x, y: w.y, w: w.w, h: w.h })),
            openedApps: windows.filter((w) => !w.minimized).map((w) => w.id),
            localTime: clock,
          },
        },
        null,
        0
      ),
    [
      profile.configured,
      profile.displayName,
      profile.classLevel,
      profile.skillLevel,
      tutorSubject,
      tutorClass,
      tutorStyle,
      tutorGrade,
      tutorMaxTokens,
      tutorMessages,
      progress,
      notes,
      activeNoteId,
      noteDraftContent,
      selectedDeck?.title,
      allDecks.length,
      allDecks,
      templateDecks.length,
      userDecks.length,
      sessionDeck,
      round,
      mastered,
      reviewPool.length,
      sessionProgress,
      ui.theme,
      ui.font,
      ui.language,
      windows,
      visibleDesktopIcons,
      installedApps,
      calcTab,
      advancedExpression,
      equationInput,
      geometryShape,
      calcFields,
      activeCalcField,
      clock,
      cloudFiles,
      activeCloudFileId,
      onlineVaultId,
      onlineFiles,
      sketchShapes,
      selectedShapeId,
      sketchGrid,
      sketchPrompt,
    ]
  );

  const basicResult = useMemo(() => {
    try {
      return formatNumber(safeExpression(basicExpression));
    } catch {
      return "...";
    }
  }, [basicExpression]);

  const expressionResult = useMemo(() => {
    try {
      return formatNumber(safeExpression(advancedExpression));
    } catch (err) {
      return err instanceof Error ? err.message : "Blad";
    }
  }, [advancedExpression]);

  const equationResult = useMemo(() => {
    if (!equationInput.trim()) return ["Wpisz rownanie, np. 2x+3=7."];
    const parts = equationInput.split("=");
    if (parts.length !== 2) return ["Rownanie musi zawierac jeden znak =."];
    try {
      const leftB = evaluateMathExpression(parts[0], 0);
      const leftAtOne = evaluateMathExpression(parts[0], 1);
      const rightB = evaluateMathExpression(parts[1], 0);
      const rightAtOne = evaluateMathExpression(parts[1], 1);
      const a = leftAtOne - leftB - (rightAtOne - rightB);
      const b = leftB - rightB;
      if (Math.abs(a) < 1e-12) return [Math.abs(b) < 1e-12 ? "Tozsamosc: nieskonczenie wiele rozwiazan." : "Sprzecznosc: brak rozwiazan."];
      return [`Utworzone rownanie: ${equationInput}`, `Postac liniowa: ${formatNumber(a)}x + ${formatNumber(b)} = 0`, `x = ${formatNumber(-b / a)}`];
    } catch (error) {
      return [error instanceof Error ? error.message : "Niepoprawne rownanie."];
    }
  }, [equationInput]);

  const rootResult = useMemo(() => {
    const x = parseNumber(calcFields["root-x"] ?? "0");
    const n = parseNumber(calcFields["root-n"] ?? "2");
    if (Number.isNaN(x) || Number.isNaN(n) || n === 0) return "Podaj poprawne x i n.";
    if (x < 0 && n % 2 === 0) return "Brak pierwiastka parzystego stopnia dla liczby ujemnej.";
    return `Wynik: ${formatNumber(Math.sign(x) * Math.abs(x) ** (1 / n))}`;
  }, [calcFields]);

  const geometryResult = useMemo(() => {
    const get = (key: string) => parseNumber(calcFields[key] ?? "0");
    if (geometryShape === "kolo") {
      const r = get("g-r");
      if (!(r > 0)) return ["Promien musi byc dodatni."];
      return [`Pole = ${formatNumber(Math.PI * r ** 2)}`, `Obwod = ${formatNumber(2 * Math.PI * r)}`];
    }
    if (geometryShape === "trojkat") {
      const a = get("g-a");
      const b = get("g-b");
      const c = get("g-c");
      const h = get("g-h");
      if (!(a > 0 && b > 0 && c > 0 && h > 0)) return ["Wartosci musza byc dodatnie."];
      return [`Pole = ${formatNumber((a * h) / 2)}`, `Obwod = ${formatNumber(a + b + c)}`];
    }
    if (geometryShape === "prostokat") {
      const a = get("g-a");
      const b = get("g-b");
      if (!(a > 0 && b > 0)) return ["Wartosci musza byc dodatnie."];
      return [`Pole = ${formatNumber(a * b)}`, `Obwod = ${formatNumber(2 * (a + b))}`];
    }
    if (geometryShape === "trapez") {
      const a = get("g-a");
      const b = get("g-b");
      const c = get("g-c");
      const d = get("g-d");
      const h = get("g-h");
      if (!(a > 0 && b > 0 && c > 0 && d > 0 && h > 0)) return ["Wartosci musza byc dodatnie."];
      return [`Pole = ${formatNumber(((a + b) * h) / 2)}`, `Obwod = ${formatNumber(a + b + c + d)}`];
    }
    const a = get("g-a");
    const b = get("g-b");
    const h = get("g-h");
    if (!(a > 0 && b > 0 && h > 0)) return ["Wartosci musza byc dodatnie."];
    return [
      `Objetosc = ${formatNumber(a * b * h)}`,
      `Pole calkowite = ${formatNumber(2 * (a * b + a * h + b * h))}`,
      `Przekatna = ${formatNumber(Math.sqrt(a ** 2 + b ** 2 + h ** 2))}`,
    ];
  }, [calcFields, geometryShape]);

  const logResult = useMemo(() => {
    const base = parseNumber(calcFields["log-base"] ?? "2");
    const value = parseNumber(calcFields["log-value"] ?? "1");
    if (!(base > 0) || base === 1) return ["Podstawa musi byc > 0 i != 1."];
    if (!(value > 0)) return ["Liczba logarytmowana musi byc dodatnia."];
    return [
      `log_${formatNumber(base)}(${formatNumber(value)}) = ${formatNumber(Math.log(value) / Math.log(base))}`,
      `ln(${formatNumber(value)}) = ${formatNumber(Math.log(value))}`,
      `log10(${formatNumber(value)}) = ${formatNumber(Math.log10(value))}`,
    ];
  }, [calcFields]);

  function installApp(id: AppId) {
    if (id === "market") return;
    setInstalledApps((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    pushNotice("success", `${ui.language === "en" ? "Downloaded" : "Pobrano"}: ${appLabel(id, ui.language)}`);
    setProgress((prev) => ({ ...prev, marketInstalls: prev.marketInstalls + 1 }));
  }

  function uninstallApp(id: AppId) {
    if (id === "market" || id === "settings") return;
    setInstalledApps((prev) => prev.filter((appId) => appId !== id));
    setDesktopIcons((prev) => prev.filter((icon) => icon.id !== id));
    setWindows((prev) => prev.filter((windowItem) => windowItem.id !== id));
    if (id === "notes") setActiveNoteId(null);
    pushNotice("info", `${ui.language === "en" ? "Removed" : "Usunieto"}: ${appLabel(id, ui.language)}`);
  }

  function openApp(id: AppId) {
    if (!installedApps.includes(id)) {
      pushNotice(ui.language === "en" ? "warning" : "warning", ui.language === "en" ? "App is not installed" : "Aplikacja nie jest pobrana", appLabel(id, ui.language));
      return false;
    }
    setWindows((prev) => {
      const maxZ = prev.reduce((mx, w) => Math.max(mx, w.z), 1);
      const existing = prev.find((w) => w.id === id);
      if (existing) {
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: maxZ + 1 } : w));
      }
      return [
        ...prev,
        {
          id,
          z: maxZ + 1,
          minimized: false,
          maximized: false,
          x: 90 + prev.length * 24,
          y: 70 + prev.length * 24,
          w: 900,
          h: 560,
        },
      ];
    });
    setProgress((prev) => ({
      ...prev,
      appOpens: { ...prev.appOpens, [id]: (prev.appOpens[id] ?? 0) + 1 },
    }));
    return true;
  }

  function focusWindow(id: AppId) {
    setWindows((prev) => {
      const maxZ = prev.reduce((mx, w) => Math.max(mx, w.z), 1);
      return prev.map((w) => (w.id === id ? { ...w, z: maxZ + 1 } : w));
    });
  }

  function minimizeWindow(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }

  function toggleFullscreenWindow(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized, minimized: false } : w)));
  }

  function closeWindow(id: AppId) {
    if (id === "notes") {
      setActiveNoteId(null);
      setNoteAiError("");
    }
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setStartMenuOpen(true);
  }

  function closeAllWindows() {
    setWindows([]);
    setStartMenuOpen(true);
  }

  function toggleTaskWindow(id: AppId) {
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;
      const maxZ = prev.reduce((mx, w) => Math.max(mx, w.z), 1);
      const topVisible = [...prev].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
      if (target.minimized) return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: maxZ + 1 } : w));
      if (topVisible?.id === id) return prev.map((w) => (w.id === id ? { ...w, minimized: true } : w));
      return prev.map((w) => (w.id === id ? { ...w, z: maxZ + 1 } : w));
    });
  }

  function startSession(deck: Deck, modeToUse: StudyMode) {
    setSessionSummary(null);
    setSessionDeck(deck);
    setActiveMode(modeToUse);
    setStudyPool(shuffleCards(deck.cards));
    setReviewPool([]);
    setMastered(0);
    setRound(1);
    setFace(0);
    setNextFace(null);
    setFlipping(false);
  }

  function nextCard(unknown: boolean) {
    if (!currentCard || !sessionDeck) return;
    const [, ...rest] = studyPool;
    const updatedReview = unknown && !reviewPool.some((c) => c.id === currentCard.id) ? [...reviewPool, currentCard] : reviewPool;
    if (!unknown) {
      setMastered((v) => v + 1);
      setProgress((prev) => ({ ...prev, masteredCards: prev.masteredCards + 1 }));
    }
    if (rest.length > 0) {
      setStudyPool(rest);
      if (unknown) setReviewPool(updatedReview);
    } else if (updatedReview.length > 0) {
      setStudyPool(shuffleCards(updatedReview));
      setReviewPool([]);
      setRound((v) => v + 1);
    } else {
      const finishedDeck = sessionDeck;
      const masteredInSession = unknown ? mastered : mastered + 1;
      setStudyPool([]);
      setReviewPool([]);
      setSessionDeck(null);
      setProgress((prev) => ({ ...prev, sessionsDone: prev.sessionsDone + 1 }));
      setSessionSummary({
        deckTitle: finishedDeck.title,
        mastered: masteredInSession,
        total: finishedDeck.cards.length,
        rounds: round,
      });
    }
    setFace(0);
    setNextFace(null);
    setFlipping(false);
  }

  function flipCard() {
    if (!currentCard || flipping) return;
    const faces = activeMode === "two" ? 2 : 3;
    setNextFace((face + 1) % faces);
    setFlipping(true);
  }

  function getFaceLabel(index: number) {
    if (activeMode === "two") return index === 0 ? "Pytanie" : "Odpowiedz";
    if (index === 0) return "Pytanie";
    return index === 1 ? "Podpowiedz" : "Odpowiedz";
  }

  function getFaceText(index: number) {
    if (!currentCard) return "";
    if (activeMode === "two") return index === 0 ? currentCard.question : currentCard.answer;
    if (index === 0) return currentCard.question;
    if (index === 1) return currentCard.hint || "Brak podpowiedzi";
    return currentCard.answer;
  }

  function addDraftCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    if (newDeckMode === "three" && !newHint.trim()) return;
    setDraftCards((prev) => [...prev, { id: generateId(), question: newQuestion.trim(), hint: newDeckMode === "three" ? newHint.trim() : "", answer: newAnswer.trim() }]);
    setNewQuestion("");
    setNewHint("");
    setNewAnswer("");
  }

  function saveDeck() {
    if (!newDeckTitle.trim() || draftCards.length < 2) return;
    const deck: Deck = {
      id: `user-${generateId()}`,
      title: newDeckTitle.trim(),
      source: "user",
      category: newDeckCategory,
      preferredMode: newDeckMode,
      cards: draftCards,
    };
    setUserDecks((prev) => [...prev, deck]);
    setSelectedDeckId(deck.id);
    setDraftCards([]);
    setNewDeckTitle("");
    pushNotice("success", "Dodano zestaw", deck.title);
  }

  async function askOpenRouter(prompt: string, mode: "tutor" | "json" = "tutor", history: TutorMessage[] = []) {
    if (!tutorApiKey.trim()) throw new Error("Podaj klucz API");
    const styleInstruction =
      tutorStyle < 34
        ? "Tlumacz bardzo prosto."
        : tutorStyle < 67
          ? "Tlumacz jasno i konkretnie."
          : "Tlumacz profesjonalnie i precyzyjnie.";
    const responseLimit = lengthInstruction(tutorMaxTokens);

    const systemContent =
      mode === "json"
        ? `Zwracaj tylko poprawny JSON, bez markdown i bez dodatkowych komentarzy. Uzyj kontekstu ucznia i aplikacji: ${aiContext}`
        : `Jestes korepetytorem AI. Odpowiadasz po polsku. Zwroc sie do ucznia po imieniu/pseudonimie: ${profile.displayName || "Uczen"}. Klasa ${tutorClass} technikum, temat lekcji: ${tutorSubject}, docelowa ocena: ${tutorGrade}. ${styleInstruction} ${gradeInstruction(tutorGrade)} ${responseLimit} Pisz normalna odpowiedz dla ucznia, bez markdown, bez naglowkow, bez tabel, bez opisu kryteriow, bez wstepu o ocenie. Daj gotowa odpowiedz merytoryczna. Kontekst ucznia i aplikacji: ${aiContext}`;

    const historyMessages =
      mode === "json"
        ? []
        : history.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          }));

    const payload = {
      model: OPENROUTER_FREE_MODEL,
      temperature: mode === "json" ? 0.15 : 0.3,
      max_tokens: tutorMaxTokens,
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        ...historyMessages,
        { role: "user", content: prompt },
      ],
    };

    let lastError = "Nieznany blad";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tutorApiKey.trim()}` },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const output = data.choices?.[0]?.message?.content?.trim() ?? "";
        if (output) return output;
        lastError = "Pusta odpowiedz modelu.";
      } else {
        const bodyText = await response.text();
        lastError = `HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 180)}` : ""}`;
      }

      await new Promise((resolve) => setTimeout(resolve, 550 * (attempt + 1)));
    }

    throw new Error(lastError);
  }

  async function askTutor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tutorQuestion.trim() || tutorLoading) return;
    const userMsg: TutorMessage = { id: generateId(), role: "user", content: tutorQuestion.trim() };
    setTutorMessages((prev) => [...prev, userMsg]);
    setProgress((prev) => ({ ...prev, tutorQuestions: prev.tutorQuestions + 1 }));
    setTutorQuestion("");
    setTutorLoading(true);
    setTutorError("");
    try {
      const answer = cleanTutorAnswer(await askOpenRouter(userMsg.content, "tutor", tutorMessages));
      if (!answer) throw new Error("Brak odpowiedzi");
      setTutorMessages((prev) => [...prev, { id: generateId(), role: "assistant", content: answer }]);
    } catch (err) {
      setTutorError(`Nie udalo sie pobrac odpowiedzi AI: ${err instanceof Error ? err.message : "blad"}`);
    } finally {
      setTutorLoading(false);
    }
  }

  function extractJsonPayload(text: string) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) return `{"cards":${text.slice(arrayStart, arrayEnd + 1)}}`;
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return text.slice(a, b + 1);
    return text;
  }

  async function generateDeckWithAi() {
    if (!aiDeckTopic.trim() || !aiDeckTitle.trim()) {
      setAiDeckError("Podaj temat i nazwe zestawu.");
      return;
    }

    setAiDeckLoading(true);
    setAiDeckError("");

    try {
      const prompt = `Przygotuj zestaw fiszek o temacie: ${aiDeckTopic}. Zwroc tylko JSON w formacie {"cards":[{"question":"...","hint":"...","answer":"..."}]}. Liczba fiszek: ${aiDeckCount}. Jezyk: polski. ${aiDeckMode === "two" ? "Hint ma byc pusty string" : "Dodaj krotki hint"}.`;
      const raw = await askOpenRouter(prompt, "json");
      const payload = extractJsonPayload(raw)
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      const parsed = JSON.parse(payload) as { cards?: Array<Record<string, unknown>> };
      const cards = (parsed.cards ?? [])
        .map((c) => normalizeCard(c))
        .filter((c): c is Flashcard => Boolean(c))
        .slice(0, aiDeckCount)
        .map((c) => ({ ...c, hint: aiDeckMode === "three" ? c.hint || "Podpowiedz: glowna definicja" : "" }));

      if (cards.length < 2) throw new Error("Za malo kart");

      const deck: Deck = {
        id: `user-${generateId()}`,
        title: aiDeckTitle.trim(),
        source: "user",
        category: aiDeckCategory,
        preferredMode: aiDeckMode,
        cards,
      };
      setUserDecks((prev) => [...prev, deck]);
      setSelectedDeckId(deck.id);
      setAiDeckTopic("");
      setAiDeckTitle("");
      setAiDeckCount(6);
      pushNotice("success", "AI przygotowalo zestaw", deck.title);
    } catch (err) {
      setAiDeckError(`Nie udalo sie wygenerowac zestawu: ${err instanceof Error ? err.message : "blad"}`);
    } finally {
      setAiDeckLoading(false);
    }
  }

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) ?? null, [notes, activeNoteId]);

  function createBlankNote() {
    const note: NoteDoc = {
      id: generateId(),
      title: "Nowy dokument",
      content: "",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setNoteDraftTitle(note.title);
    setNoteDraftContent(note.content);
    setNoteAiError("");
    setProgress((prev) => ({ ...prev, notesCreated: prev.notesCreated + 1 }));
  }

  function openSavedNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setNoteDraftTitle(note.title);
    setNoteDraftContent(note.content);
    setNoteAiError("");
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(null);
      setNoteDraftTitle("Nowy dokument");
      setNoteDraftContent("");
    }
    pushNotice("info", "Usunieto notatke");
    setProgress((prev) => ({ ...prev, notesDeleted: prev.notesDeleted + 1 }));
  }

  async function addCloudFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const mapped = await Promise.all(
      files.map(
        (file) =>
          new Promise<CloudFileRecord>((resolve) => {
            const base: CloudFileRecord = {
              id: generateId(),
              name: file.name,
              mime: file.type || "application/octet-stream",
              size: file.size,
              kind: file.type.startsWith("text/") ? "text" : file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "other",
              updatedAt: Date.now(),
            };

            if (base.kind === "text") {
              const reader = new FileReader();
              reader.onload = () => resolve({ ...base, textContent: String(reader.result || "") });
              reader.onerror = () => resolve(base);
              reader.readAsText(file);
              return;
            }

            if (base.kind === "image" || base.kind === "video" || base.kind === "audio") {
              const reader = new FileReader();
              reader.onload = () => resolve({ ...base, dataUrl: String(reader.result || "") });
              reader.onerror = () => resolve(base);
              reader.readAsDataURL(file);
              return;
            }

            resolve(base);
          })
      )
    );

    setCloudFiles((prev) => [...mapped, ...prev].slice(0, 80));
    if (mapped[0]) setActiveCloudFileId(mapped[0].id);
    setProgress((prev) => ({ ...prev, cloudUploads: prev.cloudUploads + mapped.length }));
    pushNotice("success", ui.language === "en" ? "Files imported" : "Pliki zaimportowane", `${mapped.length}`);
  }

  function removeCloudFile(id: string) {
    setCloudFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeCloudFileId === id) setActiveCloudFileId(null);
  }

  function importCloudTextToNotes(file: CloudFileRecord) {
    if (file.kind !== "text" || !file.textContent) return;
    const note: NoteDoc = {
      id: generateId(),
      title: file.name.replace(/\.[^.]+$/, "") || "Import z chmury",
      content: plainTextToHtml(file.textContent),
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setNoteDraftTitle(note.title);
    setNoteDraftContent(note.content);
    setProgress((prev) => ({ ...prev, notesCreated: prev.notesCreated + 1, notesSaved: prev.notesSaved + 1 }));
    pushNotice("success", ui.language === "en" ? "Imported to notebook" : "Przeniesiono do notatnika", note.title);
  }

  function importCloudImageToNotes(file: CloudFileRecord) {
    if (file.kind !== "image" || !file.dataUrl) return;
    const block = appendImageToHtml("", file.dataUrl, file.name);

    if (activeNoteId) {
      setNoteDraftContent((prev) => `${prev}${block}`);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId
            ? {
                ...n,
                content: `${n.content}${block}`,
                updatedAt: Date.now(),
              }
            : n
        )
      );
      pushNotice("success", ui.language === "en" ? "Image pasted into note" : "Wklejono obraz do notatki", file.name);
      return;
    }

    const note: NoteDoc = {
      id: generateId(),
      title: file.name.replace(/\.[^.]+$/, "") || "Obraz z chmury",
      content: block,
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setNoteDraftTitle(note.title);
    setNoteDraftContent(note.content);
    setProgress((prev) => ({ ...prev, notesCreated: prev.notesCreated + 1, notesSaved: prev.notesSaved + 1 }));
    pushNotice("success", ui.language === "en" ? "Image pasted into new note" : "Wklejono obraz do nowej notatki", note.title);
  }

  async function getCloudImagePipeline(kind: "describe" | "transcribe") {
    const { pipeline } = await import("@xenova/transformers");
    if (kind === "describe") {
      if (!imageCaptionPipelineRef.current) {
        imageCaptionPipelineRef.current = await pipeline("image-to-text", "Xenova/vit-gpt2-image-captioning");
      }
      return imageCaptionPipelineRef.current;
    }
    if (!imageTextPipelineRef.current) {
      imageTextPipelineRef.current = await pipeline("image-to-text", "Xenova/trocr-base-handwritten");
    }
    return imageTextPipelineRef.current;
  }

  async function analyzeImageToNote(dataUrl: string, fileName: string, mode: "describe" | "transcribe") {
    if (!dataUrl || cloudAiBusy) return;
    setCloudAiBusy(true);
    setCloudAiError("");
    try {
      const runner = await getCloudImagePipeline(mode);
      const output = await runner(dataUrl, { max_new_tokens: mode === "describe" ? 90 : 260 });
      const text = Array.isArray(output)
        ? String((output[0] as { generated_text?: string })?.generated_text || "").trim()
        : String((output as { generated_text?: string })?.generated_text || "").trim();

      if (!text) throw new Error("AI nie zwrocilo tekstu.");

      let improved = text;
      if (tutorApiKey.trim()) {
        const improvePrompt =
          mode === "transcribe"
            ? `Masz surowy odczyt OCR obrazu. Popraw go do czytelnej formy tekstu (bez markdown), zachowujac sens. Surowy tekst: ${text}`
            : `Masz surowy opis obrazu. Rozwin go do konkretnego opisu sceny (kolory, obiekty, tlo), bez markdown. Surowy opis: ${text}`;
        try {
          const polished = cleanTutorAnswer(await askOpenRouter(improvePrompt, "tutor", tutorMessages));
          if (polished) improved = polished;
        } catch {
          // If network refinement fails, keep local pipeline output.
        }
      }

      const titlePrefix = mode === "describe" ? "Opis obrazu" : "Transkrypcja obrazu";
      const section = `<p><strong>${titlePrefix}: ${fileName}</strong></p><p>${improved.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;

      if (activeNoteId) {
        setNoteDraftContent((prev) => `${prev}${section}`);
        setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? { ...n, content: `${n.content}${section}`, updatedAt: Date.now() } : n)));
      } else {
        const note: NoteDoc = {
          id: generateId(),
          title: `${titlePrefix} - ${fileName}`,
          content: section,
          updatedAt: Date.now(),
        };
        setNotes((prev) => [note, ...prev]);
        setActiveNoteId(note.id);
        setNoteDraftTitle(note.title);
        setNoteDraftContent(note.content);
      }

      pushNotice("success", mode === "describe" ? "Dodano opis obrazu" : "Dodano transkrypcje obrazu", fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Blad analizy obrazu";
      setCloudAiError(msg);
      pushNotice("error", "AI obrazu: blad", msg);
    } finally {
      setCloudAiBusy(false);
    }
  }

  async function analyzeFirstImageFromNote(mode: "describe" | "transcribe") {
    const match = noteDraftContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (!match?.[1]) {
      setCloudAiError(ui.language === "en" ? "No image found in current note." : "Brak obrazu w aktywnej notatce.");
      return;
    }
    await analyzeImageToNote(match[1], activeNote?.title || "Obraz z notatki", mode);
  }

  function getGunClient() {
    if (gunRef.current) return gunRef.current;
    gunRef.current = Gun({ peers: ["https://gun-manhattan.herokuapp.com/gun", "https://gunjs.herokuapp.com/gun"] });
    return gunRef.current;
  }

  async function writeVaultToGun(vaultId: string, payload: OnlineVaultPayload) {
    const gun = getGunClient();
    await new Promise<void>((resolve, reject) => {
      gun.get("eduos-online-vault").get(vaultId).put(payload, (ack: { err?: string }) => {
        if (ack?.err) reject(new Error(ack.err));
        else resolve();
      });
    });
  }

  async function readVaultFromGun(vaultId: string): Promise<OnlineVaultPayload> {
    const gun = getGunClient();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await new Promise<OnlineVaultPayload | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 1300);
        gun
          .get("eduos-online-vault")
          .get(vaultId)
          .once((data: OnlineVaultPayload | null) => {
            clearTimeout(timeout);
            if (!data || typeof data.encrypted !== "string" || typeof data.iv !== "string" || typeof data.salt !== "string") {
              resolve(null);
              return;
            }
            resolve(data);
          });
      });
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 380 * (attempt + 1)));
    }
    throw new Error("Brak danych pod tym kodem synchronizacji.");
  }

  async function saveOnlineVault() {
    if (!onlineAccessCode.trim()) {
      setOnlineCloudError(ui.language === "en" ? "Enter access code first." : "Najpierw wpisz kod dostepu.");
      return;
    }
    if (cloudFiles.length === 0) {
      setOnlineCloudError(ui.language === "en" ? "No local cloud files to upload." : "Brak plikow do wyslania.");
      return;
    }

    setOnlineCloudBusy(true);
    setOnlineCloudError("");
    try {
      const encrypted = await encryptVaultPayload(cloudFiles, onlineAccessCode.trim());
      const vaultId = onlineVaultId || `vault-${generateId()}`;
      await writeVaultToGun(vaultId, encrypted);

      setOnlineVaultId(vaultId);
      const sync = buildSyncCode(vaultId, onlineAccessCode.trim());
      setOnlineSyncCode(sync);
      pushNotice("success", ui.language === "en" ? "Online cloud saved" : "Zapisano chmure online", ui.language === "en" ? "Copy sync code and use it on any computer." : "Skopiuj kod synchronizacji i uzyj na dowolnym komputerze.");
    } catch (err) {
      setOnlineCloudError(err instanceof Error ? err.message : "Blad zapisu online");
    } finally {
      setOnlineCloudBusy(false);
    }
  }

  async function loadOnlineVaultFromCode() {
    const parsed = parseSyncCode(onlineSyncCode.trim()) ?? (onlineSyncCode.trim() && onlineAccessCode.trim() ? { vaultId: onlineSyncCode.trim(), accessCode: onlineAccessCode.trim() } : null);
    if (!parsed) {
      setOnlineCloudError(ui.language === "en" ? "Invalid sync code." : "Niepoprawny kod synchronizacji.");
      return;
    }

    setOnlineCloudBusy(true);
    setOnlineCloudError("");
    try {
      const payload = await readVaultFromGun(parsed.vaultId);
      const files = await decryptVaultPayload(payload, parsed.accessCode);
      setOnlineFiles(files);
      setOnlineVaultId(parsed.vaultId);
      setOnlineAccessCode(parsed.accessCode);
      pushNotice("success", ui.language === "en" ? "Online cloud loaded" : "Wczytano chmure online", `${files.length}`);
    } catch (err) {
      setOnlineCloudError(err instanceof Error ? err.message : "Blad odczytu online");
    } finally {
      setOnlineCloudBusy(false);
    }
  }

  function downloadCloudFile(file: CloudFileRecord) {
    const downloadable = cloudFileToDownload(file);
    if (!downloadable) {
      pushNotice("warning", ui.language === "en" ? "Cannot download this file" : "Nie mozna pobrac tego pliku");
      return;
    }
    const a = document.createElement("a");
    a.href = downloadable.href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (downloadable.revoke) setTimeout(() => URL.revokeObjectURL(downloadable.href), 500);
  }

  function addSketchShape(type: SketchShape["type"]) {
    const base: SketchShape = {
      id: generateId(),
      type,
      x: 40 + sketchShapes.length * 8,
      y: 40 + sketchShapes.length * 8,
      w: type === "circle" ? 70 : 120,
      h: type === "line" ? 0 : type === "circle" ? 70 : 80,
      stroke: "#0f172a",
      fill: type === "line" ? "transparent" : "rgba(14,165,233,0.16)",
      label: `${type}-${sketchShapes.length + 1}`,
    };
    setSketchShapes((prev) => [...prev, base]);
    setSelectedShapeId(base.id);
  }

  function updateSelectedShape(patch: Partial<SketchShape>) {
    if (!selectedShapeId) return;
    setSketchShapes((prev) => prev.map((shape) => (shape.id === selectedShapeId ? { ...shape, ...patch } : shape)));
  }

  async function generateSketchWithAi() {
    if (!sketchPrompt.trim()) {
      setSketchAiError(ui.language === "en" ? "Enter concept prompt first." : "Wpisz najpierw prompt projektu.");
      return;
    }
    setSketchAiBusy(true);
    setSketchAiError("");
    try {
      const prompt = `Wygeneruj czysty JSON do technicznego szkicu. Format: {"shapes":[{"type":"rect|circle|line","x":number,"y":number,"w":number,"h":number,"stroke":"#hex","fill":"rgba(...)","label":"..."}]}. Maksymalnie 18 ksztaltow. Uzyj siatki 0..920 x 0..580. Koncepcja: ${sketchPrompt}. Bez markdown.`;
      const raw = await askOpenRouter(prompt, "json", tutorMessages);
      const parsed = JSON.parse(extractJsonPayload(raw)) as { shapes?: Array<Partial<SketchShape>> };
      const generated = (parsed.shapes || [])
        .filter((s) => s && (s.type === "rect" || s.type === "circle" || s.type === "line"))
        .slice(0, 18)
        .map((s, i) => ({
          id: generateId(),
          type: s.type as SketchShape["type"],
          x: Number(s.x) || 30 + i * 12,
          y: Number(s.y) || 30 + i * 12,
          w: Number(s.w) || (s.type === "circle" ? 70 : 120),
          h: Number(s.h) || (s.type === "line" ? 0 : 80),
          stroke: typeof s.stroke === "string" ? s.stroke : "#0f172a",
          fill: typeof s.fill === "string" ? s.fill : s.type === "line" ? "transparent" : "rgba(14,165,233,0.16)",
          label: typeof s.label === "string" ? s.label : `shape-${i + 1}`,
        }));

      if (generated.length === 0) throw new Error("AI nie zwrocilo poprawnych elementow.");
      setSketchShapes(generated);
      setSelectedShapeId(generated[0].id);
      pushNotice("success", ui.language === "en" ? "AI concept generated" : "Wygenerowano koncept AI", `${generated.length}`);
    } catch (err) {
      setSketchAiError(err instanceof Error ? err.message : "Blad generowania szkicu");
    } finally {
      setSketchAiBusy(false);
    }
  }

  function saveActiveNote() {
    const title = noteDraftTitle.trim() || "Dokument";
    if (!activeNoteId) {
      const note: NoteDoc = {
        id: generateId(),
        title,
        content: noteDraftContent,
        updatedAt: Date.now(),
      };
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      pushNotice("success", "Zapisano nowy dokument");
      setProgress((prev) => ({ ...prev, notesSaved: prev.notesSaved + 1 }));
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? { ...n, title, content: noteDraftContent, updatedAt: Date.now() } : n)));
    pushNotice("success", "Zapisano dokument");
    setProgress((prev) => ({ ...prev, notesSaved: prev.notesSaved + 1 }));
  }

  async function runNoteAi(mode: "verify" | "extend") {
    const plain = htmlToPlainText(noteDraftContent);
    if (!plain.trim()) {
      setNoteAiError("Wpisz tresc dokumentu.");
      return;
    }
    setNoteAiLoading(true);
    setNoteAiError("");
    try {
      const instruction =
        mode === "verify"
          ? "Zweryfikuj i popraw jezyk oraz logike tekstu. Oddaj gotowy poprawiony tekst."
          : `Dopisz sensownie tekst zgodnie z prosba uzytkownika: ${noteAiPrompt || "rozwin temat i dodaj konkret."}`;
      const prompt = `Edytor Notatnik EduOS. Aktualny tytul: ${noteDraftTitle}. Tresc:\n${plain}\n\nZadanie: ${instruction}`;
      const answer = cleanTutorAnswer(await askOpenRouter(prompt, "tutor", tutorMessages));
      if (!answer) throw new Error("Pusta odpowiedz AI");
      setNoteDraftContent(plainTextToHtml(answer));
    } catch (err) {
      setNoteAiError(err instanceof Error ? err.message : "Blad AI");
    } finally {
      setNoteAiLoading(false);
    }
  }

  function endFlashcardsSession() {
    setSessionSummary(null);
    setSessionDeck(null);
    setStudyPool([]);
    setReviewPool([]);
    setFace(0);
    setNextFace(null);
    setFlipping(false);
  }

  function handleBasicKey(token: string) {
    setProgress((prev) => ({ ...prev, calcInteractions: prev.calcInteractions + 1 }));
    if (token === "=") {
      try {
        setBasicExpression(formatNumber(safeExpression(basicExpression)));
      } catch {
        setBasicExpression("0");
      }
      return;
    }
    if (token === "C") return setBasicExpression("0");
    if (token === "DEL") return setBasicExpression((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
    setBasicExpression((prev) => (prev === "0" && /[0-9.]/.test(token) ? token : `${prev}${token}`));
  }

  function handleAdvFieldKey(token: string) {
    setProgress((prev) => ({ ...prev, calcInteractions: prev.calcInteractions + 1 }));
    setCalcFields((prev) => ({ ...prev, [activeCalcField]: keypadUpdate(prev[activeCalcField] ?? "", token) }));
  }

  function handleAdvExpressionKey(token: string) {
    setProgress((prev) => ({ ...prev, calcInteractions: prev.calcInteractions + 1 }));
    if (token === "C") return setAdvancedExpression("");
    if (token === "DEL") return setAdvancedExpression((prev) => prev.slice(0, -1));
    setAdvancedExpression((prev) => `${prev}${token}`);
  }

  function saveSetup() {
    setProfile((prev) => ({ ...prev, configured: true, displayName: prev.displayName.trim() || "Uczen" }));
    setTutorClass(profile.classLevel);
    setOnboardingStep(0);
    setOnboardingPhase("welcome");
    setOnboardingOpen(false);
    setBooting(true);
  }

  function nextOnboardingStep() {
    setOnboardingStep((s) => Math.min(ONBOARDING_STEPS - 1, s + 1));
  }

  function prevOnboardingStep() {
    setOnboardingStep((s) => Math.max(0, s - 1));
  }

  function runCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    const [cmd, ...rest] = input.split(" ");
    const arg = rest.join(" ").trim();
    const push = (line: string) => setCmdLog((prev) => [...prev.slice(-24), line]);

    push(`> ${input}`);

    if (cmd === "?" || cmd === "help") {
      push("Komendy glowne: status, open, close, theme, font, class, level, subject, style, grade, tokens, setup, skip, clear");
      push("Aplikacje pobieraj w EduMarket. Uzyj open edumarket.");
      push("Uzyj: <komenda> ? aby zobaczyc opcje szczegolowe.");
      return;
    }

    if (cmd === "clear") {
      setCmdLog(["EduOS CMD ready. Wpisz ? aby zobaczyc komendy."]);
      return;
    }

    if (cmd === "status") {
      push(`Profil: klasa ${profile.classLevel}, poziom ${profile.skillLevel}, configured=${profile.configured}`);
      push(`UI: motyw=${ui.theme}, font=${ui.font}, jezyk=${ui.language}, animacje=${ui.animations}, przezroczystosc=${ui.transparency}`);
      push(`Korepetytor: temat=${tutorSubject}, klasa=${tutorClass}, styl=${tutorStyle}, ocena=${tutorGrade}, tokens=${tutorMaxTokens}`);
      push(`Postepy: sesje=${progress.sessionsDone}, karty=${progress.masteredCards}`);
      push(`Nauka: ranga=${learningRank(progress)}, czas=${progress.totalUsageSeconds}s, streak=${progress.streakDays}d`);
      push(`Aplikacje: zainstalowane=${installedApps.length}, aktywne_okna=${windows.filter((w) => !w.minimized).length}`);
      push(`Zainstalowane: ${installedApps.map((id) => appLabel(id, ui.language)).join(", ")}`);
      push(`EduMarket: dostepne_do_pobrania=${(Object.keys(MARKET_META) as AppId[]).filter((id) => !installedApps.includes(id)).length}`);
      push(`Okna: ${windows.filter((w) => !w.minimized).map((w) => appLabel(w.id, ui.language)).join(", ") || "brak"}`);
      return;
    }

    if (cmd === "skip") {
      setProfile((prev) => ({ ...prev, configured: true }));
      setOnboardingOpen(false);
      setOnboardingPhase("welcome");
      setBooting(false);
      push("Pominieto onboarding i animacje startu dla tej sesji.");
      return;
    }

    if (cmd === "setup") {
      setOnboardingOpen(true);
      setOnboardingPhase("welcome");
      setOnboardingStep(0);
      push("Uruchomiono konfigurator.");
      return;
    }

    if (cmd === "open") {
      if (arg === "?") {
        push("open fiszki | korepetytor | kalkulator | notatnik | projekt | chmura | ustawienia | postepy | edumarket");
        return;
      }
      const app = APP_COMMAND_MAP[arg.toLowerCase()];
      if (!app) return push("Nieznana aplikacja.");
      const opened = openApp(app);
      if (opened) push(`Otworzono: ${appLabel(app, ui.language)}`);
      else push(`Brak aplikacji: ${appLabel(app, ui.language)} (pobierz w EduMarket)`);
      return;
    }

    if (cmd === "close") {
      if (arg === "?") {
        push("close fiszki | korepetytor | kalkulator | notatnik | projekt | chmura | ustawienia | postepy | edumarket | all");
        return;
      }
      if (arg.toLowerCase() === "all") {
        closeAllWindows();
        push("Zamknieto wszystkie aplikacje.");
        return;
      }
      const app = APP_COMMAND_MAP[arg.toLowerCase()];
      if (!app) return push("Nieznana aplikacja.");
      closeWindow(app);
      push(`Zamknieto: ${appLabel(app, ui.language)}`);
      return;
    }

    if (cmd === "theme") {
      if (arg === "?") return push("theme winBlue | mist | night");
      if (!THEME_IDS.includes(arg as ThemeId)) return push("Nieznany motyw.");
      setUi((prev) => ({ ...prev, theme: arg as ThemeId }));
      push(`Ustawiono motyw: ${arg}`);
      return;
    }

    if (cmd === "font") {
      if (arg === "?") return push("font segoe | inter | poppins | jetbrains");
      if (!FONT_IDS.includes(arg as FontId)) return push("Nieznana czcionka.");
      setUi((prev) => ({ ...prev, font: arg as FontId }));
      push(`Ustawiono czcionke: ${arg}`);
      return;
    }

    if (cmd === "class") {
      if (arg === "?") return push("class 1..5");
      const lvl = Number(arg);
      if (!CLASS_LEVELS.includes(lvl)) return push("Klasa musi byc od 1 do 5.");
      setProfile((prev) => ({ ...prev, classLevel: lvl }));
      setTutorClass(lvl);
      push(`Ustawiono klase: ${lvl}`);
      return;
    }

    if (cmd === "level") {
      if (arg === "?") return push("level podstawowy | sredni | zaawansowany");
      if (!SKILL_LEVELS.includes(arg as SkillLevel)) return push("Poziom: podstawowy|sredni|zaawansowany");
      setProfile((prev) => ({ ...prev, skillLevel: arg as SkillLevel }));
      push(`Ustawiono poziom: ${arg}`);
      return;
    }

    if (cmd === "subject") {
      if (arg === "?") return push("subject <temat>");
      if (!arg) return push("Podaj temat.");
      setTutorSubject(arg);
      push(`Temat korepetytora: ${arg}`);
      return;
    }

    if (cmd === "style") {
      if (arg === "?") return push("style 0..100");
      const v = Number(arg);
      if (Number.isNaN(v) || v < 0 || v > 100) return push("Style 0-100.");
      setTutorStyle(Math.round(v));
      push(`Profesjonalnosc: ${Math.round(v)}`);
      return;
    }

    if (cmd === "grade") {
      if (arg === "?") return push("grade 2..6");
      const v = Number(arg);
      if (Number.isNaN(v) || v < 2 || v > 6) return push("Ocena 2-6.");
      setTutorGrade(Math.round(v));
      push(`Docelowa ocena: ${Math.round(v)}`);
      return;
    }

    if (cmd === "tokens") {
      if (arg === "?") return push("tokens 150..900");
      const v = Number(arg);
      if (Number.isNaN(v) || v < 150 || v > 900) return push("Tokeny 150-900.");
      setTutorMaxTokens(Math.round(v));
      push(`Max tokenow: ${Math.round(v)}`);
      return;
    }

    push("Nieznana komenda. Wpisz ?");
  }

  const desktopAnim = ui.animations ? { duration: 0.24, ease: "easeOut" as const } : { duration: 0 };

  return (
    <main className={cn("relative min-h-dvh overflow-hidden transition-colors duration-700", theme.text)} style={{ fontFamily: fontMap[ui.font] }}>
      <AnimatePresence mode="sync">
        <motion.div
          key={ui.theme}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
          className={cn("absolute inset-0", theme.desktop)}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_40%)]" />

      <section className="relative flex h-[calc(100dvh-54px)] w-full items-start p-6">
        <div className="relative h-full w-full">
          {visibleDesktopIcons.map((app) => (
            <motion.button
              key={app.id}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                setIconPointerDown({
                  id: app.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  dx: e.clientX - app.x,
                  dy: e.clientY - app.y,
                });
              }}
              onDragStart={(e) => e.preventDefault()}
              transition={{ duration: 0 }}
              onDoubleClick={() => {
                if (iconDragJustHappened) return;
                openApp(app.id);
              }}
              style={{ left: app.x, top: app.y }}
              className="absolute w-28 rounded-2xl px-3 py-3 text-center"
            >
              <span className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/25 backdrop-blur">
                <AppIcon id={app.id} />
              </span>
              <p className="rounded-md bg-black/30 px-1 py-0.5 text-xs font-semibold tracking-wide text-white shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{appLabel(app.id, ui.language)}</p>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {windows
            .filter((w) => !w.minimized)
            .sort((a, b) => a.z - b.z)
            .map((win) => (
              <motion.div
                key={win.id}
                onMouseDown={() => focusWindow(win.id)}
                initial={ui.animations ? { opacity: 0, scale: 0.96, y: 20 } : false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={ui.animations ? { opacity: 0, scale: 0.96, y: 20 } : { opacity: 0 }}
                transition={desktopAnim}
                style={{
                  zIndex: win.z,
                  width: win.maximized ? "calc(100vw - 20px)" : win.w,
                  height: win.maximized ? "calc(100vh - 74px)" : win.h,
                  left: win.maximized ? 10 : win.x,
                  top: win.maximized ? 10 : win.y,
                }}
                className={cn("absolute left-0 rounded-xl border shadow-2xl transition-colors duration-500", theme.window, theme.border, ui.transparency ? "backdrop-blur-lg" : "")}
              >
                <div
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if (win.maximized) return;
                    e.preventDefault();
                    setDraggingWindow({ id: win.id, dx: e.clientX - win.x, dy: e.clientY - win.y });
                  }}
                  className={cn("flex cursor-move items-center justify-between border-b px-4 py-2", theme.border)}
                >
                  <p className="text-sm font-medium">{windowTitle(win.id, ui.language)}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => minimizeWindow(win.id)} className={cn("rounded-md px-2 py-0.5 text-xs", isNight ? "text-slate-100 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-200/70")}>_</button>
                    <button onClick={() => toggleFullscreenWindow(win.id)} className={cn("rounded-md px-2 py-0.5 text-xs", isNight ? "text-slate-100 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-200/70")}>{win.maximized ? "[]" : "[ ]"}</button>
                    <button onClick={() => closeWindow(win.id)} className={cn("rounded-md px-2 py-0.5 text-xs", isNight ? "text-rose-300 hover:bg-rose-700 hover:text-white" : "text-rose-700 hover:bg-rose-500 hover:text-white")}>X</button>
                  </div>
                </div>
                <div className={cn("h-[calc(100%-41px)] overflow-auto p-4", isNight ? "bg-gradient-to-b from-slate-900 to-slate-950" : "bg-gradient-to-b from-white to-slate-50")}>
                  {win.id === "flashcards" && (
                    <FlashcardsView
                      allDecks={allDecks}
                      selectedDeck={selectedDeck}
                      selectedDeckId={selectedDeckId}
                      setSelectedDeckId={setSelectedDeckId}
                      startSession={startSession}
                      sessionDeck={sessionDeck}
                      currentCard={currentCard}
                      round={round}
                      face={face}
                      nextFace={nextFace}
                      flipping={flipping}
                      sessionProgress={sessionProgress}
                      flipCard={flipCard}
                      nextCard={nextCard}
                      getFaceLabel={getFaceLabel}
                      getFaceText={getFaceText}
                      setFace={setFace}
                      setNextFace={setNextFace}
                      setFlipping={setFlipping}
                      endSession={endFlashcardsSession}
                      sessionSummary={sessionSummary}
                      dismissSessionSummary={() => setSessionSummary(null)}
                      aiDeckTopic={aiDeckTopic}
                      setAiDeckTopic={setAiDeckTopic}
                      aiDeckTitle={aiDeckTitle}
                      setAiDeckTitle={setAiDeckTitle}
                      aiDeckCount={aiDeckCount}
                      setAiDeckCount={setAiDeckCount}
                      aiDeckMode={aiDeckMode}
                      setAiDeckMode={setAiDeckMode}
                      aiDeckCategory={aiDeckCategory}
                      setAiDeckCategory={setAiDeckCategory}
                      aiDeckLoading={aiDeckLoading}
                      aiDeckError={aiDeckError}
                      generateDeckWithAi={generateDeckWithAi}
                      isNight={isNight}
                      newDeckTitle={newDeckTitle}
                      setNewDeckTitle={setNewDeckTitle}
                      newDeckMode={newDeckMode}
                      setNewDeckMode={setNewDeckMode}
                      newDeckCategory={newDeckCategory}
                      setNewDeckCategory={setNewDeckCategory}
                      newQuestion={newQuestion}
                      setNewQuestion={setNewQuestion}
                      newHint={newHint}
                      setNewHint={setNewHint}
                      newAnswer={newAnswer}
                      setNewAnswer={setNewAnswer}
                      draftCards={draftCards}
                      addDraftCard={addDraftCard}
                      saveDeck={saveDeck}
                      removeDeck={(deck) => {
                        if (deck.source === "template") {
                          setTemplateDecks((prev) => prev.filter((d) => d.id !== deck.id));
                          setRemovedTemplates((prev) => (prev.includes(deck.id) ? prev : [...prev, deck.id]));
                        } else {
                          setUserDecks((prev) => prev.filter((d) => d.id !== deck.id));
                        }
                      }}
                    />
                  )}

                  {win.id === "tutor" && (
                    <TutorView
                      tutorSubject={tutorSubject}
                      setTutorSubject={setTutorSubject}
                      tutorClass={tutorClass}
                      setTutorClass={setTutorClass}
                      tutorStyle={tutorStyle}
                      setTutorStyle={setTutorStyle}
                      tutorGrade={tutorGrade}
                      setTutorGrade={setTutorGrade}
                      tutorMaxTokens={tutorMaxTokens}
                      setTutorMaxTokens={setTutorMaxTokens}
                      tutorQuestion={tutorQuestion}
                      setTutorQuestion={setTutorQuestion}
                      tutorMessages={tutorMessages}
                      tutorLoading={tutorLoading}
                      tutorError={tutorError}
                      language={ui.language}
                      isNight={isNight}
                      askTutor={askTutor}
                    />
                  )}

                  {win.id === "calculator" && (
                    <CalculatorView
                      calcTab={calcTab}
                      setCalcTab={setCalcTab}
                      basicExpression={basicExpression}
                      basicResult={basicResult}
                      handleBasicKey={handleBasicKey}
                      advancedExpression={advancedExpression}
                      expressionResult={expressionResult}
                      handleAdvExpressionKey={handleAdvExpressionKey}
                      equationInput={equationInput}
                      setEquationInput={setEquationInput}
                      activeCalcField={activeCalcField}
                      setActiveCalcField={setActiveCalcField}
                      calcFields={calcFields}
                      handleAdvFieldKey={handleAdvFieldKey}
                      equationResult={equationResult}
                      rootResult={rootResult}
                      geometryShape={geometryShape}
                      setGeometryShape={setGeometryShape}
                      geometryResult={geometryResult}
                      logResult={logResult}
                      isNight={isNight}
                    />
                  )}

                  {win.id === "notes" && (
                    <NotanikView
                      notes={notes}
                      activeNote={activeNote}
                      noteDraftTitle={noteDraftTitle}
                      setNoteDraftTitle={setNoteDraftTitle}
                      noteDraftContent={noteDraftContent}
                      setNoteDraftContent={setNoteDraftContent}
                      noteAiPrompt={noteAiPrompt}
                      setNoteAiPrompt={setNoteAiPrompt}
                      noteAiLoading={noteAiLoading}
                      noteAiError={noteAiError}
                      createBlankNote={createBlankNote}
                      openSavedNote={openSavedNote}
                      deleteNote={deleteNote}
                      leaveNote={() => setActiveNoteId(null)}
                      saveActiveNote={saveActiveNote}
                      runNoteAi={runNoteAi}
                      runImageAi={analyzeFirstImageFromNote}
                      imageAiLoading={cloudAiBusy}
                      imageAiError={cloudAiError}
                      isNight={isNight}
                    />
                  )}

                  {win.id === "designer" && (
                    <DesignerView
                      shapes={sketchShapes}
                      selectedShapeId={selectedShapeId}
                      setSelectedShapeId={setSelectedShapeId}
                      addShape={addSketchShape}
                      updateSelectedShape={updateSelectedShape}
                      removeSelectedShape={() => {
                        if (!selectedShapeId) return;
                        setSketchShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
                        setSelectedShapeId(null);
                      }}
                      clearAllShapes={() => {
                        setSketchShapes([]);
                        setSelectedShapeId(null);
                      }}
                      sketchGrid={sketchGrid}
                      setSketchGrid={setSketchGrid}
                      sketchPrompt={sketchPrompt}
                      setSketchPrompt={setSketchPrompt}
                      sketchAiBusy={sketchAiBusy}
                      sketchAiError={sketchAiError}
                      generateSketchWithAi={generateSketchWithAi}
                      isNight={isNight}
                    />
                  )}

                  {win.id === "market" && (
                    <AppMarketView
                      installedApps={installedApps}
                      installApp={installApp}
                      uninstallApp={uninstallApp}
                      openApp={openApp}
                      language={ui.language}
                      isNight={isNight}
                    />
                  )}

                  {win.id === "cloud" && (
                    <CloudView
                      files={cloudFiles}
                      onlineFiles={onlineFiles}
                      activeFileId={activeCloudFileId}
                      setActiveFileId={setActiveCloudFileId}
                      onAddFiles={addCloudFiles}
                      onRemoveFile={removeCloudFile}
                      onImportTextToNotes={importCloudTextToNotes}
                      onImportImageToNotes={importCloudImageToNotes}
                      onSaveOnlineVault={saveOnlineVault}
                      onLoadOnlineVault={loadOnlineVaultFromCode}
                      onDownloadFile={downloadCloudFile}
                      onlineSyncCode={onlineSyncCode}
                      setOnlineSyncCode={setOnlineSyncCode}
                      onlineAccessCode={onlineAccessCode}
                      setOnlineAccessCode={setOnlineAccessCode}
                      onlineCloudBusy={onlineCloudBusy}
                      onlineCloudError={onlineCloudError}
                      language={ui.language}
                      isNight={isNight}
                    />
                  )}

                  {win.id === "settings" && (
                    <SettingsView
                      profile={profile}
                      setProfile={setProfile}
                      ui={ui}
                      setUi={setUi}
                      tutorApiKey={tutorApiKey}
                      setTutorApiKey={setTutorApiKey}
                      language={ui.language}
                      isNight={isNight}
                      openCmd={() => setCmdOpen(true)}
                      reopenSetup={() => {
                        setOnboardingPhase("form");
                        setOnboardingStep(0);
                        setOnboardingOpen(true);
                      }}
                    />
                  )}

                  {win.id === "progress" && <ProgressView progress={progress} language={ui.language} isNight={isNight} />}
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </section>

      <footer className={cn("absolute bottom-0 left-0 right-0 z-50 flex h-[54px] items-center justify-between border-t border-white/20 px-3 text-white shadow-[0_-8px_20px_rgba(0,0,0,0.25)] transition-colors duration-500", theme.taskbar)}>
        <div className="relative flex items-center gap-2">
          <button onClick={() => setStartMenuOpen((v) => !v)} className="rounded-md bg-white/15 px-3 py-1.5 text-sm transition-transform hover:-translate-y-0.5 active:scale-95">{isEnglish ? "Start" : "Start"}</button>
          {startMenuOpen && (
            <div className="absolute bottom-12 left-0 w-64 space-y-1 rounded-xl border border-white/20 bg-slate-950/95 p-2 text-sm shadow-xl backdrop-blur">
              <button onClick={() => { openApp("market"); setStartMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/10">EduMarket</button>
              {installedApps.includes("settings") && <button onClick={() => { openApp("settings"); setStartMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/10">{isEnglish ? "Settings" : "Ustawienia"}</button>}
              <button onClick={() => { setCmdOpen(true); setStartMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/10">{isEnglish ? "Open CMD" : "Uruchom CMD"}</button>
              <button onClick={() => { setWindows((prev) => prev.map((w) => ({ ...w, minimized: true }))); setStartMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/10">{isEnglish ? "Show desktop" : "Pokaz pulpit"}</button>
              <button onClick={() => { closeAllWindows(); setStartMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-rose-300 hover:bg-rose-900/40">{isEnglish ? "Close all apps" : "Zamknij wszystkie aplikacje"}</button>
            </div>
          )}
          {windows.map((w) => (
            <button key={w.id} onClick={() => toggleTaskWindow(w.id)} className={cn("rounded-md px-2 py-1 text-xs", w.minimized ? "bg-white/10" : "bg-white/25")}>{windowTitle(w.id, ui.language)}</button>
          ))}
        </div>
        <div className="text-sm">{clock}</div>
      </footer>

      <AnimatePresence>
        {onboardingOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-md">
            <AnimatePresence mode="wait">
              {onboardingPhase === "welcome" ? (
                <motion.div
                  key="setup-welcome"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full max-w-xl rounded-3xl border border-white/35 bg-slate-950/85 px-8 py-10 text-center text-white"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{isEnglish ? "Welcome" : "Witamy"}</p>
                  <h1 className="mt-3 text-5xl font-semibold tracking-tight">EduOS</h1>
                  <p className="mt-3 text-sm text-slate-300">{isEnglish ? "Smart desktop for learning. First, set your profile." : "Inteligentny pulpit do nauki. Najpierw ustawimy Twoj profil."}</p>
                  <motion.button
                    {...BUTTON_MOTION}
                    onClick={() => setOnboardingPhase("intro")}
                    className="mt-7 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900"
                  >
                    {isEnglish ? "Let\'s begin" : "Zaczynajmy"}
                  </motion.button>
                </motion.div>
              ) : onboardingPhase === "intro" ? (
                <motion.div
                  key="setup-intro"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.65, ease: "easeOut" }}
                  className="text-center text-white"
                >
                  <motion.p
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: [30, 0, 0], opacity: [0, 1, 1] }}
                    transition={{ duration: 1.5, times: [0, 0.4, 1], ease: "easeInOut" }}
                    className="text-3xl font-semibold tracking-tight sm:text-5xl"
                  >
                    {isEnglish ? "let\'s configure your device" : "skonfigurujmy twoje urzadzenie"}
                  </motion.p>
                </motion.div>
              ) : (
                <motion.section
                  key="setup-form"
                  initial={{ y: 24, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 24, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full max-w-4xl rounded-2xl border border-white/40 bg-white/95 p-6 text-slate-900"
                >
                  <h2 className="text-2xl font-semibold">{isEnglish ? "Initial setup" : "Konfiguracja startowa"}</h2>
                  <p className="mt-1 text-sm text-slate-600">{isEnglish ? "Step" : "Krok"} {onboardingStep + 1} {isEnglish ? "of" : "z"} {ONBOARDING_STEPS}. {isEnglish ? "One setting per step." : "Ustawiamy wszystko etapami."}</p>

                  <AnimatePresence mode="wait">
                    {onboardingStep === 0 && (
                      <motion.div key="step-language" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "Choose system language" : "Wybierz jezyk systemu"}</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { id: "pl", label: "Polski" },
                            { id: "en", label: "English" },
                          ] as const).map((lang) => (
                            <button key={lang.id} onClick={() => setUi((prev) => ({ ...prev, language: lang.id }))} className={cn("rounded-full border px-4 py-2 text-sm", ui.language === lang.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white")}>
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {onboardingStep === 1 && (
                      <motion.div key="step-theme" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "Choose theme" : "Wybierz motyw z podgladem"}</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {THEME_IDS.map((themeId) => (
                            <motion.button key={themeId} {...BUTTON_MOTION} onClick={() => setUi((prev) => ({ ...prev, theme: themeId }))} className={cn("rounded-xl border p-3 text-left", ui.theme === themeId ? "border-slate-900" : "border-slate-300")}>
                              <div className="flex gap-1">{themePreview[themeId].map((c) => <span key={c} className="h-8 w-full rounded-md" style={{ backgroundColor: c }} />)}</div>
                              <p className="mt-2 text-sm font-medium">{themeId}</p>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {onboardingStep === 2 && (
                      <motion.div key="step-font" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "Choose font" : "Wybierz czcionke"}</p>
                        <div className="flex flex-wrap gap-2">
                          {FONT_IDS.map((font) => (
                            <button key={font} onClick={() => setUi((prev) => ({ ...prev, font }))} className={cn("rounded-full border px-4 py-2 text-sm", ui.font === font ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white")} style={{ fontFamily: fontMap[font] }}>
                              {font}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {onboardingStep === 3 && (
                      <motion.div key="step-class" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "Choose your class" : "Wybierz klase technikum"}</p>
                        <div className="flex flex-wrap gap-2">
                          {CLASS_LEVELS.map((lvl) => (
                            <button key={lvl} onClick={() => setProfile((prev) => ({ ...prev, classLevel: lvl }))} className={cn("rounded-full border px-4 py-2 text-sm", profile.classLevel === lvl ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white")}>
                              {isEnglish ? "Class" : "Klasa"} {lvl}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {onboardingStep === 4 && (
                      <motion.div key="step-name" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "How should AI address you?" : "Jak AI ma sie do Ciebie zwracac?"}</p>
                        <input
                          value={profile.displayName}
                          onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                          placeholder={isEnglish ? "e.g. Alex / Neo" : "Np. Kuba / Neo"}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </motion.div>
                    )}

                    {onboardingStep === 5 && (
                      <motion.div key="step-level" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5">
                        <p className="mb-2 text-sm text-slate-600">{isEnglish ? "Student level" : "Poziom ucznia"}</p>
                        <div className="flex gap-2">
                          {SKILL_LEVELS.map((level) => (
                            <motion.button key={level} {...BUTTON_MOTION} onClick={() => setProfile((prev) => ({ ...prev, skillLevel: level }))} className={cn("rounded-full border px-3 py-1.5 text-xs", profile.skillLevel === level ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white")}>
                              {skillLabel(level, ui.language)}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {onboardingStep === 6 && (
                      <motion.div key="step-api" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5 space-y-3">
                        <p className="text-sm text-slate-600">{isEnglish ? "OpenRouter API key (optional)" : "Klucz API OpenRouter (opcjonalnie)"}</p>
                        <input
                          type="password"
                          value={tutorApiKey}
                          onChange={(e) => setTutorApiKey(e.target.value)}
                          placeholder={isEnglish ? "Paste API key to enable AI immediately" : "Wklej klucz API, aby AI dzialalo od razu"}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-slate-500">{isEnglish ? "You can skip this step and set the key later in Settings." : "Mozesz pominac ten krok i uzupelnic klucz pozniej w Ustawieniach."}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={prevOnboardingStep} disabled={onboardingStep === 0} className="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-40">{isEnglish ? "Back" : "Wstecz"}</button>
                    {onboardingStep < ONBOARDING_STEPS - 1 ? (
                      <motion.button {...BUTTON_MOTION} onClick={nextOnboardingStep} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white">{isEnglish ? "Next" : "Dalej"}</motion.button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={saveSetup} className="text-xs text-slate-500 underline underline-offset-4">{isEnglish ? "Skip key" : "Pomijam klucz"}</button>
                        <motion.button
                          {...BUTTON_MOTION}
                          onClick={saveSetup}
                          className="rounded-full bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200"
                        >
                          {isEnglish ? "Save setup and start EduOS" : "Zapisz konfiguracje i rozpocznij korzystanie z EduOS"}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {booting && !onboardingOpen && (
          <motion.div
            key="boot-overlay"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[58] flex items-center justify-center bg-slate-950"
          >
            <div className="w-full max-w-xl px-6 text-white">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs uppercase tracking-[0.24em] text-slate-400">
                uruchamianie
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-3 text-center text-4xl font-semibold tracking-tight"
              >
                EduOS
              </motion.h2>
              <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: ["0%", "35%", "72%", "100%"] }}
                  transition={{ duration: 1.65, times: [0, 0.3, 0.7, 1], ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-sky-400 to-indigo-500"
                />
              </div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-3 text-center text-sm text-slate-300">
                Ladowanie konfiguracji i personalizacja pulpitu...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cmdOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{ left: cmdPos.x || undefined, top: cmdPos.y || undefined }}
            className={cn(
              "absolute z-[70] w-[min(720px,94vw)] rounded-xl border border-slate-700 bg-black/90 p-3 text-slate-100 shadow-2xl",
              cmdPos.x === 0 && cmdPos.y === 0 ? "bottom-16 left-1/2 -translate-x-1/2" : ""
            )}
          >
            <div
              className="mb-2 flex cursor-move items-center justify-between text-xs text-slate-400"
              onMouseDown={(e) => {
                e.preventDefault();
                const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                setCmdPos({ x: rect.left, y: rect.top });
                setCmdDragging({ dx: e.clientX - rect.left, dy: e.clientY - rect.top });
              }}
            >
              <p>EduOS CMD</p>
              <button onClick={() => setCmdOpen(false)} className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-700">zamknij</button>
            </div>
            <div className="max-h-48 overflow-auto rounded border border-slate-800 bg-black/70 p-2 font-mono text-xs">
              {cmdLog.map((line, i) => (
                <p key={`${line}-${i}`} className="whitespace-pre-wrap leading-5">{line}</p>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                runCommand(cmdInput);
                setCmdInput("");
              }}
            >
              <span className="pt-2 text-sm text-sky-300">C:\\EduOS&gt;</span>
              <input
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm"
                autoFocus
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "absolute right-4 top-4 z-[55] max-w-[420px] rounded-xl border px-4 py-3 text-sm backdrop-blur",
              isNight ? "bg-slate-900/85" : "bg-white/90",
              notice.kind === "success" ? "border-emerald-400/60" : "",
              notice.kind === "warning" ? "border-amber-400/60" : "",
              notice.kind === "error" ? "border-rose-400/60" : "",
              notice.kind === "info" ? "border-sky-400/60" : ""
            )}
          >
            <p className="font-semibold">{notice.title}</p>
            {notice.detail ? <p className={cn("mt-1 text-xs", isNight ? "text-slate-300" : "text-slate-600")}>{notice.detail}</p> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function windowTitle(id: AppId, language: SystemLanguage) {
  return appLabel(id, language);
}

function FlashcardsView({
  allDecks,
  selectedDeck,
  selectedDeckId,
  setSelectedDeckId,
  startSession,
  sessionDeck,
  currentCard,
  round,
  face,
  nextFace,
  flipping,
  sessionProgress,
  flipCard,
  nextCard,
  getFaceLabel,
  getFaceText,
  setFace,
  setNextFace,
  setFlipping,
  endSession,
  sessionSummary,
  dismissSessionSummary,
  aiDeckTopic,
  setAiDeckTopic,
  aiDeckTitle,
  setAiDeckTitle,
  aiDeckCount,
  setAiDeckCount,
  aiDeckMode,
  setAiDeckMode,
  aiDeckCategory,
  setAiDeckCategory,
  aiDeckLoading,
  aiDeckError,
  generateDeckWithAi,
  isNight,
  newDeckTitle,
  setNewDeckTitle,
  newDeckMode,
  setNewDeckMode,
  newDeckCategory,
  setNewDeckCategory,
  newQuestion,
  setNewQuestion,
  newHint,
  setNewHint,
  newAnswer,
  setNewAnswer,
  draftCards,
  addDraftCard,
  saveDeck,
  removeDeck,
}: {
  allDecks: Deck[];
  selectedDeck: Deck | null;
  selectedDeckId: string;
  setSelectedDeckId: (id: string) => void;
  startSession: (deck: Deck, modeToUse: StudyMode) => void;
  sessionDeck: Deck | null;
  currentCard: Flashcard | undefined;
  round: number;
  face: number;
  nextFace: number | null;
  flipping: boolean;
  sessionProgress: number;
  flipCard: () => void;
  nextCard: (unknown: boolean) => void;
  getFaceLabel: (index: number) => string;
  getFaceText: (index: number) => string;
  setFace: (index: number) => void;
  setNextFace: (index: number | null) => void;
  setFlipping: (isFlipping: boolean) => void;
  endSession: () => void;
  sessionSummary: SessionSummary | null;
  dismissSessionSummary: () => void;
  aiDeckTopic: string;
  setAiDeckTopic: (v: string) => void;
  aiDeckTitle: string;
  setAiDeckTitle: (v: string) => void;
  aiDeckCount: number;
  setAiDeckCount: (v: number) => void;
  aiDeckMode: StudyMode;
  setAiDeckMode: (v: StudyMode) => void;
  aiDeckCategory: DeckCategory;
  setAiDeckCategory: (v: DeckCategory) => void;
  aiDeckLoading: boolean;
  aiDeckError: string;
  generateDeckWithAi: () => Promise<void>;
  isNight: boolean;
  newDeckTitle: string;
  setNewDeckTitle: (v: string) => void;
  newDeckMode: StudyMode;
  setNewDeckMode: (v: StudyMode) => void;
  newDeckCategory: DeckCategory;
  setNewDeckCategory: (v: DeckCategory) => void;
  newQuestion: string;
  setNewQuestion: (v: string) => void;
  newHint: string;
  setNewHint: (v: string) => void;
  newAnswer: string;
  setNewAnswer: (v: string) => void;
  draftCards: Flashcard[];
  addDraftCard: (e: FormEvent<HTMLFormElement>) => void;
  saveDeck: () => void;
  removeDeck: (deck: Deck) => void;
}) {
  const [creatorTab, setCreatorTab] = useState<"manual" | "ai">("manual");

  return (
    <div className={cn("space-y-4", isNight ? "text-slate-100" : "text-slate-900")}>
      {sessionSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn("rounded-2xl border p-5", isNight ? "border-emerald-500/40 bg-emerald-900/30" : "border-emerald-300 bg-emerald-50")}
        >
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm uppercase tracking-[0.18em] text-emerald-500">
            Sesja zakonczona
          </motion.p>
          <motion.h3
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-semibold"
          >
            {sessionSummary.deckTitle}
          </motion.h3>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            className="mt-3 flex flex-wrap items-center gap-4 text-sm"
          >
            <p>Opanowane: {sessionSummary.mastered} / {sessionSummary.total}</p>
            <p>Rundy: {sessionSummary.rounds}</p>
          </motion.div>
          <button onClick={dismissSessionSummary} className={cn("mt-4 rounded-full px-4 py-2 text-sm", isNight ? "border border-slate-600" : "border border-slate-300")}>
            Zamknij podsumowanie
          </button>
        </motion.div>
      )}

      {!sessionDeck && (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className={cn("space-y-2 rounded-xl border p-3 shadow-sm", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/85")}>
              <p className="text-sm font-medium">Wybierz zestaw</p>
              <div className="max-h-44 space-y-1 overflow-auto">
                {allDecks.map((deck) => (
                  <div key={deck.id} className="flex gap-2">
                    <button onClick={() => setSelectedDeckId(deck.id)} className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm", selectedDeckId === deck.id ? (isNight ? "border-sky-300 bg-sky-600 text-white" : "border-slate-900 bg-slate-900 text-white") : isNight ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-white")}>{deck.title}</button>
                    <button onClick={() => removeDeck(deck)} className="rounded-lg border border-rose-200 px-2 text-rose-600">X</button>
                  </div>
                ))}
              </div>
              <button onClick={() => selectedDeck && startSession(selectedDeck, selectedDeck.preferredMode)} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/30 hover:bg-emerald-500">Start nauki</button>
            </div>

            <div className={cn("space-y-2 rounded-xl border p-3 shadow-sm", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/85")}>
              <div className="flex gap-2">
                <button onClick={() => setCreatorTab("manual")} className={cn("rounded-full px-3 py-1.5 text-xs", creatorTab === "manual" ? (isNight ? "bg-sky-600 text-white" : "bg-slate-900 text-white") : isNight ? "border border-slate-700" : "border border-slate-300")}>Nowy zestaw</button>
                <button onClick={() => setCreatorTab("ai")} className={cn("rounded-full px-3 py-1.5 text-xs", creatorTab === "ai" ? "bg-indigo-600 text-white" : isNight ? "border border-slate-700" : "border border-slate-300")}>Fiszki AI</button>
              </div>

              {creatorTab === "manual" && (
                <>
                  <input value={newDeckTitle} onChange={(e) => setNewDeckTitle(e.target.value)} placeholder="Nazwa" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newDeckMode} onChange={(e) => setNewDeckMode(e.target.value as StudyMode)} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")}><option value="two">2 strony</option><option value="three">3 strony</option></select>
                    <select value={newDeckCategory} onChange={(e) => setNewDeckCategory(e.target.value as DeckCategory)} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")}>{categoryOrder.map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <form onSubmit={addDraftCard} className="space-y-2">
                    <textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Pytanie" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
                    {newDeckMode === "three" && <textarea value={newHint} onChange={(e) => setNewHint(e.target.value)} placeholder="Podpowiedz" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />}
                    <textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} placeholder="Odpowiedz" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
                    <button type="submit" className={cn("rounded-full px-4 py-2 text-sm", isNight ? "border border-slate-700" : "border border-slate-300")}>Dodaj fiszke</button>
                  </form>
                  <p className="text-xs text-slate-500">Dodane: {draftCards.length}</p>
                  <button onClick={saveDeck} className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white">Zapisz zestaw</button>
                </>
              )}

              {creatorTab === "ai" && (
                <>
                  <input value={aiDeckTopic} onChange={(e) => setAiDeckTopic(e.target.value)} placeholder="Temat" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-indigo-200 bg-white")} />
                  <input value={aiDeckTitle} onChange={(e) => setAiDeckTitle(e.target.value)} placeholder="Nazwa zestawu" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-indigo-200 bg-white")} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={4} max={20} value={aiDeckCount} onChange={(e) => setAiDeckCount(Number(e.target.value))} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-indigo-200 bg-white")} />
                    <select value={aiDeckMode} onChange={(e) => setAiDeckMode(e.target.value as StudyMode)} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-indigo-200 bg-white")}><option value="two">2 strony</option><option value="three">3 strony</option></select>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={aiDeckCategory} onChange={(e) => setAiDeckCategory(e.target.value as DeckCategory)} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-indigo-200 bg-white")}>
                      {categoryOrder.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => void generateDeckWithAi()} disabled={aiDeckLoading} className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60">
                      {aiDeckLoading ? "Generowanie..." : "Generuj fiszki"}
                    </button>
                  </div>
                  {aiDeckError && <p className="text-xs text-rose-600">{aiDeckError}</p>}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {sessionDeck && (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{sessionDeck.title}</p>
              <p className="text-xs text-slate-500">Runda: {round}</p>
            </div>
            <button onClick={endSession} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs">Zakoncz</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-slate-900" style={{ width: `${sessionProgress}%` }} /></div>
          {currentCard && (
            <>
              <button onClick={flipCard} className="relative block h-[280px] w-full [perspective:1600px]">
                <motion.div
                  animate={{ rotateY: flipping ? 180 : 0 }}
                  transition={flipping ? { duration: 0.55, ease: "easeInOut" } : { duration: 0 }}
                  onAnimationComplete={() => {
                    if (nextFace !== null) {
                      setFace(nextFace);
                      setNextFace(null);
                      setFlipping(false);
                    }
                  }}
                  className="relative h-full w-full rounded-[1.6rem] [transform-style:preserve-3d]"
                >
                  <div className={cn("absolute inset-0 rounded-[1.6rem] border p-8 [backface-visibility:hidden]", face === 0 ? "border-slate-200 bg-white" : face === 1 ? "border-amber-300 bg-amber-200" : "border-emerald-300 bg-emerald-200")}>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{getFaceLabel(face)}</p>
                    <p className="mt-4 text-2xl text-slate-900">{getFaceText(face)}</p>
                  </div>
                  <div className={cn("absolute inset-0 rounded-[1.6rem] border p-8 [transform:rotateY(180deg)] [backface-visibility:hidden]", (nextFace ?? face) === 0 ? "border-slate-200 bg-white" : (nextFace ?? face) === 1 ? "border-amber-300 bg-amber-200" : "border-emerald-300 bg-emerald-200")}>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{getFaceLabel(nextFace ?? face)}</p>
                    <p className="mt-4 text-2xl text-slate-900">{getFaceText(nextFace ?? face)}</p>
                  </div>
                </motion.div>
              </button>
              <div className="flex justify-center gap-3">
                <button onClick={() => nextCard(true)} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm">Nie umiem</button>
                <button onClick={() => nextCard(false)} className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm text-white">Umiem</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TutorView({
  tutorSubject,
  setTutorSubject,
  tutorClass,
  setTutorClass,
  tutorStyle,
  setTutorStyle,
  tutorGrade,
  setTutorGrade,
  tutorMaxTokens,
  setTutorMaxTokens,
  tutorQuestion,
  setTutorQuestion,
  tutorMessages,
  tutorLoading,
  tutorError,
  language,
  isNight,
  askTutor,
}: {
  tutorSubject: string;
  setTutorSubject: (v: string) => void;
  tutorClass: number;
  setTutorClass: (v: number) => void;
  tutorStyle: number;
  setTutorStyle: (v: number) => void;
  tutorGrade: number;
  setTutorGrade: (v: number) => void;
  tutorMaxTokens: number;
  setTutorMaxTokens: (v: number) => void;
  tutorQuestion: string;
  setTutorQuestion: (v: string) => void;
  tutorMessages: TutorMessage[];
  tutorLoading: boolean;
  tutorError: string;
  language: SystemLanguage;
  isNight: boolean;
  askTutor: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const en = language === "en";
  return (
    <div className={cn("grid h-full gap-4 lg:grid-cols-[320px_1fr]", isNight ? "text-slate-100" : "text-slate-900")}>
      <div className={cn("space-y-3 rounded-xl border p-3 shadow-sm", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        <input value={tutorSubject} onChange={(e) => setTutorSubject(e.target.value)} placeholder="Temat" className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
        <div>
          <p className="text-xs text-slate-500">{en ? "Class" : "Klasa"}: {tutorClass}</p>
          <input type="range" min={1} max={5} value={tutorClass} onChange={(e) => setTutorClass(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{en ? "Tone" : "Profesjonalnosc"}: {tutorStyleLabel(tutorStyle)}</p>
          <input type="range" min={0} max={100} value={tutorStyle} onChange={(e) => setTutorStyle(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{en ? "Target grade" : "Docelowa ocena"}: {tutorGrade}</p>
          <input type="range" min={2} max={6} value={tutorGrade} onChange={(e) => setTutorGrade(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{en ? "Max response length" : "Maksymalna dlugosc odpowiedzi"}: {tutorMaxTokens} {en ? "tokens" : "tokenow"}</p>
          <input type="range" min={150} max={900} step={50} value={tutorMaxTokens} onChange={(e) => setTutorMaxTokens(Number(e.target.value))} className="w-full" />
        </div>
      </div>

      <div className={cn("flex h-full flex-col rounded-xl border p-3 shadow-sm", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        <div className={cn("mb-2 rounded-lg border px-3 py-2 text-xs", isNight ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-600")}>
          {en ? "Lesson topic" : "Temat lekcji"}: <span className="font-medium">{tutorSubject || (en ? "none" : "brak")}</span>
        </div>
        <div className={cn("mb-3 flex-1 space-y-2 overflow-auto rounded-lg p-3", isNight ? "bg-slate-950" : "bg-slate-50")}>
          {tutorMessages.map((m) => (
            <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-900")}>{m.content}</div>
          ))}
          {tutorMessages.length === 0 && <p className="text-sm text-slate-500">{en ? "Ask your first question." : "Zadaj pierwsze pytanie."}</p>}
          {tutorLoading && <p className="text-xs text-slate-500">{en ? "Tutor is typing..." : "Korepetytor pisze..."}</p>}
        </div>

        <form onSubmit={askTutor} className="space-y-2">
          <textarea value={tutorQuestion} onChange={(e) => setTutorQuestion(e.target.value)} rows={3} className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} placeholder={en ? "Type your question" : "Wpisz pytanie"} />
          <div className="flex items-center justify-between">
            {tutorError ? <p className="text-xs text-rose-600">{tutorError}</p> : <div />}
            <button type="submit" disabled={tutorLoading || !tutorQuestion.trim()} className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{en ? "Send" : "Wyslij"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalculatorView({
  calcTab,
  setCalcTab,
  basicExpression,
  basicResult,
  handleBasicKey,
  advancedExpression,
  expressionResult,
  handleAdvExpressionKey,
  equationInput,
  setEquationInput,
  activeCalcField,
  setActiveCalcField,
  calcFields,
  handleAdvFieldKey,
  equationResult,
  rootResult,
  geometryShape,
  setGeometryShape,
  geometryResult,
  logResult,
  isNight,
}: {
  calcTab: CalcTab;
  setCalcTab: (v: CalcTab) => void;
  basicExpression: string;
  basicResult: string;
  handleBasicKey: (token: string) => void;
  advancedExpression: string;
  expressionResult: string;
  handleAdvExpressionKey: (token: string) => void;
  equationInput: string;
  setEquationInput: React.Dispatch<React.SetStateAction<string>>;
  activeCalcField: string;
  setActiveCalcField: (v: string) => void;
  calcFields: Record<string, string>;
  handleAdvFieldKey: (token: string) => void;
  equationResult: string[];
  rootResult: string;
  geometryShape: GeometryShape;
  setGeometryShape: (v: GeometryShape) => void;
  geometryResult: string[];
  logResult: string[];
  isNight: boolean;
}) {
  const geometryFieldKeys =
    geometryShape === "kolo"
      ? ["g-r"]
      : geometryShape === "trojkat"
        ? ["g-a", "g-b", "g-c", "g-h"]
        : geometryShape === "prostokat"
          ? ["g-a", "g-b"]
          : geometryShape === "trapez"
            ? ["g-a", "g-b", "g-c", "g-d", "g-h"]
            : ["g-a", "g-b", "g-h"];

  const geometryFieldLabels: Record<string, string> = {
    "g-r": "r - promien",
    "g-a": "a - bok/podstawa",
    "g-b": "b - bok/podstawa",
    "g-c": "c - bok",
    "g-d": "d - bok",
    "g-h": "h - wysokosc",
  };

  return (
    <div className={cn("space-y-3 rounded-xl p-2", isNight ? "bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" : "bg-gradient-to-b from-slate-50 to-white text-slate-900")}>
      <div className="flex flex-wrap gap-2">
        {CALC_TABS.map((tab) => (
          <button key={tab} onClick={() => setCalcTab(tab)} className={cn("rounded-full px-3 py-1.5 text-sm", calcTab === tab ? (isNight ? "bg-sky-600 text-white" : "bg-slate-900 text-white") : "border border-slate-300")}>{CALC_TAB_LABELS[tab]}</button>
        ))}
      </div>

      {calcTab === "basic" && (
        <div className="space-y-3">
          <div className={cn("rounded-xl border p-4 text-right", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
            <p className="truncate text-sm text-slate-500">{basicExpression}</p>
            <p className="text-3xl font-semibold">{basicResult}</p>
          </div>
          <Keypad keys={["C", "DEL", "(", ")", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"]} onPress={handleBasicKey} isNight={isNight} />
        </div>
      )}

      {calcTab === "expression" && (
        <div className="space-y-3">
          <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
            <p className="truncate text-sm text-slate-500">{advancedExpression || "0"}</p>
            <p className="text-lg font-medium">{expressionResult}</p>
          </div>
          <Keypad keys={["sin(", "cos(", "tan(", "√(", "log(", "ln(", "root(", "pi", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "^", "+", "(", ")", "DEL", "C"]} onPress={handleAdvExpressionKey} isNight={isNight} />
        </div>
      )}

      {calcTab === "equation" && (
        <div className="space-y-3">
          <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Rownanie liniowe</p>
            <p className="mt-2 text-lg font-medium">{equationInput || "x="}</p>
          </div>
          <div className="space-y-1 text-sm">{equationResult.map((line) => <p key={line}>{line}</p>)}</div>
          <Keypad
            keys={["x", "(", ")", "=", "7", "8", "9", "DEL", "4", "5", "6", "+", "1", "2", "3", "-", "0", ".", "*", "/", "C"]}
            onPress={(token) => {
              if (token === "C") return setEquationInput("");
              if (token === "DEL") return setEquationInput((prev) => prev.slice(0, -1));
              if (token === "=" && equationInput.includes("=")) return;
              setEquationInput((prev) => `${prev}${token}`);
            }}
            isNight={isNight}
          />
        </div>
      )}

      {calcTab === "geometry" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {GEOMETRY_SHAPES.map((shape) => (
              <button key={shape} onClick={() => setGeometryShape(shape)} className={cn("rounded-full px-3 py-1.5 text-sm", geometryShape === shape ? (isNight ? "bg-sky-600 text-white" : "bg-slate-900 text-white") : "border border-slate-300")}>{SHAPE_LABELS[shape]}</button>
            ))}
          </div>
          <p className="text-xs text-slate-400">Wybrana figura: {SHAPE_LABELS[geometryShape]}. Uzupelnij wartosci i klikaj kafelki, aby je edytowac.</p>
          <div className="grid grid-cols-3 gap-2">
            {geometryFieldKeys.map((field) => (
              <FieldTile key={field} label={geometryFieldLabels[field] ?? field} value={calcFields[field] ?? ""} active={activeCalcField === field} onClick={() => setActiveCalcField(field)} isNight={isNight} />
            ))}
          </div>
          <div className="space-y-1 text-sm">{geometryResult.map((line) => <p key={line}>{line}</p>)}</div>
          <Keypad keys={["7", "8", "9", "DEL", "4", "5", "6", "+/-", "1", "2", "3", ".", "0", "C"]} onPress={handleAdvFieldKey} isNight={isNight} />
        </div>
      )}

      {calcTab === "log" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <FieldTile label="x - liczba pod pierwiastkiem" value={calcFields["root-x"] ?? ""} active={activeCalcField === "root-x"} onClick={() => setActiveCalcField("root-x")} isNight={isNight} />
            <FieldTile label="n - stopien pierwiastka" value={calcFields["root-n"] ?? ""} active={activeCalcField === "root-n"} onClick={() => setActiveCalcField("root-n")} isNight={isNight} />
          </div>
          <p className="text-sm">{rootResult}</p>
          <div className="grid grid-cols-2 gap-2">
            <FieldTile label="podstawa" value={calcFields["log-base"] ?? ""} active={activeCalcField === "log-base"} onClick={() => setActiveCalcField("log-base")} isNight={isNight} />
            <FieldTile label="wartosc" value={calcFields["log-value"] ?? ""} active={activeCalcField === "log-value"} onClick={() => setActiveCalcField("log-value")} isNight={isNight} />
          </div>
          <div className="space-y-1 text-sm">{logResult.map((line) => <p key={line}>{line}</p>)}</div>
          <Keypad keys={["7", "8", "9", "DEL", "4", "5", "6", "+/-", "1", "2", "3", ".", "0", "C"]} onPress={handleAdvFieldKey} isNight={isNight} />
        </div>
      )}
    </div>
  );
}

function NotanikView({
  notes,
  activeNote,
  noteDraftTitle,
  setNoteDraftTitle,
  noteDraftContent,
  setNoteDraftContent,
  noteAiPrompt,
  setNoteAiPrompt,
  noteAiLoading,
  noteAiError,
  createBlankNote,
  openSavedNote,
  deleteNote,
  leaveNote,
  saveActiveNote,
  runNoteAi,
  runImageAi,
  imageAiLoading,
  imageAiError,
  isNight,
}: {
  notes: NoteDoc[];
  activeNote: NoteDoc | null;
  noteDraftTitle: string;
  setNoteDraftTitle: React.Dispatch<React.SetStateAction<string>>;
  noteDraftContent: string;
  setNoteDraftContent: React.Dispatch<React.SetStateAction<string>>;
  noteAiPrompt: string;
  setNoteAiPrompt: (v: string) => void;
  noteAiLoading: boolean;
  noteAiError: string;
  createBlankNote: () => void;
  openSavedNote: (id: string) => void;
  deleteNote: (id: string) => void;
  leaveNote: () => void;
  saveActiveNote: () => void;
  runNoteAi: (mode: "verify" | "extend") => Promise<void>;
  runImageAi: (mode: "describe" | "transcribe") => Promise<void>;
  imageAiLoading: boolean;
  imageAiError: string;
  isNight: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [textColor, setTextColor] = useState("#111827");
  const [selectedImageWidth, setSelectedImageWidth] = useState(100);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const panel = isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90";

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== noteDraftContent) {
      editorRef.current.innerHTML = noteDraftContent || "<p><br/></p>";
    }
  }, [activeNote?.id, noteDraftContent]);

  function applyCmd(command: string, value?: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setNoteDraftContent(editorRef.current.innerHTML);
  }

  function insertTable() {
    const table =
      "<table style='width:100%;border-collapse:collapse;margin:8px 0'><thead><tr><th style='border:1px solid #94a3b8;padding:6px'>Naglowek 1</th><th style='border:1px solid #94a3b8;padding:6px'>Naglowek 2</th></tr></thead><tbody><tr><td style='border:1px solid #94a3b8;padding:6px'>Wiersz 1</td><td style='border:1px solid #94a3b8;padding:6px'>Wiersz 1</td></tr><tr><td style='border:1px solid #94a3b8;padding:6px'>Wiersz 2</td><td style='border:1px solid #94a3b8;padding:6px'>Wiersz 2</td></tr></tbody></table><p><br/></p>";
    applyCmd("insertHTML", table);
  }

  function insertList(ordered: boolean) {
    applyCmd(ordered ? "insertOrderedList" : "insertUnorderedList");
    if (!editorRef.current?.querySelector("ol,ul")) {
      applyCmd("insertHTML", ordered ? "<ol><li>Nowy punkt</li></ol><p><br/></p>" : "<ul><li>Nowy punkt</li></ul><p><br/></p>");
    }
  }

  function keepToolbarFocus(e: React.MouseEvent) {
    e.preventDefault();
    editorRef.current?.focus();
  }

  function rememberSelectedImage(target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) return;
    selectedImageRef.current = target;
    const inline = target.style.width.replace("%", "");
    const parsed = Number(inline || 100);
    if (!Number.isNaN(parsed) && parsed > 0) setSelectedImageWidth(Math.max(20, Math.min(100, parsed)));
  }

  function applyImageScale(nextWidth: number) {
    const img = selectedImageRef.current;
    if (!img) return;
    const safeWidth = Math.max(20, Math.min(100, nextWidth));
    img.style.width = `${safeWidth}%`;
    img.style.height = "auto";
    setSelectedImageWidth(safeWidth);
    if (editorRef.current) setNoteDraftContent(editorRef.current.innerHTML);
  }

  return (
    <div className={cn("h-full space-y-3", isNight ? "text-slate-100" : "text-slate-900")}>
      {!activeNote && (
        <div className={cn("grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_1fr]", panel)}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Notanik</h3>
            <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>Wybierz jak chcesz rozpoczac prace.</p>
            <motion.button {...BUTTON_MOTION} onClick={createBlankNote} className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white">Pusty arkusz</motion.button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Wczytaj zapisany dokument</p>
            <div className="max-h-44 space-y-2 overflow-auto">
              {notes.length === 0 && <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>Brak zapisanych dokumentow.</p>}
              {notes.map((note) => (
                <div key={note.id} className="flex items-center gap-2">
                  <button onClick={() => openSavedNote(note.id)} className={cn("block w-full rounded-lg border px-3 py-2 text-left text-sm transition-transform hover:-translate-y-0.5 active:scale-95", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")}>
                    <p className="font-medium">{note.title}</p>
                    <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{new Date(note.updatedAt).toLocaleString()}</p>
                  </button>
                  <button onClick={() => deleteNote(note.id)} className="rounded-md border border-rose-400/60 px-2 py-2 text-xs text-rose-500 transition-transform hover:-translate-y-0.5 active:scale-95">Usun</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeNote && (
        <div className={cn("h-full rounded-xl border", panel)}>
          <div className={cn("flex flex-wrap items-center gap-2 border-b px-3 py-2", isNight ? "border-slate-700" : "border-slate-200")}>
            <input
              value={noteDraftTitle}
              onChange={(e) => setNoteDraftTitle(e.target.value)}
              className={cn("min-w-52 rounded-md border px-3 py-1.5 text-sm", isNight ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-white")}
              placeholder="Tytul dokumentu"
            />
            <motion.button {...BUTTON_MOTION} onClick={saveActiveNote} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">Zapisz</motion.button>
            <motion.button {...BUTTON_MOTION} onClick={createBlankNote} className={cn("rounded-md border px-3 py-1.5 text-sm", isNight ? "border-slate-600" : "border-slate-300")}>Nowy</motion.button>
            <motion.button {...BUTTON_MOTION} onClick={() => activeNote && deleteNote(activeNote.id)} className="rounded-md border border-rose-400/60 px-3 py-1.5 text-sm text-rose-500">Usun</motion.button>
            <motion.button {...BUTTON_MOTION} onClick={leaveNote} className={cn("rounded-md border px-3 py-1.5 text-sm", isNight ? "border-slate-600" : "border-slate-300")}>Wroc do wyboru</motion.button>
            <div className="ml-auto flex items-center gap-2">
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("bold")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>B</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("italic")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>I</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("underline")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>U</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => insertList(false)} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>Lista</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => insertList(true)} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>1.</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={insertTable} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>Tabela</motion.button>
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  const next = e.target.value;
                  setTextColor(next);
                  applyCmd("foreColor", next);
                }}
                className="h-8 w-10 rounded border border-slate-500 bg-transparent p-0.5"
                title="Kolor tekstu"
              />
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("justifyLeft")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>L</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("justifyCenter")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>C</motion.button>
              <motion.button {...BUTTON_MOTION} onMouseDown={keepToolbarFocus} onClick={() => applyCmd("justifyRight")} className={cn("rounded-md border px-2 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>R</motion.button>
              <div className={cn("flex items-center gap-2 rounded-md border px-2 py-1", isNight ? "border-slate-600" : "border-slate-300")}>
                <span className="text-[10px] opacity-70">IMG</span>
                <input type="range" min={20} max={100} value={selectedImageWidth} onChange={(e) => applyImageScale(Number(e.target.value))} className="w-24" />
              </div>
              <motion.button {...BUTTON_MOTION} onClick={() => setAiPanelOpen((v) => !v)} className={cn("rounded-md px-3 py-1 text-xs font-semibold shadow-sm", aiPanelOpen ? "bg-sky-600 text-white shadow-sky-300/40" : isNight ? "bg-indigo-700 text-white" : "bg-indigo-600 text-white")} title="Asystent AI">AI Panel</motion.button>
            </div>
          </div>

          <div className={cn("grid h-[calc(100%-46px)] gap-3 p-3", aiPanelOpen ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-1")}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setNoteDraftContent((e.currentTarget as HTMLDivElement).innerHTML)}
              onClick={(e) => rememberSelectedImage(e.target)}
              className={cn("h-full w-full overflow-auto rounded-lg border p-4 text-[15px] leading-7 outline-none", isNight ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900")}
            />

            {aiPanelOpen && <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={cn("space-y-2 rounded-lg border p-3", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
              <p className="text-sm font-semibold">Asystent AI</p>
              <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>AI moze poprawic lub rozwinac tresc dokumentu na podstawie Twojego profilu.</p>
              <textarea
                value={noteAiPrompt}
                onChange={(e) => setNoteAiPrompt(e.target.value)}
                rows={3}
                placeholder="Np. dopisz podsumowanie i 3 wnioski"
                className={cn("w-full rounded-md border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white")}
              />
              <div className="flex flex-wrap gap-2">
                <motion.button {...BUTTON_MOTION} onClick={() => void runNoteAi("verify")} disabled={noteAiLoading} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">Zweryfikuj</motion.button>
                <motion.button {...BUTTON_MOTION} onClick={() => void runNoteAi("extend")} disabled={noteAiLoading} className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50">Dopisz</motion.button>
              </div>
              <div className={cn("mt-2 rounded-lg border p-2", isNight ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white")}>
                <p className="text-xs font-semibold">AI dla obrazu z notatki</p>
                <p className={cn("mt-1 text-xs", isNight ? "text-slate-400" : "text-slate-500")}>Najpierw wklej obraz do notatki. AI wezmie pierwszy obraz z dokumentu.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <motion.button {...BUTTON_MOTION} onClick={() => void runImageAi("transcribe")} disabled={imageAiLoading} className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white disabled:opacity-50">Transkrypcja obrazu</motion.button>
                  <motion.button {...BUTTON_MOTION} onClick={() => void runImageAi("describe")} disabled={imageAiLoading} className="rounded-md bg-violet-600 px-3 py-2 text-xs text-white disabled:opacity-50">Opis obrazu</motion.button>
                </div>
                {imageAiError && <p className="mt-1 text-xs text-rose-500">{imageAiError}</p>}
              </div>
              {noteAiLoading && <p className="text-xs text-slate-400">AI analizuje dokument...</p>}
              {noteAiError && <p className="text-xs text-rose-500">{noteAiError}</p>}
            </motion.div>}
          </div>
        </div>
      )}
    </div>
  );
}

function DesignerView({
  shapes,
  selectedShapeId,
  setSelectedShapeId,
  addShape,
  updateSelectedShape,
  removeSelectedShape,
  clearAllShapes,
  sketchGrid,
  setSketchGrid,
  sketchPrompt,
  setSketchPrompt,
  sketchAiBusy,
  sketchAiError,
  generateSketchWithAi,
  isNight,
}: {
  shapes: SketchShape[];
  selectedShapeId: string | null;
  setSelectedShapeId: (v: string | null) => void;
  addShape: (type: SketchShape["type"]) => void;
  updateSelectedShape: (patch: Partial<SketchShape>) => void;
  removeSelectedShape: () => void;
  clearAllShapes: () => void;
  sketchGrid: boolean;
  setSketchGrid: (v: boolean) => void;
  sketchPrompt: string;
  setSketchPrompt: (v: string) => void;
  sketchAiBusy: boolean;
  sketchAiError: string;
  generateSketchWithAi: () => Promise<void>;
  isNight: boolean;
}) {
  const selected = shapes.find((shape) => shape.id === selectedShapeId) || null;

  return (
    <div className={cn("grid h-full gap-3 lg:grid-cols-[320px_1fr]", isNight ? "text-slate-100" : "text-slate-900")}>
      <aside className={cn("space-y-3 rounded-xl border p-3", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        <p className="text-sm font-semibold">TechSketch</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => addShape("rect")} className={cn("rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>+ Prostokat</button>
          <button onClick={() => addShape("circle")} className={cn("rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>+ Kolo</button>
          <button onClick={() => addShape("line")} className={cn("rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>+ Linia</button>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sketchGrid} onChange={(e) => setSketchGrid(e.target.checked)} />
          Siatka techniczna
        </label>

        {selected ? (
          <div className={cn("space-y-2 rounded-lg border p-2", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
            <p className="text-xs font-semibold">Edycja: {selected.label || selected.type}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>X<input value={selected.x} onChange={(e) => updateSelectedShape({ x: Number(e.target.value) || 0 })} className={cn("mt-1 w-full rounded border px-2 py-1", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} /></label>
              <label>Y<input value={selected.y} onChange={(e) => updateSelectedShape({ y: Number(e.target.value) || 0 })} className={cn("mt-1 w-full rounded border px-2 py-1", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} /></label>
              <label>W<input value={selected.w} onChange={(e) => updateSelectedShape({ w: Number(e.target.value) || 1 })} className={cn("mt-1 w-full rounded border px-2 py-1", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} /></label>
              <label>H<input value={selected.h} onChange={(e) => updateSelectedShape({ h: Number(e.target.value) || 1 })} className={cn("mt-1 w-full rounded border px-2 py-1", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} /></label>
            </div>
            <input value={selected.label || ""} onChange={(e) => updateSelectedShape({ label: e.target.value })} placeholder="Etykieta" className={cn("w-full rounded border px-2 py-1 text-xs", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} />
            <div className="flex gap-2">
              <button onClick={removeSelectedShape} className="rounded border border-rose-400/60 px-3 py-1 text-xs text-rose-500">Usun</button>
              <button onClick={() => setSelectedShapeId(null)} className={cn("rounded border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>Odznacz</button>
            </div>
          </div>
        ) : (
          <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>Wybierz element na planszy, aby edytowac parametry.</p>
        )}

        <div className={cn("space-y-2 rounded-lg border p-2", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
          <p className="text-xs font-semibold">Generowanie konceptu AI</p>
          <textarea value={sketchPrompt} onChange={(e) => setSketchPrompt(e.target.value)} rows={3} placeholder="Np. plan malego biura z recepcja i 3 stanowiskami" className={cn("w-full rounded border px-2 py-1 text-xs", isNight ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")} />
          <button disabled={sketchAiBusy} onClick={() => void generateSketchWithAi()} className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{sketchAiBusy ? "Generowanie..." : "Wygeneruj projekt AI"}</button>
          {sketchAiError && <p className="text-xs text-rose-500">{sketchAiError}</p>}
          <button onClick={clearAllShapes} className={cn("rounded border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>Wyczysc plansze</button>
        </div>
      </aside>

      <section className={cn("rounded-xl border p-3", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        <div className={cn("relative h-[560px] w-full overflow-hidden rounded-lg border", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
          {sketchGrid && (
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage: "linear-gradient(to right, rgba(148,163,184,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.25) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          )}
          <svg viewBox="0 0 940 580" className="relative z-10 h-full w-full">
            {shapes.map((shape) => {
              const active = shape.id === selectedShapeId;
              if (shape.type === "rect") {
                return (
                  <g key={shape.id} onClick={() => setSelectedShapeId(shape.id)}>
                    <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={shape.fill} stroke={active ? "#2563eb" : shape.stroke} strokeWidth={active ? 3 : 2} />
                    {shape.label ? <text x={shape.x + 6} y={shape.y + 16} fontSize="12" fill={isNight ? "#e2e8f0" : "#0f172a"}>{shape.label}</text> : null}
                  </g>
                );
              }
              if (shape.type === "circle") {
                return (
                  <g key={shape.id} onClick={() => setSelectedShapeId(shape.id)}>
                    <ellipse cx={shape.x + shape.w / 2} cy={shape.y + shape.h / 2} rx={Math.max(8, shape.w / 2)} ry={Math.max(8, shape.h / 2)} fill={shape.fill} stroke={active ? "#2563eb" : shape.stroke} strokeWidth={active ? 3 : 2} />
                    {shape.label ? <text x={shape.x + 6} y={shape.y + 16} fontSize="12" fill={isNight ? "#e2e8f0" : "#0f172a"}>{shape.label}</text> : null}
                  </g>
                );
              }
              return (
                <g key={shape.id} onClick={() => setSelectedShapeId(shape.id)}>
                  <line x1={shape.x} y1={shape.y} x2={shape.x + shape.w} y2={shape.y + Math.max(0, shape.h)} stroke={active ? "#2563eb" : shape.stroke} strokeWidth={active ? 3 : 2} />
                  {shape.label ? <text x={shape.x + 6} y={shape.y - 6} fontSize="12" fill={isNight ? "#e2e8f0" : "#0f172a"}>{shape.label}</text> : null}
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </div>
  );
}

function CloudView({
  files,
  onlineFiles,
  activeFileId,
  setActiveFileId,
  onAddFiles,
  onRemoveFile,
  onImportTextToNotes,
  onImportImageToNotes,
  onSaveOnlineVault,
  onLoadOnlineVault,
  onDownloadFile,
  onlineSyncCode,
  setOnlineSyncCode,
  onlineAccessCode,
  setOnlineAccessCode,
  onlineCloudBusy,
  onlineCloudError,
  language,
  isNight,
}: {
  files: CloudFileRecord[];
  onlineFiles: CloudFileRecord[];
  activeFileId: string | null;
  setActiveFileId: (id: string | null) => void;
  onAddFiles: (files: FileList | null) => Promise<void>;
  onRemoveFile: (id: string) => void;
  onImportTextToNotes: (file: CloudFileRecord) => void;
  onImportImageToNotes: (file: CloudFileRecord) => void;
  onSaveOnlineVault: () => Promise<void>;
  onLoadOnlineVault: () => Promise<void>;
  onDownloadFile: (file: CloudFileRecord) => void;
  onlineSyncCode: string;
  setOnlineSyncCode: (v: string) => void;
  onlineAccessCode: string;
  setOnlineAccessCode: (v: string) => void;
  onlineCloudBusy: boolean;
  onlineCloudError: string;
  language: SystemLanguage;
  isNight: boolean;
}) {
  const en = language === "en";
  const active = files.find((f) => f.id === activeFileId) ?? files[0] ?? null;
  const [tab, setTab] = useState<"local" | "online">("local");

  return (
    <div className={cn("space-y-3", isNight ? "text-slate-100" : "text-slate-900")}>
      <div className="flex gap-2">
        <motion.button {...BUTTON_MOTION} onClick={() => setTab("local")} className={cn("rounded-full px-3 py-1.5 text-xs", tab === "local" ? "bg-sky-600 text-white" : isNight ? "border border-slate-700" : "border border-slate-300")}>{en ? "Local cloud" : "Chmura lokalna"}</motion.button>
        <motion.button {...BUTTON_MOTION} onClick={() => setTab("online")} className={cn("rounded-full px-3 py-1.5 text-xs", tab === "online" ? "bg-indigo-600 text-white" : isNight ? "border border-slate-700" : "border border-slate-300")}>{en ? "Online vault" : "Chmura online"}</motion.button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "local" ? (
          <motion.div key="cloud-local" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={cn("grid h-full gap-3 lg:grid-cols-[320px_1fr]")}>
            <aside className={cn("space-y-3 rounded-xl border p-3", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
              <label className={cn("block cursor-pointer rounded-lg border px-3 py-2 text-center text-sm", isNight ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-slate-50")}>
                {en ? "Upload files" : "Dodaj pliki"}
                <input
                  type="file"
                  multiple
                  accept="text/*,image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    void onAddFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {files.length === 0 && <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>{en ? "No files yet" : "Brak plikow"}</p>}
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm",
                      active?.id === file.id
                        ? isNight
                          ? "border-sky-300 bg-sky-700/40"
                          : "border-slate-900 bg-slate-100"
                        : isNight
                          ? "border-slate-700 bg-slate-800"
                          : "border-slate-200 bg-white"
                    )}
                  >
                    <p className="truncate font-medium">{file.name}</p>
                    <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{file.kind.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className={cn("rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
              {!active && <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>{en ? "Select a file to preview" : "Wybierz plik aby zobaczyc podglad"}</p>}
              {active && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{active.name}</h3>
                      <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{active.mime} • {(active.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <motion.button {...BUTTON_MOTION} onClick={() => onDownloadFile(active)} className="rounded-full border border-slate-400/50 px-3 py-1.5 text-xs">{en ? "Download" : "Pobierz"}</motion.button>
                      {active.kind === "text" && <motion.button {...BUTTON_MOTION} onClick={() => onImportTextToNotes(active)} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{en ? "Import to Notebook" : "Przenies do Notatnika"}</motion.button>}
                      {active.kind === "image" && <motion.button {...BUTTON_MOTION} onClick={() => onImportImageToNotes(active)} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{en ? "Paste image to note" : "Wklej obraz do notatki"}</motion.button>}
                      <motion.button {...BUTTON_MOTION} onClick={() => onRemoveFile(active.id)} className="rounded-full border border-rose-400/60 px-3 py-1.5 text-xs text-rose-500">{en ? "Delete file" : "Usun plik"}</motion.button>
                    </div>
                  </div>

                  {active.kind === "text" && (
                    <pre className={cn("max-h-[440px] overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
                      {active.textContent || ""}
                    </pre>
                  )}

                  {active.kind === "image" && active.dataUrl && (
                    <>
                      <div className={cn("rounded-lg border p-2", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
                        <img src={active.dataUrl} alt={active.name} className="max-h-[460px] w-full rounded object-contain" />
                      </div>
                    </>
                  )}

                  {active.kind === "video" && active.dataUrl && (
                    <div className={cn("rounded-lg border p-2", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
                      <video src={active.dataUrl} controls className="max-h-[460px] w-full rounded" />
                    </div>
                  )}

                  {active.kind === "audio" && active.dataUrl && (
                    <div className={cn("rounded-lg border p-3", isNight ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50")}>
                      <audio src={active.dataUrl} controls className="w-full" />
                    </div>
                  )}

                  {active.kind === "other" && <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>{en ? "Preview is available for text, image, video and audio files." : "Podglad dostepny dla plikow tekstowych, obrazow, wideo i audio."}</p>}
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.div key="cloud-online" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={cn("rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{en ? "Encrypted online vault" : "Szyfrowana chmura online"}</p>
                <input type="password" value={onlineAccessCode} onChange={(e) => setOnlineAccessCode(e.target.value)} placeholder={en ? "Access code" : "Kod dostepu"} className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
                <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{en ? "Access code encrypts files. For loading, full sync code is enough (or vault id + this code)." : "Kod dostepu szyfruje pliki. Do wczytania wystarczy pelny kod synchronizacji (lub samo ID + ten kod)."}</p>
                <div className="flex gap-2">
                  <motion.button {...BUTTON_MOTION} disabled={onlineCloudBusy} onClick={() => void onSaveOnlineVault()} className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{en ? "Save encrypted vault" : "Zapisz zaszyfrowana chmure"}</motion.button>
                  <motion.button {...BUTTON_MOTION} disabled={onlineCloudBusy} onClick={() => void onLoadOnlineVault()} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{en ? "Load by sync code" : "Wczytaj po kodzie"}</motion.button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{en ? "Sync code (use on any computer)" : "Kod synchronizacji (dziala na dowolnym komputerze)"}</p>
                <textarea value={onlineSyncCode} onChange={(e) => setOnlineSyncCode(e.target.value)} rows={4} className={cn("w-full rounded-lg border px-3 py-2 text-xs font-mono", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")} />
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(onlineSyncCode)} className={cn("rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>{en ? "Copy code" : "Kopiuj kod"}</button>
                  <button onClick={() => setOnlineSyncCode(onlineSyncCode.trim())} className={cn("rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>{en ? "Trim spaces" : "Usun spacje"}</button>
                </div>
                {onlineCloudError && <p className="text-xs text-rose-500">{onlineCloudError}</p>}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">{en ? "Files in online vault" : "Pliki w chmurze online"}</p>
              <div className="max-h-[380px] space-y-2 overflow-auto">
                {onlineFiles.length === 0 && <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>{en ? "No online files loaded" : "Brak wczytanych plikow online"}</p>}
                {onlineFiles.map((file) => (
                  <div key={file.id} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{file.kind.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button {...BUTTON_MOTION} onClick={() => onDownloadFile(file)} className="rounded-full border border-slate-400/60 px-3 py-1 text-xs">{en ? "Download" : "Pobierz"}</motion.button>
                      {file.kind === "text" && <motion.button {...BUTTON_MOTION} onClick={() => onImportTextToNotes(file)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">{en ? "Import" : "Import"}</motion.button>}
                      {file.kind === "image" && <motion.button {...BUTTON_MOTION} onClick={() => onImportImageToNotes(file)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">{en ? "Paste" : "Wklej"}</motion.button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppMarketView({
  installedApps,
  installApp,
  uninstallApp,
  openApp,
  language,
  isNight,
}: {
  installedApps: AppId[];
  installApp: (id: AppId) => void;
  uninstallApp: (id: AppId) => void;
  openApp: (id: AppId) => boolean;
  language: SystemLanguage;
  isNight: boolean;
}) {
  const marketApps = Object.keys(MARKET_META) as Array<Exclude<AppId, "market" | "settings">>;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Wszystkie" | "Nauka" | "Narzedzia" | "Produktywnosc">("Wszystkie");
  const [activeApp, setActiveApp] = useState<Exclude<AppId, "market" | "settings"> | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const cardStyle = isNight ? "border-slate-700 bg-slate-900/70 text-slate-100" : "border-slate-200 bg-white/90 text-slate-900";

  const filteredApps = marketApps.filter((appId) => {
    const meta = MARKET_META[appId];
    const label = appLabel(appId, language).toLowerCase();
    const desc = (language === "en" ? meta.descriptionEn : meta.descriptionPl).toLowerCase();
    const queryMatch = !query.trim() || label.includes(query.toLowerCase()) || desc.includes(query.toLowerCase());
    const categoryMatch = category === "Wszystkie" || meta.category === category;
    return queryMatch && categoryMatch;
  });

  const popularityStars = (score: number) => Math.max(1, Math.min(5, Math.round(score / 20)));

  function startDownload(id: Exclude<AppId, "market" | "settings">) {
    if (installedApps.includes(id)) return;
    setDownloadProgress((prev) => ({ ...prev, [id]: 1 }));
    let progress = 1;
    const timer = setInterval(() => {
      progress += Math.floor(Math.random() * 22) + 8;
      if (progress >= 100) {
        clearInterval(timer);
        setDownloadProgress((prev) => ({ ...prev, [id]: 100 }));
        installApp(id);
        setTimeout(() => {
          setDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 650);
        return;
      }
      setDownloadProgress((prev) => ({ ...prev, [id]: progress }));
    }, 160);
  }

  return (
    <div className="space-y-4">
      {activeApp ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-xl border p-5", cardStyle)}>
          <button onClick={() => setActiveApp(null)} className={cn("mb-4 rounded-full border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>
            {language === "en" ? "Back to market" : "Powrot do marketu"}
          </button>
          <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
            <div className={cn("rounded-xl border p-4 text-center", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
              <span className={cn("mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl", isNight ? "bg-slate-700" : "bg-white")}>
                <AppIcon id={activeApp} />
              </span>
              <p className="font-semibold">{appLabel(activeApp, language)}</p>
              <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{categoryLabel(MARKET_META[activeApp].category, language)}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xl font-semibold">{appLabel(activeApp, language)}</h4>
              <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{language === "en" ? MARKET_META[activeApp].descriptionEn : MARKET_META[activeApp].descriptionPl}</p>
              <p className="text-sm">{language === "en" ? "Popularity" : "Popularnosc"}: {"★".repeat(popularityStars(MARKET_META[activeApp].popularity))}{"☆".repeat(5 - popularityStars(MARKET_META[activeApp].popularity))}</p>
              {(downloadProgress[activeApp] ?? 0) > 0 && (downloadProgress[activeApp] ?? 0) < 100 ? (
                <div>
                  <p className={cn("mb-1 text-xs", isNight ? "text-slate-300" : "text-slate-600")}>{language === "en" ? "Downloading" : "Pobieranie"}: {downloadProgress[activeApp]}%</p>
                  <div className={cn("h-2 rounded-full", isNight ? "bg-slate-700" : "bg-slate-200")}>
                    <motion.div animate={{ width: `${downloadProgress[activeApp]}%` }} className="h-full rounded-full bg-emerald-500" />
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                {!installedApps.includes(activeApp) && <motion.button {...BUTTON_MOTION} onClick={() => startDownload(activeApp)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{language === "en" ? "Install app" : "Pobierz aplikacje"}</motion.button>}
                {installedApps.includes(activeApp) && <motion.button {...BUTTON_MOTION} onClick={() => openApp(activeApp)} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{language === "en" ? "Open app" : "Otworz aplikacje"}</motion.button>}
                {installedApps.includes(activeApp) && <motion.button {...BUTTON_MOTION} onClick={() => uninstallApp(activeApp)} className="rounded-full border border-rose-400/60 px-4 py-2 text-sm text-rose-500">{language === "en" ? "Remove app" : "Usun aplikacje"}</motion.button>}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-semibold">EduMarket</h3>
            <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{language === "en" ? "Browse apps, open details, and install with persistent library." : "Przegladaj aplikacje, otwieraj ich strony i pobieraj je na stale."}</p>
          </div>

          <div className={cn("rounded-xl border p-3", cardStyle)}>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={language === "en" ? "Search apps" : "Szukaj aplikacji"}
                className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-white")}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value as "Wszystkie" | "Nauka" | "Narzedzia" | "Produktywnosc")} className={cn("rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-white")}>
                <option value="Wszystkie">{language === "en" ? "All categories" : "Wszystkie kategorie"}</option>
                <option value="Nauka">{language === "en" ? "Learning" : "Nauka"}</option>
                <option value="Narzedzia">{language === "en" ? "Tools" : "Narzedzia"}</option>
                <option value="Produktywnosc">{language === "en" ? "Productivity" : "Produktywnosc"}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredApps.map((appId) => {
              const installed = installedApps.includes(appId);
              const progress = downloadProgress[appId] ?? 0;
              const downloading = progress > 0 && progress < 100;
              const meta = MARKET_META[appId];
              return (
                <motion.button key={appId} {...BUTTON_MOTION} onClick={() => setActiveApp(appId)} className={cn("space-y-3 rounded-xl border p-4 text-left", cardStyle)}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", isNight ? "bg-slate-800" : "bg-slate-100")}>
                      <AppIcon id={appId} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{appLabel(appId, language)}</p>
                      <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>{categoryLabel(meta.category, language)}</p>
                    </div>
                  </div>
                  <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-600")}>{language === "en" ? meta.descriptionEn : meta.descriptionPl}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>{"★".repeat(popularityStars(meta.popularity))}{"☆".repeat(5 - popularityStars(meta.popularity))}</span>
                    <span>{installed ? (language === "en" ? "Installed" : "Pobrana") : (downloading ? `${language === "en" ? "Downloading" : "Pobieranie"} ${progress}%` : language === "en" ? "Not installed" : "Niepobrana")}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SettingsView({ profile, setProfile, ui, setUi, tutorApiKey, setTutorApiKey, language, isNight, reopenSetup, openCmd }: { profile: Profile; setProfile: React.Dispatch<React.SetStateAction<Profile>>; ui: UiSettings; setUi: React.Dispatch<React.SetStateAction<UiSettings>>; tutorApiKey: string; setTutorApiKey: (v: string) => void; language: SystemLanguage; isNight: boolean; reopenSetup: () => void; openCmd: () => void }) {
  const [section, setSection] = useState<"system" | "personalizacja" | "konto" | "pomoc">("system");
  const muted = isNight ? "text-slate-300" : "text-slate-600";
  const en = language === "en";

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[260px_1fr]", isNight ? "text-slate-100" : "text-slate-900")}>
      <aside className={cn("rounded-xl border p-3", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">{en ? "Navigation" : "Nawigacja"}</p>
        <div className="space-y-1 text-sm">
          <button onClick={() => setSection("system")} className={cn("w-full rounded-md px-3 py-2 text-left", section === "system" ? (isNight ? "bg-slate-800" : "bg-slate-100") : "")}>{en ? "System" : "System"}</button>
          <button onClick={() => setSection("personalizacja")} className={cn("w-full rounded-md px-3 py-2 text-left", section === "personalizacja" ? (isNight ? "bg-slate-800" : "bg-slate-100") : "")}>{en ? "Personalization" : "Personalizacja"}</button>
          <button onClick={() => setSection("konto")} className={cn("w-full rounded-md px-3 py-2 text-left", section === "konto" ? (isNight ? "bg-slate-800" : "bg-slate-100") : "")}>{en ? "Account" : "Konta"}</button>
          <button onClick={() => setSection("pomoc")} className={cn("w-full rounded-md px-3 py-2 text-left", section === "pomoc" ? (isNight ? "bg-slate-800" : "bg-slate-100") : "")}>{en ? "Help" : "Pomoc"}</button>
        </div>
      </aside>
      <section className={cn("space-y-4 rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90")}>
        {section === "system" && (
          <>
            <h3 className="text-lg font-semibold">{en ? "System settings" : "Ustawienia systemu"}</h3>
            <div className={cn("rounded-xl border p-3 text-sm", isNight ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-600")}>{en ? "Developer tools and setup reset." : "Narzedzia deweloperskie i reset konfiguracji."}</div>
            <button onClick={openCmd} className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white">{en ? "Open CMD" : "Uruchom CMD"}</button>
            <button onClick={reopenSetup} className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">{en ? "Run setup" : "Uruchom konfigurator"}</button>
          </>
        )}

        {section === "personalizacja" && (
          <>
            <h3 className="text-lg font-semibold">{en ? "Personalization" : "Personalizacja"}</h3>
            <p className={cn("text-sm", muted)}>{en ? "System language" : "Jezyk systemu"}</p>
            <div className="flex gap-2">
              {([
                { id: "pl", label: "Polski" },
                { id: "en", label: "English" },
              ] as const).map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setUi((prev) => ({ ...prev, language: lang.id }))}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm",
                    ui.language === lang.id
                      ? isNight
                        ? "border-sky-300 bg-sky-600 text-white"
                        : "border-slate-900 bg-slate-900 text-white"
                      : isNight
                        ? "border-slate-600 bg-slate-800 text-slate-100"
                        : "border-slate-300 bg-white text-slate-900"
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <p className={cn("text-sm", muted)}>{en ? "System theme" : "Motyw systemu"}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_IDS.map((themeId) => (
                <motion.button
                  key={themeId}
                  {...BUTTON_MOTION}
                  onClick={() => setUi((prev) => ({ ...prev, theme: themeId }))}
                  className={cn(
                    "rounded-xl border p-3 text-left",
                    ui.theme === themeId
                      ? isNight
                        ? "border-white bg-slate-800"
                        : "border-slate-900 bg-white"
                      : isNight
                        ? "border-slate-700 bg-slate-900"
                        : "border-slate-300 bg-white"
                  )}
                >
                  <div className="flex gap-1">{themePreview[themeId].map((c) => <span key={c} className="h-8 w-full rounded-md" style={{ backgroundColor: c }} />)}</div>
                  <p className="mt-2 text-sm font-medium">{themeId}</p>
                </motion.button>
              ))}
            </div>

            <p className={cn("text-sm", muted)}>{en ? "System font" : "Czcionka systemowa"}</p>
            <div className="flex flex-wrap gap-2">
              {FONT_IDS.map((font) => (
                <button
                  key={font}
                  onClick={() => setUi((prev) => ({ ...prev, font }))}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm",
                    ui.font === font
                      ? isNight
                        ? "border-sky-300 bg-sky-600 text-white"
                        : "border-slate-900 bg-slate-900 text-white"
                      : isNight
                        ? "border-slate-600 bg-slate-800 text-slate-100"
                        : "border-slate-300 bg-white text-slate-900"
                  )}
                  style={{ fontFamily: fontMap[font] }}
                >
                  {font}
                </button>
              ))}
            </div>
          </>
        )}

        {section === "konto" && (
          <>
            <h3 className="text-lg font-semibold">{en ? "Account and learning" : "Konta i nauka"}</h3>
            <div className="space-y-2">
              <p className={cn("text-sm", muted)}>{en ? "Name or nickname" : "Imie lub pseudonim"}</p>
              <input
                value={profile.displayName}
                onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder={en ? "How AI should address you" : "Jak ma zwracac sie AI"}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")}
              />
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm", muted)}>{en ? "Student class" : "Klasa ucznia"}</p>
              <div className="flex flex-wrap gap-2">
                {CLASS_LEVELS.map((lvl) => (
                  <button key={lvl} onClick={() => setProfile((prev) => ({ ...prev, classLevel: lvl }))} className={cn("rounded-full border px-3 py-1.5 text-xs", profile.classLevel === lvl ? "border-slate-900 bg-slate-900 text-white" : isNight ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900")}>
                    {en ? "Class" : "Klasa"} {lvl}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm", muted)}>{en ? "Skill level" : "Poziom ucznia"}</p>
              <div className="flex gap-2">
                {SKILL_LEVELS.map((level) => (
                  <button key={level} onClick={() => setProfile((prev) => ({ ...prev, skillLevel: level }))} className={cn("rounded-full border px-3 py-1.5 text-xs", profile.skillLevel === level ? "border-slate-900 bg-slate-900 text-white" : isNight ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900")}>{skillLabel(level, language)}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm", muted)}>{en ? "OpenRouter API key" : "Klucz API OpenRouter"}</p>
              <input
                type="password"
                value={tutorApiKey}
                onChange={(e) => setTutorApiKey(e.target.value)}
                placeholder={en ? "Paste or remove key" : "Wklej lub usun klucz"}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm", isNight ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white")}
              />
            </div>
          </>
        )}

        {section === "pomoc" && (
          <>
            <h3 className="text-lg font-semibold">{en ? "Help" : "Pomoc"}</h3>
            <div className={cn("space-y-3 rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
              <h4 className="font-medium">{en ? "Desktop and windows" : "Pulpit i okna"}</h4>
              <p className={cn("text-sm", muted)}>{en ? "Click icon to launch apps. Icons and windows can be dragged within EduOS area." : "Kliknij ikone aby uruchomic aplikacje. Ikony i okna mozna przeciagac, ale pozostaja w obrebie EduOS."}</p>
            </div>
            <div className={cn("space-y-3 rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
              <h4 className="font-medium">{en ? "Tutor" : "Korepetytor"}</h4>
              <p className={cn("text-sm", muted)}>{en ? "AI uses class level, skill profile and current tutor sliders. Requests are retried on temporary failures." : "AI bierze pod uwage klase, poziom ucznia i biezace suwaki korepetytora. W razie bledu zapytanie jest ponawiane automatycznie."}</p>
            </div>
            <div className={cn("space-y-3 rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
              <h4 className="font-medium">{en ? "CMD and shortcuts" : "CMD i skroty"}</h4>
              <p className={cn("text-sm", muted)}>{en ? "Press ` to open CMD. Type ? to list commands (open, theme, font, class, level, skip, status)." : "Nacisnij ` aby otworzyc CMD. Wpisz ? aby zobaczyc komendy (np. open, theme, font, class, level, skip, status)."}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ProgressView({ progress, language, isNight }: { progress: ProgressStats; language: SystemLanguage; isNight: boolean }) {
  const en = language === "en";
  const totalLearningPoints = progress.masteredCards * 2 + progress.sessionsDone * 25 + progress.tutorQuestions * 3;
  const rank = learningRank(progress);
  const rankSteps = RANK_STEPS;
  const [rankModalOpen, setRankModalOpen] = useState(false);
  const currentStep = rankSteps.find((r) => r.name === rank)!;
  const nextStep = rankSteps[rankSteps.findIndex((r) => r.name === rank) + 1] ?? null;
  const rankProgress = nextStep
    ? Math.max(0, Math.min(100, ((totalLearningPoints - currentStep.min) / (nextStep.min - currentStep.min)) * 100))
    : 100;
  const pointsToNext = nextStep ? Math.max(0, nextStep.min - totalLearningPoints) : 0;
  const rankIcons: Record<string, string> = {
    Bronze: "◈",
    Silver: "◆",
    Gold: "⬟",
    Diamond: "⬢",
    EduMaster: "✦",
  };

  const topApps = Object.entries(progress.appUsageSeconds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const toTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className={cn("space-y-3 rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-900/70 text-slate-100" : "border-slate-200 bg-white/90 text-slate-900")}>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-600 bg-slate-800/80" : "border-slate-200 bg-slate-50")}>
        <p className="text-xs uppercase tracking-[0.16em] opacity-70">{en ? "Your rank" : "Twoja ranga"}</p>
        <button onClick={() => setRankModalOpen(true)} className="mt-1 flex items-center gap-2 text-3xl font-semibold">
          <span>{rankIcons[rank] || "◆"}</span>
          <span>{rank}</span>
        </button>
        <p className={cn("mt-1 text-xs", isNight ? "text-slate-300" : "text-slate-600")}>{en ? "Learning points" : "Punkty nauki"}: {totalLearningPoints}</p>
        <div className={cn("mt-3 h-2 rounded-full", isNight ? "bg-slate-700" : "bg-slate-200")}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${rankProgress}%` }} className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-500 to-indigo-600" />
        </div>
        <p className={cn("mt-2 text-xs", isNight ? "text-slate-300" : "text-slate-600")}>
          {nextStep ? `${en ? "To" : "Do"} ${nextStep.name}: ${pointsToNext}` : en ? "Max rank reached" : "Maksymalna ranga osiagnieta"}
        </p>
      </div>

      <h3 className="text-lg font-semibold">{en ? "Progress details" : "Szczegoly postepow"}</h3>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{en ? "Completed sessions" : "Ukonczone sesje"}</p>
        <p className="text-3xl font-semibold">{progress.sessionsDone}</p>
      </div>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{en ? "Mastered cards" : "Opanowane karty"}</p>
        <p className="text-3xl font-semibold">{progress.masteredCards}</p>
      </div>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{en ? "Total active time" : "Laczny czas aktywnosci"}</p>
        <p className="text-2xl font-semibold">{toTime(progress.totalUsageSeconds)}</p>
      </div>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>{en ? "App launches" : "Uruchomienia aplikacji"}</p>
        <p className="text-2xl font-semibold">{Object.values(progress.appOpens).reduce((acc, v) => acc + (v || 0), 0)}</p>
      </div>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className="mb-2 text-sm font-semibold">{en ? "All app stats" : "Statystyki aplikacji"}</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>{en ? "Tutor questions" : "Pytania do korepetytora"}: {progress.tutorQuestions}</p>
          <p>{en ? "Notes saved" : "Zapisane notatki"}: {progress.notesSaved}</p>
          <p>{en ? "Notes created" : "Utworzone notatki"}: {progress.notesCreated}</p>
          <p>{en ? "Notes deleted" : "Usuniete notatki"}: {progress.notesDeleted}</p>
          <p>{en ? "App installs" : "Pobrania aplikacji"}: {progress.marketInstalls}</p>
          <p>{en ? "Cloud uploads" : "Pliki wgrane do Chmury"}: {progress.cloudUploads}</p>
          <p>{en ? "Calculator interactions" : "Interakcje kalkulatora"}: {progress.calcInteractions}</p>
          <p>{en ? "Study streak" : "Seria dni"}: {progress.streakDays}</p>
        </div>
      </div>
      <div className={cn("rounded-xl border p-4", isNight ? "border-slate-700" : "border-slate-200")}>
        <p className="mb-2 text-sm font-semibold">{en ? "Most used apps" : "Najczesciej uzywane aplikacje"}</p>
        <div className="space-y-1 text-sm">
          {topApps.length === 0 && <p>{en ? "No data yet" : "Brak danych"}</p>}
          {topApps.map(([id, seconds]) => (
            <p key={id}>{appLabel(id as AppId, language)}: {toTime(seconds)}</p>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {rankModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className={cn("w-full max-w-xl rounded-xl border p-4", isNight ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white")}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg font-semibold">{en ? "All ranks" : "Wszystkie rangi"}</h4>
                <button onClick={() => setRankModalOpen(false)} className={cn("rounded border px-3 py-1 text-xs", isNight ? "border-slate-600" : "border-slate-300")}>OK</button>
              </div>
              <div className="space-y-2">
                {rankSteps.map((step) => (
                  <div key={step.name} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", rank === step.name ? (isNight ? "border-sky-400 bg-sky-900/30" : "border-sky-300 bg-sky-50") : isNight ? "border-slate-700" : "border-slate-200")}>
                    <p className="font-semibold"><span className="mr-2">{rankIcons[step.name] || "◆"}</span>{step.name}</p>
                    <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-600")}>{step.max === Number.POSITIVE_INFINITY ? `${step.min}+` : `${step.min}-${step.max}`}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Keypad({ keys, onPress, isNight }: { keys: string[]; onPress: (key: string) => void; isNight?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {keys.map((key) => (
        <motion.button
          key={key}
          {...BUTTON_MOTION}
          onClick={() => onPress(key)}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-sm transition-transform",
            isNight ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          )}
        >
          {key}
        </motion.button>
      ))}
    </div>
  );
}

function FieldTile({ label, value, active, onClick, isNight }: { label: string; value: string; active: boolean; onClick: () => void; isNight?: boolean }) {
  return (
    <motion.button
      {...BUTTON_MOTION}
      onClick={onClick}
      className={cn(
        "rounded-lg border p-2 text-left transition-transform",
        active
          ? isNight
            ? "border-sky-300 bg-sky-600 text-white"
            : "border-slate-900 bg-slate-900 text-white"
          : isNight
            ? "border-slate-700 bg-slate-800 text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
      )}
    >
      <p className="text-xs uppercase opacity-70">{label}</p>
      <p className="text-lg">{value || "0"}</p>
    </motion.button>
  );
}

function AppIcon({ id }: { id: AppId }) {
  const base = "h-6 w-6 text-white";
  const paths: Record<string, React.ReactNode> = {
    flashcards: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    tutor: <><path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 4V7Z" /><path d="M9 10h6" /></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8" /><path d="M8 12h2" /><path d="M12 12h2" /><path d="M16 12h0.01" /><path d="M8 16h2" /><path d="M12 16h2" /></>,
    notes: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
    settings: <><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.02.02a2 2 0 0 1-2.83 2.83l-.02-.02a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.03a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.02.02a2 2 0 1 1-2.83-2.83l.02-.02A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.03a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.02-.02a2 2 0 1 1 2.83-2.83l.02.02A1.7 1.7 0 0 0 8.94 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.03a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.02-.02a2 2 0 1 1 2.83 2.83l-.02.02A1.7 1.7 0 0 0 19.4 9c.22.48.74.8 1.27.8H21a2 2 0 1 1 0 4h-.03c-.53 0-1.05.32-1.27.8Z" /></>,
    market: <><path d="M4 8h16l-1.2 11H5.2L4 8Z" /><path d="M8 8a4 4 0 1 1 8 0" /><path d="M9 12h6" /></>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .7-7.94A5 5 0 0 0 8 8.5a3.5 3.5 0 0 0-1 6.9" /><path d="M12 11v8" /><path d="m9.5 16 2.5 3 2.5-3" /></>,
    designer: <><path d="M4 5h16v14H4z" /><path d="M8 9h8" /><path d="M8 13h5" /><path d="M15 13h1" /></>,
    fallback: <><path d="M5 5h6v6H5z" /><path d="M13 5h6v10h-6z" /><path d="M5 13h6v6H5z" /></>,
  };
  return <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">{paths[id] || paths.fallback}</svg>;
}
