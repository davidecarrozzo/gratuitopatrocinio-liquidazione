import React, { memo, useCallback, useMemo, useReducer, useRef, useState } from "react";
import JSZip from "jszip";

type TipoDifensore = "fiducia" | "ufficio";
type TipoAssistito = "imputato" | "parte_civile" | "persona_offesa";
type Complessita = "semplice" | "medio" | "complesso";

type FasiPrincipale = {
  studio: boolean;
  introduttiva: boolean;
  istruttoria: boolean;
  decisionale: boolean;
};

type FasiCautelare = { studio: boolean; introduttiva: boolean; decisionale: boolean };

type AssistitoExtra = {
  cognome: string;
  nome: string;
  luogoNascita: string;
  dataNascita: string;
};

const GIUDICI = [
  "Dott.ssa Stefania De Angelis",
  "Dott. Ambrogio Colombo",
  "Dott. Leonardo Convertini",
  "Dott.ssa Anna Guidone",
  "Dott. Simone Falerno",
  "Dott.ssa Paola D'Amico",
  "Dott.ssa Margherita Ricci",
  "Dott. Antonio Amato (G.O.T.)",
  "Dott. Roberto De Matteis (G.O.T.)",
  "Dott. Giuseppe Caputo (G.O.T.)",
  "Dott. Giuseppe Lanzillotta (G.O.T.)",
  "Dott.ssa Monica Pizza (G.O.T.)",
  "Dott.ssa Maria Raffaella Lopane (G.O.T.)",
] as const;

type Giudice = (typeof GIUDICI)[number] | "";

const POS = {
  studio:
    "Si ritiene congruo comminare la fase di studio essendo stata documentata tale attività necessaria e propedeutica all'espletamento dell'incarico difensivo",
  introduttiva:
    "Si ritiene opportuno riconoscere tale fase perché il difensore ha dimostrato di aver avanzato istanze rilevanti ai fini della suddetta fase",
  istruttoria:
    "Si ritiene congruo liquidare la fase istruttoria dal momento che l'istante ha dimostrato di aver svolto e partecipato alle attività tipiche della fase istruttoria, quali la formulazione di richieste di prova in sede di apertura del dibattimento e la conseguente acquisizione di prove documentali e testimoniali.",
  decisionale:
    "Si ritiene congruo liquidare tale fase dal momento che risulta provato che il difensore ha partecipato alla formulazione delle conclusioni e all'esito del giudizio",
} as const;

const NEG = {
  studio:
    "Non si ritiene congruo comminare la fase di studio non risultando documentata attività necessaria e propedeutica all'espletamento dell'incarico difensivo",
  introduttiva:
    "Non si ritiene opportuno riconoscere tale fase non risultando che il difensore abbia avanzato istanze rilevanti ai fini della suddetta fase",
  istruttoria:
    "Non si ritiene congruo liquidare la fase istruttoria non risultando dimostrato lo svolgimento o la partecipazione alle attività tipiche della fase istruttoria, quali la formulazione di richieste di prova in sede di apertura del dibattimento e la conseguente acquisizione di prove documentali e testimoniali.",
  decisionale:
    "Non si ritiene congruo liquidare tale fase non risultando provato che il difensore abbia partecipato alla formulazione delle conclusioni e all'esito del giudizio",
} as const;

type AppState = {
  rgt: string;
  rgnr: string;
  siamm: string;
  dataSentenza: string;

  numeroMod27: string;
  dataMod27: string;

  giudice: Giudice;

  avvocato: string;
  cfAvvocato: string;
  pivaAvvocato: string;
  tipoDifensore: TipoDifensore;

  assistitoCognome: string;
  assistitoNome: string;
  assistitoLuogoNascita: string;
  assistitoDataNascita: string;
  assistitoResidenza: string;
  domiciliatoPressoDifensore: boolean;
  tipoAssistito: TipoAssistito;

  motivazioneStudio: string;
  motivazioneIntroduttiva: string;
  motivazioneIstruttoria: string;
  motivazioneDecisionale: string;

  complessita: Complessita;
  fasiRichieste: FasiPrincipale;

  cautelarePresente: boolean;
  complessitaCautelare: Complessita;
  fasiCautelare: FasiCautelare;
  motivazioneCautelare: string;

  assistitiMultipli: AssistitoExtra[];
  motivazioneAssistiti: string;
};

const initialState: AppState = {
  rgt: "",
  rgnr: "",
  siamm: "",
  dataSentenza: "",

  numeroMod27: "",
  dataMod27: "",

  giudice: "",

  avvocato: "",
  cfAvvocato: "",
  pivaAvvocato: "",
  tipoDifensore: "fiducia",

  assistitoCognome: "",
  assistitoNome: "",
  assistitoLuogoNascita: "",
  assistitoDataNascita: "",
  assistitoResidenza: "",
  domiciliatoPressoDifensore: false,
  tipoAssistito: "imputato",

  motivazioneStudio: POS.studio,
  motivazioneIntroduttiva: NEG.introduttiva,
  motivazioneIstruttoria: NEG.istruttoria,
  motivazioneDecisionale: POS.decisionale,

  complessita: "semplice",
  fasiRichieste: { studio: true, introduttiva: false, istruttoria: false, decisionale: true },

  cautelarePresente: false,
  complessitaCautelare: "semplice",
  fasiCautelare: { studio: false, introduttiva: false, decisionale: false },
  motivazioneCautelare: "",

  assistitiMultipli: [],
  motivazioneAssistiti: "",
};

