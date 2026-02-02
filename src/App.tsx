import React, { memo, useCallback, useMemo, useReducer, useRef, useState } from "react";
import JSZip from "jszip";

type TipoDifensore = "fiducia" | "ufficio";
type TipoAssistito = "imputato" | "parte_civile" | "persona_offesa";
type Complessita = "semplice" | "medio" | "complesso";
type AumentoAssistitiMode = "aumento30" | "aumento10";

type FasiPrincipale = { studio: boolean; introduttiva: boolean; istruttoria: boolean; decisionale: boolean };
type AssistitoExtra = { cognome: string; nome: string; luogoNascita: string; dataNascita: string };

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

export type AppState = {
  rgt: string;
  rgnr: string;
  siamm: string;

  giudice: Giudice;
  dataSentenza: string; // data udienza/sentenza
  numeroMod27: string;
  dataMod27: string;

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

  complessita: Complessita;
  fasiRichieste: FasiPrincipale;

  cautelarePresente: boolean;
  complessitaCautelare: Complessita;
  fasiCautelare: { studio: boolean; introduttiva: boolean; decisionale: boolean };

  assistitiMultipli: AssistitoExtra[];
  aumentoAssistitiMode: AumentoAssistitiMode;
};

type Action =
  | { type: "set"; key: keyof AppState; value: any }
  | { type: "setFasePrincipale"; key: keyof FasiPrincipale; value: boolean }
  | { type: "setFaseCautelare"; key: "studio" | "introduttiva" | "decisionale"; value: boolean }
  | { type: "addAssistito" }
  | { type: "removeAssistito"; idx: number }
  | { type: "setAssistito"; idx: number; key: keyof AssistitoExtra; value: string };

const initialState: AppState = {
  rgt: "",
  rgnr: "",
  siamm: "",

  giudice: "",
  dataSentenza: "",
  numeroMod27: "",
  dataMod27: "",

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

  complessita: "semplice",
  fasiRichieste: { studio: true, introduttiva: false, istruttoria: false, decisionale: true },

  cautelarePresente: false,
  complessitaCautelare: "semplice",
  fasiCautelare: { studio: false, introduttiva: false, decisionale: false },

  assistitiMultipli: [],
  aumentoAssistitiMode: "aumento30",
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };

    case "setFasePrincipale":
      return { ...state, fasiRichieste: { ...state.fasiRichieste, [action.key]: action.value } };

    case "setFaseCautelare":
      return { ...state, fasiCautelare: { ...state.fasiCautelare, [action.key]: action.value } };

    case "addAssistito":
      return { ...state, assistitiMultipli: [...state.assistitiMultipli, { cognome: "", nome: "", luogoNascita: "", dataNascita: "" }] };

    case "removeAssistito":
      return { ...state, assistitiMultipli: state.assistitiMultipli.filter((_, i) => i !== action.idx) };

    case "setAssistito":
      return { ...state, assistitiMultipli: state.assistitiMultipli.map((a, i) => (i === action.idx ? { ...a, [action.key]: action.value } : a)) };

    default:
      return state;
  }
}