type Action =
  | { type: "set"; key: keyof AppState; value: any }
  | { type: "setFasePrincipale"; key: keyof FasiPrincipale; value: boolean }
  | { type: "setFaseCautelare"; key: keyof FasiCautelare; value: boolean }
  | { type: "addAssistito" }
  | { type: "removeAssistito"; idx: number }
  | { type: "setAssistito"; idx: number; key: keyof AssistitoExtra; value: string };

function isAutoMotivazione(current: string, fase: keyof typeof POS) {
  return current.trim() === "" || current === POS[fase] || current === NEG[fase];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };

    case "setFasePrincipale": {
      const next: AppState = {
        ...state,
        fasiRichieste: { ...state.fasiRichieste, [action.key]: action.value },
      };

      if (action.key === "studio" && isAutoMotivazione(state.motivazioneStudio, "studio")) {
        next.motivazioneStudio = action.value ? POS.studio : NEG.studio;
      }
      if (action.key === "introduttiva" && isAutoMotivazione(state.motivazioneIntroduttiva, "introduttiva")) {
        next.motivazioneIntroduttiva = action.value ? POS.introduttiva : NEG.introduttiva;
      }
      if (action.key === "istruttoria" && isAutoMotivazione(state.motivazioneIstruttoria, "istruttoria")) {
        next.motivazioneIstruttoria = action.value ? POS.istruttoria : NEG.istruttoria;
      }
      if (action.key === "decisionale" && isAutoMotivazione(state.motivazioneDecisionale, "decisionale")) {
        next.motivazioneDecisionale = action.value ? POS.decisionale : NEG.decisionale;
      }

      return next;
    }

    case "setFaseCautelare":
      return { ...state, fasiCautelare: { ...state.fasiCautelare, [action.key]: action.value } };

    case "addAssistito":
      return {
        ...state,
        assistitiMultipli: [...state.assistitiMultipli, { cognome: "", nome: "", luogoNascita: "", dataNascita: "" }],
      };

    case "removeAssistito":
      return { ...state, assistitiMultipli: state.assistitiMultipli.filter((_, i) => i !== action.idx) };

    case "setAssistito":
      return {
        ...state,
        assistitiMultipli: state.assistitiMultipli.map((a, i) =>
          i === action.idx ? { ...a, [action.key]: action.value } : a
        ),
      };

    default:
      return state;
  }
}

const DM55_A: Record<Complessita, { studio: number; introduttiva: number; istruttoria: number; decisionale: number }> = {
  semplice: { studio: 237, introduttiva: 284, istruttoria: 567, decisionale: 709 },
  medio: { studio: 473, introduttiva: 567, istruttoria: 1134, decisionale: 1418 },
  complesso: { studio: 710, introduttiva: 851, istruttoria: 1701, decisionale: 2127 },
};

const DM55_B: Record<Complessita, { studio: number; introduttiva: number; decisionale: number }> = {
  semplice: { studio: 189, introduttiva: 615, decisionale: 709 },
  medio: { studio: 378, introduttiva: 1229, decisionale: 1418 },
  complesso: { studio: 567, introduttiva: 1844, decisionale: 2127 },
};

function euroInt(n: number) {
  const rounded = Math.round(n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function computeCompensoPrincipale(complessita: Complessita, fasi: FasiPrincipale) {
  const t = DM55_A[complessita];
  const studio = fasi.studio ? t.studio : 0;
  const introduttiva = fasi.introduttiva ? t.introduttiva : 0;
  const istruttoria = fasi.istruttoria ? t.istruttoria : 0;
  const decisionale = fasi.decisionale ? t.decisionale : 0;

  const totaleParziale = studio + introduttiva + istruttoria + decisionale;
  const riduzione = totaleParziale / 3;
  const totaleRidotto = totaleParziale - riduzione;
  const rimborso15 = totaleRidotto * 0.15;
  const totaleCalcoli = totaleRidotto + rimborso15;

  return { studio, introduttiva, istruttoria, decisionale, totaleParziale, riduzione, totaleRidotto, rimborso15, totaleCalcoli };
}

function computeCompensoCautelare(complessita: Complessita, fasi: FasiCautelare) {
  const t = DM55_B[complessita];
  const studio = fasi.studio ? t.studio : 0;
  const introduttiva = fasi.introduttiva ? t.introduttiva : 0;
  const decisionale = fasi.decisionale ? t.decisionale : 0;

  const totaleParziale = studio + introduttiva + decisionale;
  const riduzione = totaleParziale / 3;
  const totaleRidotto = totaleParziale - riduzione;
  const rimborso15 = totaleRidotto * 0.15;
  const totaleCalcoli = totaleRidotto + rimborso15;

  return { studio, introduttiva, decisionale, totaleParziale, riduzione, totaleRidotto, rimborso15, totaleCalcoli };
}

// Art. 12 D.M. 55/2014: +30% per ogni assistito fino a 10 (totali), +10% oltre (max 20 totali).
function computeMaggiorazioneAssistiti(extraCount: number) {
  const cappedExtra = Math.min(extraCount, 19); // oltre 20 totali non si considera
  const firstBand = Math.min(cappedExtra, 9); // fino a 10 totali -> 9 extra
  const secondBand = Math.max(0, cappedExtra - 9);
  return firstBand * 0.30 + secondBand * 0.10;
}

function xmlEscape(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function downloadDocxFromTemplate(replacements: Record<string, string>, filename: string) {
  const res = await fetch("/template.docx", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossibile leggere il template Word (public/template.docx).");

  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const docXmlPath = "word/document.xml";
  const docXmlFile = zip.file(docXmlPath);
  if (!docXmlFile) throw new Error("Template non valido: manca word/document.xml.");

  let xml = await docXmlFile.async("string");

  // Sostituzione diretta dei segnaposto presenti nel template.
  for (const [k, v] of Object.entries(replacements)) {
    xml = xml.split(k).join(xmlEscape(v));
  }

  zip.file(docXmlPath, xml);

  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delayMs: number) {
  const ref = useRef<number | null>(null);
  const latest = useRef(cb);
  latest.current = cb;

  return useCallback(((...args: any[]) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => latest.current(...args), delayMs);
  }) as T, [delayMs]);
}

const InputField = memo(function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedCallback((v: string) => onChange(v), 250);

  React.useEffect(() => setLocal(value), [value]);

  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-sm font-medium text-slate-100/90 mb-1">{label}</div>
      <input
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          debounced(v);
        }}
        className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 placeholder:text-slate-400"
      />
    </label>
  );
});

const TextAreaField = memo(function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedCallback((v: string) => onChange(v), 250);

  React.useEffect(() => setLocal(value), [value]);

  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-sm font-medium text-slate-100/90 mb-1">{label}</div>
      <textarea
        value={local}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          debounced(v);
        }}
        rows={4}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 placeholder:text-slate-400"
      />
    </label>
  );
});

const Pill = memo(function Pill({ children, tone }: { children: React.ReactNode; tone: "blue" | "violet" | "green" | "slate" }) {
  const cls = {
    blue: "bg-blue-500/15 text-blue-100 border-blue-200/20",
    violet: "bg-violet-500/15 text-violet-100 border-violet-200/20",
    green: "bg-emerald-500/15 text-emerald-100 border-emerald-200/20",
    slate: "bg-white/10 text-slate-100 border-white/15",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
});

const Card = memo(function Card({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "blue" | "violet" | "green" | "slate";
}) {
  const border = {
    blue: "border-blue-200/20",
    violet: "border-violet-200/20",
    green: "border-emerald-200/20",
    slate: "border-white/15",
  }[tone];
  const badge = tone === "blue" ? "Principale" : tone === "violet" ? "Cautelare" : tone === "green" ? "Assistiti" : "Dati";
  return (
    <div className={`rounded-2xl border ${border} bg-white/10 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.25)]`}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <Pill tone={tone}>{badge}</Pill>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
});

function Check({ checked, tone = "blue" }: { checked: boolean; tone?: "blue" | "violet" | "green" }) {
  const on = tone === "violet" ? "bg-violet-500 border-violet-500" : tone === "green" ? "bg-emerald-500 border-emerald-500" : "bg-cyan-400 border-cyan-400";
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${checked ? on : "bg-white/80 border-slate-300"}`}>
      {checked ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : null}
    </span>
  );
}

const Stepper = memo(function Stepper({
  current,
  maxCompleted,
  onGo,
}: {
  current: number;
  maxCompleted: number;
  onGo: (idx: number) => void;
}) {
  const steps = ["1. Dati generali", "2. Importi principale", "3. Subprocedimento cautelare", "4. Assistiti multipli", "5. Anteprima e Word"];
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s, idx) => {
        const enabled = idx <= maxCompleted;
        const active = idx === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => enabled && onGo(idx)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition
              ${active ? "border-white/30 bg-white/15 text-white" : enabled ? "border-white/15 bg-white/10 text-white/90 hover:bg-white/15" : "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"}`}
            aria-disabled={!enabled}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
});

const SummaryRow = memo(function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/10 last:border-b-0">
      <div className="text-sm text-white/70">{label}</div>
      <div className="text-sm font-semibold text-white text-right">{value}</div>
    </div>
  );
});

function validateStep1(s: AppState) {
  return Boolean((s.rgt || s.rgnr) && s.giudice && s.avvocato && (s.assistitoCognome || s.assistitoNome));
}
function validateStep2(s: AppState) {
  return Object.values(s.fasiRichieste).some(Boolean);
}
function validateStep3(s: AppState) {
  if (!s.cautelarePresente) return true;
  return Object.values(s.fasiCautelare).some(Boolean);
}