function euroInt(n: number): string {
  const rounded = Math.round(n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

function computeCompensoCautelare(complessita: Complessita, fasi: { studio: boolean; introduttiva: boolean; decisionale: boolean }) {
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

function computeMaggiorazioneAssistiti(extraCount: number, mode: AumentoAssistitiMode) {
  const cappedExtra = Math.min(extraCount, 19); // max 20 soggetti totali
  const rate = mode === "aumento10" ? 0.10 : 0.30;
  return cappedExtra * rate;
}

function faseMotivazione(fase: keyof FasiPrincipale, riconosciuta: boolean): string {
  if (fase === "studio") {
    return riconosciuta
      ? "congruo comminare la fase di studio essendo stata documentata tale attività necessaria e propedeutica all'espletamento dell'incarico difensivo"
      : "non congruo comminare la fase di studio non risultando documentata tale attività necessaria e propedeutica all'espletamento dell'incarico difensivo";
  }
  if (fase === "introduttiva") {
    return riconosciuta
      ? "opportuno riconoscere la fase introduttiva risultando che il difensore abbia avanzato istanze rilevanti ai fini della suddetta fase"
      : "non opportuno riconoscere la fase introduttiva non risultando che il difensore abbia avanzato istanze rilevanti ai fini della suddetta fase";
  }
  if (fase === "istruttoria") {
    return riconosciuta
      ? "congruo liquidare la fase istruttoria dal momento che l'istante ha dimostrato di aver svolto e partecipato alle attività tipiche della fase istruttoria, quali la formulazione di richieste di prova in sede di apertura del dibattimento e la conseguente acquisizione di prove documentali e testimoniali"
      : "non congruo liquidare la fase istruttoria non risultando dimostrato lo svolgimento o la partecipazione alle attività tipiche della fase istruttoria, quali la formulazione di richieste di prova in sede di apertura del dibattimento e la conseguente acquisizione di prove documentali e testimoniali";
  }
  // decisionale
  return riconosciuta
    ? "congruo liquidare la fase decisionale dal momento che risulta provato che il difensore ha partecipato alla formulazione delle conclusioni e all'esito del giudizio"
    : "non congruo liquidare la fase decisionale non risultando provato che il difensore abbia partecipato alla formulazione delle conclusioni e all'esito del giudizio";
}

function buildMotivazioneSubCautelare(
  cautelarePresente: boolean,
  cautelare: ReturnType<typeof computeCompensoCautelare> | null,
  fasi: { studio: boolean; introduttiva: boolean; decisionale: boolean }
) {
  if (!cautelarePresente || !cautelare) {
    return "che non si debba procedere al riconoscimento di ulteriori importi relativi alla fase sub-procedimentale di natura cautelare essendo questa assente nel caso specifico";
  }
  const parts: string[] = [];
  if (fasi.studio) parts.push(`studio € ${euroInt(cautelare.studio)}`);
  if (fasi.introduttiva) parts.push(`introduttiva € ${euroInt(cautelare.introduttiva)}`);
  if (fasi.decisionale) parts.push(`decisionale € ${euroInt(cautelare.decisionale)}`);
  parts.push(`totale cautelare € ${euroInt(cautelare.totaleCalcoli)}`);
  return `che si debbano riconoscere ulteriori importi essendo stata prestata attività difensiva in ordine alla fase sub-procedimentale di natura cautelare e che pertanto si devono aggiungere i seguenti importi: ${parts.join("; ")}`;
}

function buildMotivazioneAssistiti(extraCount: number, mode: AumentoAssistitiMode) {
  if (extraCount <= 0) {
    return "che il difensore ha prestato la propria attività per un solo assistito e che quindi non vada riconosciuto alcun aumento ai sensi dell'art. 12, comma 2, D.M. n. 55/2014";
  }
  if (mode === "aumento10") {
    return "che il difensore istante ha assistito più soggetti nell'ambito del medesimo procedimento e che, ai sensi dell'art. 12, comma 2, D.M. n. 55/2014, va riconosciuto un aumento del 10%, per ogni soggetto, sull'importo già calcolato";
  }
  return "che il difensore istante ha assistito più soggetti nell'ambito del medesimo procedimento e che, ai sensi dell'art. 12, comma 2, D.M. n. 55/2014, va riconosciuto un aumento del 30%, per ogni soggetto, sull'importo già calcolato";
}

function xmlEscape(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function downloadDocxFromTemplate(replacements: Record<string, string>, filename: string) {
  const res = await fetch("/template.docx");
  if (!res.ok) throw new Error("Impossibile leggere il template Word (template.docx).");
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const docXmlPath = "word/document.xml";
  const docXmlFile = zip.file(docXmlPath);
  if (!docXmlFile) throw new Error("Template non valido: manca word/document.xml.");

  let xml = await docXmlFile.async("string");

  // Sostituzioni semplici: richiede segnaposto non spezzati su più run.
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

  return useCallback(
    ((...args: any[]) => {
      if (ref.current) window.clearTimeout(ref.current);
      ref.current = window.setTimeout(() => latest.current(...args), delayMs);
    }) as T,
    [delayMs]
  );
}

type InputFieldProps = { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string };
const InputField = memo(function InputField({ label, value, onChange, placeholder, type = "text", className }: InputFieldProps) {
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

const Pill = memo(function Pill({ children, tone }: { children: React.ReactNode; tone: "blue" | "violet" | "green" | "slate" }) {
  const cls = {
    blue: "bg-blue-500/15 text-blue-100 border-blue-200/20",
    violet: "bg-violet-500/15 text-violet-100 border-violet-200/20",
    green: "bg-emerald-500/15 text-emerald-100 border-emerald-200/20",
    slate: "bg-white/10 text-slate-100 border-white/15",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
});

const Card = memo(function Card({ title, children, tone = "slate" }: { title: string; children: React.ReactNode; tone?: "blue" | "violet" | "green" | "slate" }) {
  const border = { blue: "border-blue-200/20", violet: "border-violet-200/20", green: "border-emerald-200/20", slate: "border-white/15" }[tone];
  return (
    <div className={`rounded-2xl border ${border} bg-white/10 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.25)]`}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <Pill tone={tone}>{tone === "blue" ? "Principale" : tone === "violet" ? "Cautelare" : tone === "green" ? "Assistiti" : "Dati"}</Pill>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
});

const Stepper = memo(function Stepper({ current, maxCompleted, onGo }: { current: number; maxCompleted: number; onGo: (idx: number) => void }) {
  const steps = ["1. Dati generali", "2. Importi principale", "3. Subprocedimento cautelare", "4. Assistiti multipli", "5. Genera Word"];
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

const CalcBox = memo(function CalcBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
      <div className="text-xs font-semibold text-white/60">{title}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
});

function validateStep1(state: AppState) {
  return Boolean((state.rgt || state.rgnr) && state.giudice && state.avvocato && (state.assistitoCognome || state.assistitoNome));
}
function validateStep2(state: AppState) {
  return Object.values(state.fasiRichieste).some(Boolean);
}
function validateStep3(state: AppState) {
  if (!state.cautelarePresente) return true;
  return Object.values(state.fasiCautelare).some(Boolean);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [step, setStep] = useState(0);
  const [maxCompleted, setMaxCompleted] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>("");

  // auto-mode assistiti: se >10 soggetti totali, propone 10% (ma resta selezionabile)
  React.useEffect(() => {
    const totalSubjects = 1 + state.assistitiMultipli.length;
    const suggested: AumentoAssistitiMode = totalSubjects > 10 ? "aumento10" : "aumento30";
    if (state.assistitiMultipli.length > 0 && state.aumentoAssistitiMode !== suggested) {
      // solo suggerimento: non sovrascriviamo se l’utente ha già cambiato manualmente
    }
  }, [state.assistitiMultipli.length, state.aumentoAssistitiMode]);

  const principale = useMemo(() => computeCompensoPrincipale(state.complessita, state.fasiRichieste), [state.complessita, state.fasiRichieste]);
  const cautelare = useMemo(() => (state.cautelarePresente ? computeCompensoCautelare(state.complessitaCautelare, state.fasiCautelare) : null), [
    state.cautelarePresente,
    state.complessitaCautelare,
    state.fasiCautelare,
  ]);

  const extraCount = state.assistitiMultipli.length;
  const percAumento = useMemo(() => computeMaggiorazioneAssistiti(extraCount, state.aumentoAssistitiMode), [extraCount, state.aumentoAssistitiMode]);

  const baseTot = principale.totaleCalcoli + (cautelare?.totaleCalcoli ?? 0);
  const aumentoAssistitiEuro = useMemo(() => baseTot * percAumento, [baseTot, percAumento]);
  const totaleFinale = useMemo(() => baseTot + aumentoAssistitiEuro, [baseTot, aumentoAssistitiEuro]);

  const contributo4 = useMemo(() => totaleFinale * 0.04, [totaleFinale]);
  const imponibileIVA = useMemo(() => totaleFinale + contributo4, [totaleFinale, contributo4]);
  const iva22 = useMemo(() => imponibileIVA * 0.22, [imponibileIVA]);
  const totaleConIVA = useMemo(() => imponibileIVA + iva22, [imponibileIVA, iva22]);

  const motivazioni = useMemo(() => {
    const mStudio = faseMotivazione("studio", state.fasiRichieste.studio);
    const mIntro = faseMotivazione("introduttiva", state.fasiRichieste.introduttiva);
    const mIstr = faseMotivazione("istruttoria", state.fasiRichieste.istruttoria);
    const mDec = faseMotivazione("decisionale", state.fasiRichieste.decisionale);
    const mCaut = buildMotivazioneSubCautelare(state.cautelarePresente, cautelare, state.fasiCautelare);
    const mAss = buildMotivazioneAssistiti(extraCount, state.aumentoAssistitiMode);
    return { mStudio, mIntro, mIstr, mDec, mCaut, mAss };
  }, [state.fasiRichieste, state.cautelarePresente, state.fasiCautelare, cautelare, extraCount, state.aumentoAssistitiMode]);

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

    return {
      "{{RGT}}": state.rgt,
      "{{RGNR}}": state.rgnr,
      "{{SIAMM}}": state.siamm,

      "{{Giudice}}": state.giudice,

      "{{avvocato}}": state.avvocato,
      "{{assistito}}": assistitoFull,
      "{{data sentenza}}": dataSentenza,

      "{{Mod27}}": state.numeroMod27,
      "{{dataMod27}}": state.dataMod27,

      "{{motivazione studio}}": motivazioni.mStudio,
      "{{motivazione introduttiva}}": motivazioni.mIntro,
      "{{motivazione istruttoria}}": motivazioni.mIstr,
      "{{motivazione decisionale}}": motivazioni.mDec,

      "{{subcautelare}}": motivazioni.mCaut,
      "{{assistenza più assistiti}}": motivazioni.mAss,

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
  }, [state, motivazioni, principale, aumentoAssistitiEuro, totaleFinale]);

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
          <Step4 state={state} dispatch={dispatch} baseTot={baseTot} percAumento={percAumento} aumentoAssistitiEuro={aumentoAssistitiEuro} totaleFinale={totaleFinale} />
        ) : (
          <Step5
            state={state}
            principale={principale}
            cautelare={cautelare}
            percAumento={percAumento}
            aumentoAssistitiEuro={aumentoAssistitiEuro}
            totaleFinale={totaleFinale}
            contributo4={contributo4}
            iva22={iva22}
            totaleConIVA={totaleConIVA}
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
      </div>
    </div>
  );
}

const Step1 = memo(function Step1({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="grid gap-6">
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
              <div className="text-sm font-medium text-slate-100/90 mb-1">Giudice (menu a tendina)</div>
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
              <input type="checkbox" checked={state.domiciliatoPressoDifensore} onChange={(e) => dispatch({ type: "set", key: "domiciliatoPressoDifensore", value: e.target.checked })} className="h-4 w-4" />
              <div className="text-sm font-semibold text-white">Domiciliato presso il difensore</div>
            </label>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">
            <div className="font-semibold text-white mb-1">Motivazioni</div>
            <div>Le motivazioni sono standard e vengono generate automaticamente in base alle selezioni dei successivi step. Nel Word finale puoi eventualmente modificarle.</div>
          </div>
        </div>
      </Card>
    </div>
  );
});

const FaseCheckbox = memo(function FaseCheckbox({ label, checked, onToggle, tone }: { label: string; checked: boolean; onToggle: (v: boolean) => void; tone: "blue" | "violet" | "green" }) {
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
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "bg-cyan-400 border-cyan-400" : "bg-white/80 border-slate-300"}`}>
        {checked ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : null}
      </span>
    </button>
  );
});

const Step2 = memo(function Step2({ state, dispatch, principale }: { state: AppState; dispatch: React.Dispatch<Action>; principale: ReturnType<typeof computeCompensoPrincipale> }) {
  const t = DM55_A[state.complessita];
  return (
    <div className="grid gap-6">
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
              <FaseCheckbox
                label={`Introduttiva (€ ${t.introduttiva})`}
                checked={state.fasiRichieste.introduttiva}
                onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "introduttiva", value: v })}
                tone="blue"
              />
              <FaseCheckbox
                label={`Istruttoria (€ ${t.istruttoria})`}
                checked={state.fasiRichieste.istruttoria}
                onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "istruttoria", value: v })}
                tone="blue"
              />
              <FaseCheckbox
                label={`Decisionale (€ ${t.decisionale})`}
                checked={state.fasiRichieste.decisionale}
                onToggle={(v) => dispatch({ type: "setFasePrincipale", key: "decisionale", value: v })}
                tone="blue"
              />
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

          <div className="text-xs text-white/60">Calcolo: somma fasi selezionate → riduzione 1/3 → aggiunta rimborso spese forfettario 15%. (Importi arrotondati senza decimali.)</div>
        </div>
      </Card>
    </div>
  );
});

const Step3 = memo(function Step3({
  state,
  dispatch,
  cautelare,
}: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  cautelare: ReturnType<typeof computeCompensoCautelare> | null;
}) {
  const t = DM55_B[state.complessitaCautelare];
  return (
    <div className="grid gap-6">
      <Card title="Step 3 · Subprocedimento cautelare (D.M. 55/2014 – Allegato B)" tone="violet">
        <div className="grid gap-5">
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200/20 bg-violet-500/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-violet-100">Attiva subprocedimento cautelare</div>
              <div className="text-xs text-violet-100/70">Se OFF, la motivazione cautelare sarà negativa e non inciderà sui calcoli.</div>
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
                  <FaseCheckbox
                    label={`Introduttiva (€ ${t.introduttiva})`}
                    checked={state.fasiCautelare.introduttiva}
                    onToggle={(v) => dispatch({ type: "setFaseCautelare", key: "introduttiva", value: v })}
                    tone="violet"
                  />
                  <FaseCheckbox
                    label={`Decisionale (€ ${t.decisionale})`}
                    checked={state.fasiCautelare.decisionale}
                    onToggle={(v) => dispatch({ type: "setFaseCautelare", key: "decisionale", value: v })}
                    tone="violet"
                  />
                </div>
              </div>

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
    </div>
  );
});

const Step4 = memo(function Step4({
  state,
  dispatch,
  baseTot,
  percAumento,
  aumentoAssistitiEuro,
  totaleFinale,
}: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  baseTot: number;
  percAumento: number;
  aumentoAssistitiEuro: number;
  totaleFinale: number;
}) {
  const principaleFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(" ").trim() || "(assistito non compilato)";
  const totalSubjects = 1 + state.assistitiMultipli.length;

  return (
    <div className="grid gap-6">
      <Card title="Step 4 · Assistiti multipli (art. 12 D.M. 55/2014)" tone="green">
        <div className="grid gap-5">
          <div className="rounded-2xl border border-emerald-200/20 bg-emerald-500/10 p-4">
            <div className="text-sm font-semibold text-emerald-100">Assistito principale</div>
            <div className="mt-1 text-sm text-emerald-100/80">{principaleFull}</div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Assistiti aggiuntivi</div>
              <div className="text-xs text-white/60">Inserisci eventuali soggetti ulteriori. L’aumento viene calcolato secondo la modalità selezionata.</div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "addAssistito" })}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
            >
              Aggiungi assistito
            </button>
          </div>

          {state.assistitiMultipli.length > 0 ? (
            <label className="block max-w-md">
              <div className="text-sm font-medium text-slate-100/90 mb-1">Motivazione / criterio aumento (selezione)</div>
              <select
                value={state.aumentoAssistitiMode}
                onChange={(e) => dispatch({ type: "set", key: "aumentoAssistitiMode", value: e.target.value as AumentoAssistitiMode })}
                className="w-full rounded-xl border border-white/10 bg-white/90 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <option value="aumento30">Aumento 30% per ogni soggetto</option>
                <option value="aumento10">Aumento 10% per ogni soggetto</option>
              </select>
              <div className="mt-2 text-xs text-white/60">
                Nota: puoi scegliere la dicitura da inserire nel decreto. I calcoli vengono adeguati in base alla selezione.
              </div>
            </label>
          ) : null}

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CalcBox title="Numero assistiti totali" value={String(totalSubjects)} />
            <CalcBox title="Percentuale aumento complessiva" value={`${Math.round(percAumento * 100)}%`} />
            <CalcBox title="Aumento (Euro)" value={`€ ${euroInt(aumentoAssistitiEuro)}`} />
          </div>

          <div className="rounded-2xl border border-emerald-200/20 bg-white/10 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-white/70">Totale (principale + cautelare + aumenti)</div>
              <div className="text-xl font-extrabold text-white">€ {euroInt(totaleFinale)}</div>
            </div>
            <div className="mt-2 text-xs text-white/60">Base (principale+cautelare): € {euroInt(baseTot)} · Aumento applicato: {Math.round(percAumento * 100)}%</div>
          </div>
        </div>
      </Card>
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

const Step5 = memo(function Step5({
  state,
  principale,
  cautelare,
  percAumento,
  aumentoAssistitiEuro,
  totaleFinale,
  contributo4,
  iva22,
  totaleConIVA,
  onDownloadWord,
  isGenerating,
}: {
  state: AppState;
  principale: ReturnType<typeof computeCompensoPrincipale>;
  cautelare: ReturnType<typeof computeCompensoCautelare> | null;
  percAumento: number;
  aumentoAssistitiEuro: number;
  totaleFinale: number;
  contributo4: number;
  iva22: number;
  totaleConIVA: number;
  onDownloadWord: () => void;
  isGenerating: boolean;
}) {
  const assistitoFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(" ").trim();

  return (
    <div className="grid gap-6">
      <Card title="Step 5 · Genera decreto Word (.docx) dal template" tone="slate">
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
              <div className="text-sm font-semibold text-white mb-3">Riepilogo</div>
              <SummaryRow label="RGT / RGNR / SIAMM" value={`${state.rgt} · ${state.rgnr} · ${state.siamm}`} />
              <SummaryRow label="Giudice" value={state.giudice || "—"} />
              <SummaryRow label="Mod. 27 / Data" value={`${state.numeroMod27} · ${state.dataMod27}`} />
              <SummaryRow label="Data udienza/sentenza" value={state.dataSentenza || "—"} />
              <SummaryRow label="Avvocato" value={`${state.avvocato} (${state.tipoDifensore})`} />
              <SummaryRow label="Assistito" value={assistitoFull || "—"} />
              <SummaryRow label="Complessità principale" value={state.complessita} />
              <SummaryRow label="Cautelare" value={state.cautelarePresente ? `Sì (${state.complessitaCautelare})` : "No"} />
              <SummaryRow label="Assistiti aggiuntivi" value={String(state.assistitiMultipli.length)} />
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
              <div className="text-sm font-semibold text-white mb-3">Totali (arrotondati)</div>
              <SummaryRow label="Totale principale" value={`€ ${euroInt(principale.totaleCalcoli)}`} />
              <SummaryRow label="Totale cautelare" value={`€ ${euroInt(cautelare?.totaleCalcoli ?? 0)}`} />
              <SummaryRow label={`Aumenti assistiti (${Math.round(percAumento * 100)}%)`} value={`€ ${euroInt(aumentoAssistitiEuro)}`} />
              <SummaryRow label="Totale definitivo" value={`€ ${euroInt(totaleFinale)}`} />
              <SummaryRow label="+ 4% contributo previdenziale" value={`€ ${euroInt(contributo4)}`} />
              <SummaryRow label="+ 22% IVA (su totale + contributo)" value={`€ ${euroInt(iva22)}`} />
              <SummaryRow label="Totale complessivo" value={`€ ${euroInt(totaleConIVA)}`} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
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

          <div className="text-xs text-white/60">Il file Word viene generato partendo dal template aggiornato e sostituendo i segnaposto. La formattazione del modello resta invariata.</div>
        </div>
      </Card>
    </div>
  );
});