const Modal = memo(function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/15 bg-slate-950/80 backdrop-blur p-5 shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="text-base font-semibold text-white">{title}</div>
          <button onClick={onClose} className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15">
            Chiudi
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
});

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [step, setStep] = useState(0);
  const [maxCompleted, setMaxCompleted] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>("");

  const [previewOpen, setPreviewOpen] = useState(false);

  const principale = useMemo(() => computeCompensoPrincipale(state.complessita, state.fasiRichieste), [state.complessita, state.fasiRichieste]);
  const cautelare = useMemo(() => (state.cautelarePresente ? computeCompensoCautelare(state.complessitaCautelare, state.fasiCautelare) : null), [
    state.cautelarePresente,
    state.complessitaCautelare,
    state.fasiCautelare,
  ]);

  const baseTot = principale.totaleCalcoli + (cautelare?.totaleCalcoli ?? 0);
  const percAumento = useMemo(() => computeMaggiorazioneAssistiti(state.assistitiMultipli.length), [state.assistitiMultipli.length]);
  const aumentoAssistitiEuro = useMemo(() => baseTot * percAumento, [baseTot, percAumento]);
  const totaleFinale = useMemo(() => baseTot + aumentoAssistitiEuro, [baseTot, aumentoAssistitiEuro]);

  const contributo4 = useMemo(() => totaleFinale * 0.04, [totaleFinale]);
  const imponibileIVA = useMemo(() => totaleFinale + contributo4, [totaleFinale, contributo4]);
  const iva22 = useMemo(() => imponibileIVA * 0.22, [imponibileIVA]);
  const totaleConIVA = useMemo(() => imponibileIVA + iva22, [imponibileIVA, iva22]);

  const canGoNext = useMemo(() => {
    if (step === 0) return validateStep1(state);
    if (step === 1) return validateStep2(state);
    if (step === 2) return validateStep3(state);
    return true;
  }, [step, state]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const next = Math.min(4, step + 1);
    setStep(next);
    setMaxCompleted((m) => Math.max(m, next));
  }, [canGoNext, step]);

  const goPrev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const buildReplacements = useCallback(() => {
    const assistitoFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(" ").trim();
    const dataSentenza = state.dataSentenza || "";
    const giudice = state.giudice || "";
    const avvocato = state.avvocato || "";

    return {
      "{{RGT}}": state.rgt,
      "{{RGNR}}": state.rgnr,
      "{{SIAMM}}": state.siamm,
      "{{Giudice}}": giudice,
      "{{giudice}}": giudice,
      "{{avvocato}}": avvocato,
      "{{assistito}}": assistitoFull,
      "{{data sentenza}}": dataSentenza,

      "{{motivazione studio}}": state.motivazioneStudio || "",
      "{{motivazione introduttiva}}": state.motivazioneIntroduttiva || "",
      "{{motivazione istruttoria}}": state.motivazioneIstruttoria || "",
      "{{motivazione decisionale}}": state.motivazioneDecisionale || "",

      "{{subcautelare}}": state.motivazioneCautelare || "",
      "{{assistenza più assistiti}}": state.motivazioneAssistiti || "",

      // Importi (arrotondati, senza decimali)
      "{{importo studio}}": euroInt(principale.studio),
      "{{importo introduttiva}}": euroInt(principale.introduttiva),
      "{{importo istruttoria}}": euroInt(principale.istruttoria),
      "{{importo decisionale}}": euroInt(principale.decisionale),

      "{{importo tot parziale}}": euroInt(principale.totaleParziale),
      "{{rid 1/3}}": euroInt(principale.riduzione),
      "{{importo tot ridotto}}": euroInt(principale.totaleRidotto),
      "{{rimborso}}": euroInt(principale.rimborso15),
      "{{totale calcoli}}": euroInt(principale.totaleCalcoli),

      "{{Aumenti assistiti}}": euroInt(aumentoAssistitiEuro),
      "{{totale finale}}": euroInt(totaleFinale),
    } as Record<string, string>;
  }, [state, principale, aumentoAssistitiEuro, totaleFinale]);

  const downloadWord = useCallback(async () => {
    setError("");
    setIsGenerating(true);
    try {
      const repl = buildReplacements();
      const date = new Date().toISOString().slice(0, 10);
      await downloadDocxFromTemplate(repl, `decreto-liquidazione-${date}.docx`);
    } catch (e: any) {
      setError(e?.message ?? "Errore durante la generazione del Word.");
    } finally {
      setIsGenerating(false);
    }
  }, [buildReplacements]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001B4D] via-[#003B73] to-[#005B5B]">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-400 blur-3xl" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-violet-400 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-emerald-400 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:py-10 space-y-6">
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.25)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-white/70">TRIBUNALE DI BRINDISI</div>
              <div className="text-xl md:text-2xl font-extrabold text-white">Sezione Penale · Liquidazione gratuito patrocinio</div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="blue">Principale</Pill>
              <Pill tone="violet">Cautelare</Pill>
              <Pill tone="green">Assistiti</Pill>
            </div>
          </div>

          <div className="mt-4">
            <Stepper current={step} maxCompleted={maxCompleted} onGo={(i) => setStep(i)} />
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            <div className="font-semibold">Errore</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        {step === 0 ? (
          <Step1 state={state} dispatch={dispatch} />
        ) : step === 1 ? (
          <Step2 state={state} dispatch={dispatch} principale={principale} />
        ) : step === 2 ? (
          <Step3 state={state} dispatch={dispatch} cautelare={cautelare} />
        ) : step === 3 ? (
          <Step4 state={state} dispatch={dispatch} baseTot={baseTot} percAumento={percAumento} aumentoEuro={aumentoAssistitiEuro} totaleFinale={totaleFinale} />
        ) : (
          <Step5
            state={state}
            principaleTot={principale.totaleCalcoli}
            cautelareTot={cautelare?.totaleCalcoli ?? 0}
            aumentoEuro={aumentoAssistitiEuro}
            totaleFinale={totaleFinale}
            contributo4={contributo4}
            iva22={iva22}
            totaleConIVA={totaleConIVA}
            onPreview={() => setPreviewOpen(true)}
            onDownloadWord={downloadWord}
            isGenerating={isGenerating}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={goPrev} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
            Indietro
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
                canGoNext ? "bg-white text-slate-900 hover:bg-white/90" : "bg-white/25 text-white/50 cursor-not-allowed"
              }`}
            >
              Avanti
            </button>
          ) : null}
        </div>

        <Modal title="Anteprima dati & totali" open={previewOpen} onClose={() => setPreviewOpen(false)}>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="text-sm font-semibold text-white mb-2">Riepilogo</div>
              <SummaryRow label="RGT / RGNR / SIAMM" value={`${state.rgt} · ${state.rgnr} · ${state.siamm}`} />
              <SummaryRow label="Giudice" value={state.giudice || "—"} />
              <SummaryRow label="Avvocato" value={state.avvocato || "—"} />
              <SummaryRow label="Assistito" value={`${state.assistitoCognome} ${state.assistitoNome}`.trim() || "—"} />
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="text-sm font-semibold text-white mb-2">Totali (arrotondati)</div>
              <SummaryRow label="Totale principale" value={`€ ${euroInt(principale.totaleCalcoli)}`} />
              <SummaryRow label="Totale cautelare" value={`€ ${euroInt(cautelare?.totaleCalcoli ?? 0)}`} />
              <SummaryRow label="Aumenti assistiti" value={`€ ${euroInt(aumentoAssistitiEuro)}`} />
              <SummaryRow label="Totale definitivo" value={`€ ${euroInt(totaleFinale)}`} />
              <SummaryRow label="+ 4% contributo previdenziale" value={`€ ${euroInt(contributo4)}`} />
              <SummaryRow label="+ 22% IVA" value={`€ ${euroInt(iva22)}`} />
              <SummaryRow label="Totale complessivo" value={`€ ${euroInt(totaleConIVA)}`} />
            </div>

            <div className="text-xs text-white/60">
              L’anteprima mostra riepilogo e calcoli; il documento Word scaricato mantiene la formattazione del template e inserisce i valori nei segnaposto.
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

const FaseCheckbox = memo(function FaseCheckbox({
  label,
  checked,
  onToggle,
  tone,
}: {
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  tone: "blue" | "violet" | "green";
}) {
  const cls =
    tone === "violet"
      ? checked
        ? "border-violet-200/30 bg-white/10"
        : "border-white/15 bg-white/10 hover:bg-white/15"
      : tone === "green"
        ? checked
          ? "border-emerald-200/30 bg-white/10"
          : "border-white/15 bg-white/10 hover:bg-white/15"
        : checked
          ? "border-blue-200/30 bg-white/10"
          : "border-white/15 bg-white/10 hover:bg-white/15";

  return (
    <button type="button" onClick={() => onToggle(!checked)} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition ${cls}`}>
      <span className="text-sm font-semibold text-white">{label}</span>
      <Check checked={checked} tone={tone} />
    </button>
  );
});

const CalcBox = memo(function CalcBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
      <div className="text-xs font-semibold text-white/60">{title}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
});

const Step1 = memo(function Step1({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  return (
    <Card title="Step 1 · Dati Generali" tone="slate">
      <div className="grid gap-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InputField label="Procedimento · N. R.G.T." value={state.rgt} onChange={(v) => dispatch({ type: "set", key: "rgt", value: v })} placeholder="es. 123/2025" />
          <InputField label="Procedimento · N. R.G.N.R." value={state.rgnr} onChange={(v) => dispatch({ type: "set", key: "rgnr", value: v })} placeholder="es. 456/2024" />
          <InputField label="Procedimento · N. SIAMM" value={state.siamm} onChange={(v) => dispatch({ type: "set", key: "siamm", value: v })} placeholder="es. 7890" />
          <InputField label="Data udienza/sentenza" value={state.dataSentenza} onChange={(v) => dispatch({ type: "set", key: "dataSentenza", value: v })} placeholder="gg/mm/aaaa" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Ammissione G.P. · N. Mod. 27" value={state.numeroMod27} onChange={(v) => dispatch({ type: "set", key: "numeroMod27", value: v })} placeholder="es. 27/2025" />
          <InputField label="Ammissione G.P. · Data decreto ammissione" value={state.dataMod27} onChange={(v) => dispatch({ type: "set", key: "dataMod27", value: v })} placeholder="gg/mm/aaaa" />

          <label className="block">
            <div className="text-sm font-medium text-slate-100/90 mb-1">Giudice</div>
            <select
              value={state.giudice}
              onChange={(e) => dispatch({ type: "set", key: "giudice", value: e.target.value as Giudice })}
              className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="">— seleziona —</option>
              {GIUDICI.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InputField label="Avvocato · Nome e Cognome" value={state.avvocato} onChange={(v) => dispatch({ type: "set", key: "avvocato", value: v })} placeholder="es. avv. Giulia Bianchi" className="md:col-span-2" />
          <label className="block">
            <div className="text-sm font-medium text-slate-100/90 mb-1">Avvocato · Tipo</div>
            <select
              value={state.tipoDifensore}
              onChange={(e) => dispatch({ type: "set", key: "tipoDifensore", value: e.target.value as TipoDifensore })}
              className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="fiducia">fiducia</option>
              <option value="ufficio">ufficio</option>
            </select>
          </label>
          <InputField label="Avvocato · C.F." value={state.cfAvvocato} onChange={(v) => dispatch({ type: "set", key: "cfAvvocato", value: v })} placeholder="codice fiscale" />
          <InputField label="Avvocato · P.IVA" value={state.pivaAvvocato} onChange={(v) => dispatch({ type: "set", key: "pivaAvvocato", value: v })} placeholder="partita IVA" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InputField label="Assistito · Cognome" value={state.assistitoCognome} onChange={(v) => dispatch({ type: "set", key: "assistitoCognome", value: v })} />
          <InputField label="Assistito · Nome" value={state.assistitoNome} onChange={(v) => dispatch({ type: "set", key: "assistitoNome", value: v })} />
          <InputField label="Assistito · Luogo di nascita" value={state.assistitoLuogoNascita} onChange={(v) => dispatch({ type: "set", key: "assistitoLuogoNascita", value: v })} />
          <InputField label="Assistito · Data di nascita" value={state.assistitoDataNascita} onChange={(v) => dispatch({ type: "set", key: "assistitoDataNascita", value: v })} placeholder="gg/mm/aaaa" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Assistito · Residenza" value={state.assistitoResidenza} onChange={(v) => dispatch({ type: "set", key: "assistitoResidenza", value: v })} className="md:col-span-2" />
          <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <input
              type="checkbox"
              checked={state.domiciliatoPressoDifensore}
              onChange={(e) => dispatch({ type: "set", key: "domiciliatoPressoDifensore", value: e.target.checked })}
              className="h-4 w-4"
            />
            <div className="text-sm font-semibold text-white">Domiciliato presso il difensore</div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <div className="text-sm font-medium text-slate-100/90 mb-1">Qualità assistito</div>
            <select
              value={state.tipoAssistito}
              onChange={(e) => dispatch({ type: "set", key: "tipoAssistito", value: e.target.value as TipoAssistito })}
              className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="imputato">imputato</option>
              <option value="parte_civile">parte civile</option>
              <option value="persona_offesa">persona offesa</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">
          <div className="font-semibold text-white mb-1">Motivazioni (auto)</div>
          <div>Le motivazioni delle fasi si impostano automaticamente in base alle fasi selezionate nello Step 2. Se personalizzi il testo manualmente, l’app non lo sovrascrive.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextAreaField label="Motivazione · Fase di studio" value={state.motivazioneStudio} onChange={(v) => dispatch({ type: "set", key: "motivazioneStudio", value: v })} />
          <TextAreaField label="Motivazione · Fase introduttiva" value={state.motivazioneIntroduttiva} onChange={(v) => dispatch({ type: "set", key: "motivazioneIntroduttiva", value: v })} />
          <TextAreaField label="Motivazione · Fase istruttoria" value={state.motivazioneIstruttoria} onChange={(v) => dispatch({ type: "set", key: "motivazioneIstruttoria", value: v })} />
          <TextAreaField label="Motivazione · Fase decisionale" value={state.motivazioneDecisionale} onChange={(v) => dispatch({ type: "set", key: "motivazioneDecisionale", value: v })} />
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">
          <div className="font-semibold text-white mb-1">Suggerimento</div>
          <div>Per abilitare lo step successivo inserisci almeno: (RGT o RGNR), Giudice, Avvocato e Assistito.</div>
        </div>
      </div>
    </Card>
  );
});

const Step2 = memo(function Step2({ state, dispatch, principale }: { state: AppState; dispatch: React.Dispatch<Action>; principale: ReturnType<typeof computeCompensoPrincipale> }) {
  const t = DM55_A[state.complessita];
  return (
    <Card title="Step 2 · Importi Procedimento Principale (D.M. 55/2014 – Allegato A)" tone="blue">
      <div className="grid gap-5">
        <label className="block max-w-sm">
          <div className="text-sm font-medium text-slate-100/90 mb-1">Complessità</div>
          <select
            value={state.complessita}
            onChange={(e) => dispatch({ type: "set", key: "complessita", value: e.target.value as Complessita })}
            className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            <option value="semplice">Semplice</option>
            <option value="medio">Medio</option>
            <option value="complesso">Complesso</option>
          </select>
        </label>

        <div className="rounded-2xl border border-blue-200/20 bg-blue-500/10 p-4">
          <div className="text-sm font-semibold text-blue-100 mb-3">Fasi da liquidare</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FaseCheckbox label={`Studio (€ ${t.studio})`} checked={state.fasiRichieste.studio} onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "studio", value: v })} tone="blue" />
            <FaseCheckbox label={`Introduttiva (€ ${t.introduttiva})`} checked={state.fasiRichieste.introduttiva} onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "introduttiva", value: v })} tone="blue" />
            <FaseCheckbox label={`Istruttoria (€ ${t.istruttoria})`} checked={state.fasiRichieste.istruttoria} onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "istruttoria", value: v })} tone="blue" />
            <FaseCheckbox label={`Decisionale (€ ${t.decisionale})`} checked={state.fasiRichieste.decisionale} onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "decisionale", value: v })} tone="blue" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CalcBox title="Totale parziale" value={`€ ${euroInt(principale.totaleParziale)}`} />
          <CalcBox title="Riduzione 1/3 (art. 106-bis)" value={`€ -${euroInt(principale.riduzione)}`} />
          <CalcBox title="Rimborso spese 15%" value={`€ ${euroInt(principale.rimborso15)}`} />
        </div>

        <div className="rounded-2xl border border-blue-200/20 bg-white/10 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm text-white/70">Totale (ridotto + rimborso 15%)</div>
            <div className="text-xl font-extrabold text-white">€ {euroInt(principale.totaleCalcoli)}</div>
          </div>
        </div>

        <div className="text-xs text-white/60">Importi visualizzati arrotondati all’euro (senza decimali).</div>
      </div>
    </Card>
  );
});

const Step3 = memo(function Step3({ state, dispatch, cautelare }: { state: AppState; dispatch: React.Dispatch<Action>; cautelare: ReturnType<typeof computeCompensoCautelare> | null }) {
  const t = DM55_B[state.complessitaCautelare];
  return (
    <Card title="Step 3 · Subprocedimento cautelare (D.M. 55/2014 – Allegato B)" tone="violet">
      <div className="grid gap-5">
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200/20 bg-violet-500/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-violet-100">Attiva subprocedimento cautelare</div>
            <div className="text-xs text-violet-100/70">Se OFF non incide sui calcoli</div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "set", key: "cautelarePresente", value: !state.cautelarePresente })}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${state.cautelarePresente ? "bg-violet-500 text-white" : "bg-white/90 text-violet-900"}`}
          >
            {state.cautelarePresente ? "ON" : "OFF"}
          </button>
        </label>

        {state.cautelarePresente ? (
          <>
            <label className="block max-w-sm">
              <div className="text-sm font-medium text-slate-100/90 mb-1">Complessità cautelare</div>
              <select
                value={state.complessitaCautelare}
                onChange={(e) => dispatch({ type: "set", key: "complessitaCautelare", value: e.target.value as Complessita })}
                className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <option value="semplice">Semplice</option>
                <option value="medio">Medio</option>
                <option value="complesso">Complesso</option>
              </select>
            </label>

            <div className="rounded-2xl border border-violet-200/20 bg-violet-500/10 p-4">
              <div className="text-sm font-semibold text-violet-100 mb-3">Fasi da liquidare</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FaseCheckbox label={`Studio (€ ${t.studio})`} checked={state.fasiCautelare.studio} onToggle={(v) => dispatch({ type: "setFaseCautelare", key: "studio", value: v })} tone="violet" />
                <FaseCheckbox label={`Introduttiva (€ ${t.introduttiva})`} checked={state.fasiCautelare.introduttiva} onToggle={(v) => dispatch({ type: "setFaseCautelare", key: "introduttiva", value: v })} tone="violet" />
                <FaseCheckbox label={`Decisionale (€ ${t.decisionale})`} checked={state.fasiCautelare.decisionale} onToggle={(v) => dispatch({ type: "setFaseCautelare", key: "decisionale", value: v })} tone="violet" />
              </div>
            </div>

            <TextAreaField label="Motivazione cautelare" value={state.motivazioneCautelare} onChange={(v) => dispatch({ type: "set", key: "motivazioneCautelare", value: v })} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CalcBox title="Totale parziale" value={`€ ${euroInt(cautelare?.totaleParziale ?? 0)}`} />
              <CalcBox title="Riduzione 1/3" value={`€ -${euroInt(cautelare?.riduzione ?? 0)}`} />
              <CalcBox title="Rimborso 15%" value={`€ ${euroInt(cautelare?.rimborso15 ?? 0)}`} />
            </div>

            <div className="rounded-2xl border border-violet-200/20 bg-white/10 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-sm text-white/70">Totale cautelare (ridotto + rimborso 15%)</div>
                <div className="text-xl font-extrabold text-white">€ {euroInt(cautelare?.totaleCalcoli ?? 0)}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-white/70">Subprocedimento cautelare disattivato.</div>
        )}
      </div>
    </Card>
  );
});

const Step4 = memo(function Step4({
  state,
  dispatch,
  baseTot,
  percAumento,
  aumentoEuro,
  totaleFinale,
}: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  baseTot: number;
  percAumento: number;
  aumentoEuro: number;
  totaleFinale: number;
}) {
  const principaleFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(" ").trim() || "(assistito non compilato)";
  const totalSubjects = 1 + state.assistitiMultipli.length;

  return (
    <Card title="Step 4 · Assistiti multipli (art. 12 D.M. 55/2014)" tone="green">
      <div className="grid gap-5">
        <div className="rounded-2xl border border-emerald-200/20 bg-emerald-500/10 p-4">
          <div className="text-sm font-semibold text-emerald-100">Assistito principale</div>
          <div className="mt-1 text-sm text-emerald-100/80">{principaleFull}</div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Assistiti aggiuntivi</div>
            <div className="text-xs text-white/60">Ogni assistito oltre il primo: +30% fino a 10; +10% oltre (max 20 totali).</div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "addAssistito" })}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Aggiungi assistito
          </button>
        </div>

        <div className="grid gap-4">
          {state.assistitiMultipli.length === 0 ? (
            <div className="text-sm text-white/70">Nessun assistito aggiuntivo inserito.</div>
          ) : (
            state.assistitiMultipli.map((a, idx) => (
              <div key={idx} className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-semibold text-white">Assistito #{idx + 2}</div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "removeAssistito", idx })}
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15"
                  >
                    Rimuovi
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <InputField label="Cognome" value={a.cognome} onChange={(v) => dispatch({ type: "setAssistito", idx, key: "cognome", value: v })} />
                  <InputField label="Nome" value={a.nome} onChange={(v) => dispatch({ type: "setAssistito", idx, key: "nome", value: v })} />
                  <InputField label="Luogo nascita" value={a.luogoNascita} onChange={(v) => dispatch({ type: "setAssistito", idx, key: "luogoNascita", value: v })} />
                  <InputField label="Data nascita" value={a.dataNascita} onChange={(v) => dispatch({ type: "setAssistito", idx, key: "dataNascita", value: v })} placeholder="gg/mm/aaaa" />
                </div>
              </div>
            ))
          )}
        </div>

        <TextAreaField
          label="Motivazione assistiti (art. 12 D.M. 55/2014)"
          value={state.motivazioneAssistiti}
          onChange={(v) => dispatch({ type: "set", key: "motivazioneAssistiti", value: v })}
          placeholder="es. identità di posizione processuale, attività svolta per ciascun assistito…"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CalcBox title="Base (principale+cautelare)" value={`€ ${euroInt(baseTot)}`} />
          <CalcBox title="Assistiti totali" value={String(totalSubjects)} />
          <CalcBox title="Maggiorazione" value={`${Math.round(percAumento * 100)}%`} />
          <CalcBox title="Aumento (Euro)" value={`€ ${euroInt(aumentoEuro)}`} />
        </div>

        <div className="rounded-2xl border border-emerald-200/20 bg-white/10 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm text-white/70">Totale (principale + cautelare + aumenti)</div>
            <div className="text-xl font-extrabold text-white">€ {euroInt(totaleFinale)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
});

const Step5 = memo(function Step5({
  state,
  principaleTot,
  cautelareTot,
  aumentoEuro,
  totaleFinale,
  contributo4,
  iva22,
  totaleConIVA,
  onPreview,
  onDownloadWord,
  isGenerating,
}: {
  state: AppState;
  principaleTot: number;
  cautelareTot: number;
  aumentoEuro: number;
  totaleFinale: number;
  contributo4: number;
  iva22: number;
  totaleConIVA: number;
  onPreview: () => void;
  onDownloadWord: () => void;
  isGenerating: boolean;
}) {
  const assistitoFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(" ").trim();

  return (
    <Card title="Step 5 · Anteprima e genera Word (.docx)" tone="slate">
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
            <div className="text-sm font-semibold text-white mb-3">Riepilogo</div>
            <SummaryRow label="RGT / RGNR / SIAMM" value={`${state.rgt} · ${state.rgnr} · ${state.siamm}`} />
            <SummaryRow label="Giudice" value={state.giudice || "—"} />
            <SummaryRow label="Avvocato" value={`${state.avvocato} (${state.tipoDifensore})`} />
            <SummaryRow label="Assistito" value={assistitoFull || "—"} />
            <SummaryRow label="Assistiti aggiuntivi" value={String(state.assistitiMultipli.length)} />
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
            <div className="text-sm font-semibold text-white mb-3">Totali (arrotondati)</div>
            <SummaryRow label="Totale principale" value={`€ ${euroInt(principaleTot)}`} />
            <SummaryRow label="Totale cautelare" value={`€ ${euroInt(cautelareTot)}`} />
            <SummaryRow label="Aumenti assistiti" value={`€ ${euroInt(aumentoEuro)}`} />
            <SummaryRow label="Totale definitivo" value={`€ ${euroInt(totaleFinale)}`} />
            <SummaryRow label="+ 4% contributo previdenziale" value={`€ ${euroInt(contributo4)}`} />
            <SummaryRow label="+ 22% IVA" value={`€ ${euroInt(iva22)}`} />
            <SummaryRow label="Totale complessivo" value={`€ ${euroInt(totaleConIVA)}`} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={onPreview}
            className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
          >
            Anteprima
          </button>

          <button
            type="button"
            onClick={onDownloadWord}
            disabled={isGenerating}
            className={`rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition ${
              isGenerating ? "bg-white/25 text-white/60 cursor-not-allowed" : "bg-white text-slate-900 hover:bg-white/90"
            }`}
          >
            {isGenerating ? "Generazione in corso…" : "Scarica decreto Word (.docx)"}
          </button>
        </div>

        <div className="text-xs text-white/60">
          Il Word viene generato partendo dal template originale e sostituendo i segnaposto presenti nel documento. La formattazione del modello resta invariata.
        </div>
      </div>
    </Card>
  );
});
