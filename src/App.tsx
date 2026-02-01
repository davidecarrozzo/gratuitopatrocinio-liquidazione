import React, { memo, useCallback, useMemo, useReducer, useRef, useState } from 'react'

type TipoDifensore = 'fiducia' | 'ufficio'
type TipoAssistito = 'imputato' | 'parte_civile' | 'persona_offesa'
type Complessita = 'semplice' | 'medio' | 'complesso'

type FasiPrincipale = { studio: boolean; introduttiva: boolean; istruttoria: boolean; decisionale: boolean }
type FasiCautelare = { studio: boolean; introduttuttiva?: never; introduttiva: boolean; decisionale: boolean }

type AssistitoExtra = { cognome: string; nome: string; luogoNascita: string; dataNascita: string }

export type AppState = {
  rgt: string; rgnr: string; siamm: string;
  giudice: string; dataSentenza: string; dataUdienza: string;
  numeroMod27: string; dataMod27: string;
  avvocato: string; cfAvvocato: string; pivaAvvocato: string; tipoDifensore: TipoDifensore;

  assistitoCognome: string; assistitoNome: string;
  assistitoLuogoNascita: string; assistitoDataNascita: string;
  assistitoResidenza: string; domiciliatoPressoDifensore: boolean;
  tipoAssistito: TipoAssistito;

  complessita: Complessita;
  fasiRichieste: FasiPrincipale;

  cautelarePresente: boolean;
  complessitaCautelare: Complessita;
  fasiCautelare: { studio: boolean; introduttiva: boolean; decisionale: boolean };
  motivazioneCautelare: string;

  assistitiMultipli: AssistitoExtra[]; // solo extra (oltre il principale)
  motivazioneAssistiti: string;

  motivazioneStudio: string;
  motivazioneIntroduttiva: string;
  motivazioneIstruttoria: string;
  motivazioneDecisionale: string;
}

const initialState: AppState = {
  rgt: '', rgnr: '', siamm: '',
  giudice: '', dataSentenza: '', dataUdienza: '',
  numeroMod27: '', dataMod27: '',
  avvocato: '', cfAvvocato: '', pivaAvvocato: '', tipoDifensore: 'fiducia',

  assistitoCognome: '', assistitoNome: '',
  assistitoLuogoNascita: '', assistitoDataNascita: '',
  assistitoResidenza: '', domiciliatoPressoDifensore: false,
  tipoAssistito: 'imputato',

  complessita: 'semplice',
  fasiRichieste: { studio: true, introduttiva: false, istruttoria: false, decisionale: true },

  cautelarePresente: false,
  complessitaCautelare: 'semplice',
  fasiCautelare: { studio: false, introduttiva: false, decisionale: false },
  motivazioneCautelare: '',

  assistitiMultipli: [],
  motivazioneAssistiti: '',

  motivazioneStudio: '',
  motivazioneIntroduttiva: '',
  motivazioneIstruttoria: '',
  motivazioneDecisionale: '',
}

type Action =
  | { type: 'set'; key: keyof AppState; value: any }
  | { type: 'setFasePrincipale'; key: keyof FasiPrincipale; value: boolean }
  | { type: 'setFaseCautelare'; key: 'studio'|'introduttiva'|'decisionale'; value: boolean }
  | { type: 'addAssistito' }
  | { type: 'removeAssistito'; idx: number }
  | { type: 'setAssistito'; idx: number; key: keyof AssistitoExtra; value: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value }
    case 'setFasePrincipale':
      return { ...state, fasiRichieste: { ...state.fasiRichieste, [action.key]: action.value } }
    case 'setFaseCautelare':
      return { ...state, fasiCautelare: { ...state.fasiCautelare, [action.key]: action.value } }
    case 'addAssistito':
      return { ...state, assistitiMultipli: [...state.assistitiMultipli, { cognome: '', nome: '', luogoNascita: '', dataNascita: '' }] }
    case 'removeAssistito':
      return { ...state, assistitiMultipli: state.assistitiMultipli.filter((_, i) => i !== action.idx) }
    case 'setAssistito':
      return {
        ...state,
        assistitiMultipli: state.assistitiMultipli.map((a, i) => i === action.idx ? { ...a, [action.key]: action.value } : a),
      }
    default:
      return state
  }
}

function euro(n: number): string {
  const fixed = (Math.round(n * 100) / 100).toFixed(2)
  // IT format: 1.234,56
  const [intp, dec] = fixed.split('.')
  const intIt = intp.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${intIt},${dec}`
}

const DM55_A: Record<Complessita, { studio: number; introduttiva: number; istruttoria: number; decisionale: number }> = {
  semplice: { studio: 237, introduttiva: 284, istruttoria: 567, decisionale: 709 },
  medio: { studio: 473, introduttiva: 567, istruttoria: 1134, decisionale: 1418 },
  complesso: { studio: 710, introduttiva: 851, istruttoria: 1701, decisionale: 2127 },
}

const DM55_B: Record<Complessita, { studio: number; introduttiva: number; decisionale: number }> = {
  semplice: { studio: 189, introduttiva: 615, decisionale: 709 },
  medio: { studio: 378, introduttiva: 1229, decisionale: 1418 },
  complesso: { studio: 567, introduttiva: 1844, decisionale: 2127 },
}

function computeCompensoPrincipale(complessita: Complessita, fasi: FasiPrincipale) {
  const t = DM55_A[complessita]
  const studio = fasi.studio ? t.studio : 0
  const introduttiva = fasi.introduttiva ? t.introduttiva : 0
  const istruttoria = fasi.istruttoria ? t.istruttoria : 0
  const decisionale = fasi.decisionale ? t.decisionale : 0
  const totaleParziale = studio + introduttiva + istruttoria + decisionale
  const riduzione = totaleParziale / 3
  const totaleRidotto = totaleParziale - riduzione
  const rimborso15 = totaleRidotto * 0.15
  const totaleCalcoli = totaleRidotto + rimborso15
  return { studio, introduttiva, istruttoria, decisionale, totaleParziale, riduzione, totaleRidotto, rimborso15, totaleCalcoli }
}

function computeCompensoCautelare(complessita: Complessita, fasi: {studio:boolean; introduttiva:boolean; decisionale:boolean}) {
  const t = DM55_B[complessita]
  const studio = fasi.studio ? t.studio : 0
  const introduttiva = fasi.introduttiva ? t.introduttiva : 0
  const decisionale = fasi.decisionale ? t.decisionale : 0
  const totaleParziale = studio + introduttiva + decisionale
  const riduzione = totaleParziale / 3
  const totaleRidotto = totaleParziale - riduzione
  const rimborso15 = totaleRidotto * 0.15
  const totaleCalcoli = totaleRidotto + rimborso15
  return { studio, introduttiva, decisionale, totaleParziale, riduzione, totaleRidotto, rimborso15, totaleCalcoli }
}

function computeMaggiorazioneAssistiti(extraCount: number): number {
  // art. 12: +30% per ciascun soggetto oltre il primo fino a 10; +10% oltre i primi 10 fino a 20
  const cappedExtra = Math.min(extraCount, 19) // massimo 20 soggetti totali => 19 extra
  const firstBand = Math.min(cappedExtra, 9) // extra 1..9 => fino a 10 totali
  const secondBand = Math.max(0, cappedExtra - 9)
  return firstBand * 0.30 + secondBand * 0.10
}

function buildJsonOutput(state: AppState) {
  return {
    rgt: state.rgt, rgnr: state.rgnr, siamm: state.siamm,
    giudice: state.giudice, dataSentenza: state.dataSentenza || state.dataUdienza,
    numeroMod27: state.numeroMod27, dataMod27: state.dataMod27,
    avvocato: state.avvocato, cfAvvocato: state.cfAvvocato, pivaAvvocato: state.pivaAvvocato, tipoDifensore: state.tipoDifensore,
    assistitoCognome: state.assistitoCognome, assistitoNome: state.assistitoNome,
    assistitoLuogoNascita: state.assistitoLuogoNascita, assistitoDataNascita: state.assistitoDataNascita,
    assistitoResidenza: state.assistitoResidenza, domiciliatoPressoDifensore: state.domiciliatoPressoDifensore,
    tipoAssistito: state.tipoAssistito,
    complessita: state.complessita,
    fasiRichieste: state.fasiRichieste,
    cautelarePresente: state.cautelarePresente,
    complessitaCautelare: state.complessitaCautelare,
    fasiCautelare: state.fasiCautelare,
    assistitiMultipli: [
      // compatibilità con schema richiesto: include almeno un oggetto
      ...(state.assistitiMultipli.length ? state.assistitiMultipli : [{ cognome: '', nome: '', luogoNascita: '', dataNascita: '' }]),
    ],
    motivazioneStudio: state.motivazioneStudio,
    motivazioneIntroduttiva: state.motivazioneIntroduttiva,
    motivazioneIstruttoria: state.motivazioneIstruttoria,
    motivazioneDecisionale: state.motivazioneDecisionale,
    motivazioneAssistiti: state.motivazioneAssistiti,
    motivazioneCautelare: state.motivazioneCautelare,
  }
}

const TEMPLATE_TEXT = "N. {{RGT}} R.G.T.\nN. {{RGNR}} R.G.N.R.\nN. {{SIAMM}} SIAMM\n\n\nTRIBUNALE DI BRINDISI\nSezione Penale\nDECRETO DI LIQUIDAZIONE DEGLI ONORARI \nPROFESSIONALI\n(D.P.R. 30.5.2002 n. 115)\n\n\nIL TRIBUNALE\nnella persona del Giudice {{Giudice}}\n\n\n* Letta l’istanza di liquidazione delle competenze professionali avanzata dall’{{avvocato}}, in qualità di difensore di fiducia di {{assistito}}, imputato nel procedimento n. {{RGT}} R.G.T. (n. {{RGNR}} R.G.N.R.), definitosi all’udienza del {{data sentenza}};\n* Rilevato che l’istante veniva ammesso al patrocinio a spese dello Stato;\n* Ritenuta la propria competenza, visionati gli atti del procedimento;\n* Tenuto conto dei principi desumibili dalle vigenti disposizioni di legge e di regolamento, secondo cui:\n1. la liquidazione è effettuata al termine di ciascuna fase o grado del processo […] dall’autorità giudiziaria che ha proceduto, a meno che non si tratti di compensi dovuti per le fasi o i gradi anteriori del processo, se il provvedimento di ammissione al patrocinio è intervenuto dopo la loro definizione; la competenza per la liquidazione dei compensi maturati in relazione ai procedimenti incidentali della fase spetta al giudice della fase o del grado del processo principale in cui è stata svolta l'attività difensiva da remunerare (art. 83, d.P.R. 115/2002);\n2. non possono essere liquidati onorari per attività espletate prima dell’ammissione al patrocinio a spese dello Stato, poiché gli effetti dell'ammissione si producono a decorrere dalla data in cui l’istanza è stata presentata o è pervenuta all’ufficio del magistrato, ovvero a decorrere dal primo atto in cui interviene il difensore, se l’interessato fa riserva di presentare l’istanza e questa è presentata entro i venti giorni successivi (ex artt. 109 e 107, d.P.R. 115/2002);\n3. ai fini della liquidazione del compenso al difensore si tiene conto: “delle caratteristiche, dell'urgenza e del pregio dell'attività prestata, dell’importanza, della natura, della complessità del procedimento, della gravità e del numero delle imputazioni, del numero e della complessità delle questioni giuridiche e di fatto trattate, dei contrasti giurisprudenziali, dell'autorità giudiziaria dinanzi cui si svolge la prestazione, della rilevanza patrimoniale, del numero dei documenti e degli atti da esaminare, della continuità dell'impegno anche in relazione alla frequenza di trasferimenti fuori dal luogo ove svolge la professione in modo prevalente, nonché dell'esito ottenuto avuto anche riguardo alle conseguenze civili e alle condizioni finanziarie del cliente. Si tiene altresì conto del numero di udienze, pubbliche o camerali, diverse da quelle di mero rinvio, e del tempo necessario all'espletamento delle attività medesime. Il giudice tiene conto dei valori medi di cui alle tabelle allegate, che, in applicazione dei parametri generali, possono essere aumentati di regola fino al 50, ovvero possono essere diminuiti in ogni caso non oltre il 50%” (art. 12, D.M. n. 55/2014); altresì, “costituisce elemento di valutazione negativa, in sede di liquidazione giudiziale del compenso, l'adozione di condotte abusive tali da ostacolare la definizione dei procedimenti in tempi ragionevoli” (art. 4, comma 7, D.M. n. 55/2014);\n4. in caso di liquidazione del difensore di persona ammessa al gratuito patrocinio, altresì, si tiene specifico conto della concreta incidenza degli atti assunti rispetto alla posizione processuale della persona difesa (ex art. 12, cpv., D.M. n. 55/2014); gli importi spettanti al difensore sono ridotti di un terzo (ai sensi dell’art. 106-bis, d.P.R. n. 115/2002); il compenso per le impugnazioni coltivate dalla parte non è liquidato se le stesse sono dichiarate inammissibili (art. 106, comma 1, d.P.R. n.  115/2002); in caso di difensore che ha svolto la sua attività fuori dal luogo ove egli svolge la sua attività in modo prevalente non è dovuta l’indennità di trasferta prevista dalla tariffa professionale (ex art. 82 d.P.R. n. 115/2002);\n5. in caso di difensore che assiste più soggetti aventi la medesima posizione processuale, il compenso unico da liquidare può di regola essere aumentato per ogni soggetto oltre il primo nella misura del 30%, fino a un massimo di dieci soggetti, e del 10% per ogni soggetto oltre i primi dieci, fino a un massimo di venti. La disposizione del periodo precedente si applica anche quando il numero dei soggetti ovvero delle imputazioni è incrementato per effetto di riunione di più procedimenti, dal momento della disposta riunione, e anche quando il professionista difende un singolo soggetto contro più soggetti, sempre che la prestazione non comporti l'esame di medesime situazioni di fatto o di diritto. Quando, ferma l'identità di posizione procedimentale o processuale, la prestazione professionale non comporti l'esame di specifiche e distinte situazioni di fatto o di diritto in relazione ai diversi soggetti e in rapporto alle contestazioni, il compenso altrimenti liquidabile per l'assistenza di un solo soggetto è ridotto in misura non superiore al 30% (art. 12, cpv., D.M. n. 55/2014);\n6. è sempre dovuta una somma per rimborso spese forfettarie, nella misura del 15% del compenso totale della prestazione (art. 2, D.M. n. 55/2014).\n* Tenuto conto dei parametri previsti dai vigenti decreti ministeriali e dei criteri per la liquidazione dei compensi indicati nel Protocollo di intesa in materia di patrocinio a spese dello Stato sottoscritto in questo distretto, che sulla base dei parametri indicati di cui all’art. 12, D.M. n. 55/2014 ha suddiviso i procedimenti in tre categorie (“semplici”, “medi” e “complessi”), valorizzando in particolare:\n1. numero di testimoni escussi, complessità dell’attività istruttoria e della documentazione acquisita ed esaminata: è di regola semplice il processo nel quale viene ascoltato al massimo un testimone;\n2. numero e durata delle udienze, ad eccezione di quelle di mero rinvio; è di regola semplice il processo che si esaurisce nell’arco di una sola udienza di breve durata, complesso quello che si protragga per almeno 5 udienze;\n3. pendenza di misure cautelari: il procedimento nel quale sono o sono state applicate misure cautelari è di regola classificabile quanto meno come medio;\n4. numero e complessità delle questioni giuridiche e di fatto trattate; caratteristiche, urgenza e pregio dell’attività prestata; importanza, natura e complessità del procedimento; concreta incidenza degli atti assunti rispetto alla posizione processuale della parte assistita; rilevanza patrimoniale. È tendenzialmente complesso un procedimento relativo a reati associativi o di competenza della Corte d’Assise o comunque istruiti dalla Direzione Distrettuale Antimafia.\n* Rilevato che, considerando la natura dell’attività prestata, il grado di complessità del procedimento, il numero e la gravità delle imputazioni, la rilevanza delle questioni giuridiche e di fatto trattate, l’entità dell’impegno profuso, il numero di udienze celebrate, e la concreta incidenza che l’attività del difensore ha avuto sulla posizione del suo assistito, il procedimento deve qualificarsi come semplice e che si ritiene congruo liquidare le seguenti fasi:\n   * Ritenuto che {{motivazione studio}};\n   * Ritenuto che {{motivazione introduttiva}};\n   * Ritenuto che {{motivazione istruttoria}};\n   * Ritenuto che {{motivazione decisionale}};\n* Ritenuto che {{assistenza più assistiti}};\n* Ritenuto che {{subcautelare}};\n\n\nTanto considerato, si ritiene, pertanto, individuare l’importo da liquidare nel modo seguente:\n\n\nStudio\n\t€ {{importo studio}}\n\tIntroduttiva\n\t€ {{importo introduttiva}}\n\tIstruttoria\n\t€ {{importo istruttoria}}\n\tDecisionale\n\t€ {{importo decisionale}}\n\tTotale parziale\n\t€ {{importo tot parziale}}\n\tRiduzione di ⅓ ai sensi dell’art. 106-bis\n\t€ {{rid 1/3}}\n\tTotale parziale (ridotta come sopra)\n\t€ {{importo tot ridotto}}\n\tRimborso forfetario (15%)\n\t€ {{rimborso}}\n\tTotale aumentato come sopra\n\t€ {{totale calcoli}}\n\tAumenti dovuti all’assistenza di più parti\n\t€ {{Aumenti assistiti}}\n\tTotale definitivo\n\t{{totale finale}}\n\t\n\n\n\nP.Q.M.\n\n\nliquida, in favore dall’{{avvocato}}, in qualità di difensore d’ufficio di {{assistito}}, imputato nel procedimento indicato in epigrafe, la somma complessiva di Euro {{totale finale}}, oltre al 4% per contributo previdenziale forense, da calcolarsi sull’importo totale appena indicato, ed al 22% per I.V.A., da calcolarsi sul totale degli onorari, delle spese e del contributo previdenziale. \n* Pone la detta somma provvisoriamente a carico dello Stato, salvo recupero, e delega la Cancelleria all’emissione del relativo mandato.\n* Manda alla Cancelleria per gli adempimenti di rito.\n\n\nLe parti sono espressamente avvisate che avverso il presente decreto è possibile proporre opposizione al Presidente del Tribunale (ex artt. 84 e 170 d.P.R. n. 115/2002; art. 15, D.lgs. n. 150/2011), entro 30 giorni decorrenti dalla data odierna (in caso di decreto letto in udienza) o dalla data della notifica.\n\n\n\n\nBrindisi, _____________\n\n\n                                                                                              Il Giudice\n                                                                                                                                  {{giudice}}\n"

function renderTemplate(state: AppState, calcoli: ReturnType<typeof useMemo> extends infer T ? any : any) {
  // calcoli: oggetto precomputato nel componente (vedi sotto)
  let s = TEMPLATE_TEXT

  const assistitoFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(' ').trim()
  const avv = state.avvocato || ''
  const giud = state.giudice || ''

  const dataSentenza = state.dataSentenza || state.dataUdienza || ''
  const motivoAssistiti = state.motivazioneAssistiti || ''
  const motivoCaut = state.motivazioneCautelare || ''

  const replaceAll = (from: string, to: string) => {
    s = s.split(from).join(to)
  }

  replaceAll('{RGT}', state.rgt)
  replaceAll('{RGNR}', state.rgnr)
  replaceAll('{SIAMM}', state.siamm)
  replaceAll('{Giudice}', giud)
  replaceAll('{giudice}', giud)
  replaceAll('{avvocato}', avv)
  replaceAll('{assistito}', assistitoFull)
  replaceAll('{data sentenza}', dataSentenza)

  replaceAll('{motivazione studio}', state.motivazioneStudio || '')
  replaceAll('{motivazione introduttiva}', state.motivazioneIntroduttiva || '')
  replaceAll('{motivazione istruttoria}', state.motivazioneIstruttoria || '')
  replaceAll('{motivazione decisionale}', state.motivazioneDecisionale || '')

  replaceAll('{assistenza più assistiti}', motivoAssistiti)
  replaceAll('{subcautelare}', motivoCaut)

  replaceAll('{importo studio}', euro(calcoli.principale.studio))
  replaceAll('{importo introduttiva}', euro(calcoli.principale.introduttiva))
  replaceAll('{importo istruttoria}', euro(calcoli.principale.istruttoria))
  replaceAll('{importo decisionale}', euro(calcoli.principale.decisionale))
  replaceAll('{importo tot parziale}', euro(calcoli.principale.totaleParziale))
  replaceAll('{rid 1/3}', euro(calcoli.principale.riduzione))
  replaceAll('{importo tot ridotto}', euro(calcoli.principale.totaleRidotto))
  replaceAll('{rimborso}', euro(calcoli.principale.rimborso15))
  replaceAll('{totale calcoli}', euro(calcoli.principale.totaleCalcoli))
  replaceAll('{Aumenti assistiti}', euro(calcoli.aumentoAssistitiEuro))
  replaceAll('{totale finale}', euro(calcoli.totaleFinale))
  return s
}

function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delayMs: number) {
  const ref = useRef<number | null>(null)
  const latest = useRef(cb)
  latest.current = cb

  return useCallback(((...args: any[]) => {
    if (ref.current) window.clearTimeout(ref.current)
    ref.current = window.setTimeout(() => latest.current(...args), delayMs)
  }) as T, [delayMs])
}

type InputFieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}
const InputField = memo(function InputField({ label, value, onChange, placeholder, type = 'text', className }: InputFieldProps) {
  const [local, setLocal] = useState(value)
  const debounced = useDebouncedCallback((v: string) => onChange(v), 250)

  React.useEffect(() => {
    // sincronizza quando si naviga tra step o si resetta
    setLocal(value)
  }, [value])

  return (
    <label className={`block ${className ?? ''}`}>
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      <input
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setLocal(v)
          debounced(v)
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
})

type TextAreaFieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}
const TextAreaField = memo(function TextAreaField({ label, value, onChange, placeholder, className }: TextAreaFieldProps) {
  const [local, setLocal] = useState(value)
  const debounced = useDebouncedCallback((v: string) => onChange(v), 250)

  React.useEffect(() => setLocal(value), [value])

  return (
    <label className={`block ${className ?? ''}`}>
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      <textarea
        value={local}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setLocal(v)
          debounced(v)
        }}
        rows={4}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
})

const Pill = memo(function Pill({ children, tone }: { children: React.ReactNode; tone: 'blue'|'violet'|'green'|'slate' }) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tone]
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>
})

const Card = memo(function Card({ title, children, tone='slate' }: { title: string; children: React.ReactNode; tone?: 'blue'|'violet'|'green'|'slate' }) {
  const border = {
    blue: 'border-blue-200',
    violet: 'border-violet-200',
    green: 'border-emerald-200',
    slate: 'border-slate-200',
  }[tone]
  return (
    <div className={`rounded-2xl border ${border} bg-white shadow-sm`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Pill tone={tone}>{tone === 'blue' ? 'Principale' : tone === 'violet' ? 'Cautelare' : tone === 'green' ? 'Assistiti' : 'Dati'}</Pill>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
})

function Check({ checked }: { checked: boolean }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
      {checked ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : null}
    </span>
  )
}

const Stepper = memo(function Stepper({
  current,
  maxCompleted,
  onGo,
}: {
  current: number
  maxCompleted: number
  onGo: (idx: number) => void
}) {
  const steps = [
    '1. Dati generali',
    '2. Importi principale',
    '3. Subprocedimento cautelare',
    '4. Assistiti multipli',
    '5. Anteprima e genera',
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s, idx) => {
        const enabled = idx <= maxCompleted
        const active = idx === current
        return (
          <button
            key={s}
            type="button"
            onClick={() => enabled && onGo(idx)}
            className={
              `rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition
               ${active ? 'border-slate-900 bg-slate-900 text-white' : enabled ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50' : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'}`
            }
            aria-disabled={!enabled}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
})

const SummaryRow = memo(function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-sm font-semibold text-slate-900 text-right">{value}</div>
    </div>
  )
})

const Modal = memo(function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center p-4 md:p-8 overflow-auto">
        <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Chiudi
            </button>
          </div>
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
})

function validateStep1(state: AppState) {
  // requisito minimo per proseguire: RGT o RGNR, giudice, avvocato, assistito
  return Boolean((state.rgt || state.rgnr) && state.giudice && state.avvocato && (state.assistitoCognome || state.assistitoNome))
}

function validateStep2(state: AppState) {
  return Object.values(state.fasiRichieste).some(Boolean)
}

function validateStep3(state: AppState) {
  if (!state.cautelarePresente) return true
  return Object.values(state.fasiCautelare).some(Boolean)
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [step, setStep] = useState(0)
  const [maxCompleted, setMaxCompleted] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  const principale = useMemo(() => computeCompensoPrincipale(state.complessita, state.fasiRichieste), [state.complessita, state.fasiRichieste])
  const cautelare = useMemo(() => state.cautelarePresente ? computeCompensoCautelare(state.complessitaCautelare, state.fasiCautelare) : null, [state.cautelarePresente, state.complessitaCautelare, state.fasiCautelare])

  const extraCount = state.assistitiMultipli.length
  const percAumento = useMemo(() => computeMaggiorazioneAssistiti(extraCount), [extraCount])

  const baseTot = principale.totaleCalcoli + (cautelare?.totaleCalcoli ?? 0)
  const aumentoAssistitiEuro = useMemo(() => baseTot * percAumento, [baseTot, percAumento])
  const totaleFinale = useMemo(() => baseTot + aumentoAssistitiEuro, [baseTot, aumentoAssistitiEuro])

  const contributo4 = useMemo(() => totaleFinale * 0.04, [totaleFinale])
  const imponibileIVA = useMemo(() => totaleFinale + contributo4, [totaleFinale, contributo4])
  const iva22 = useMemo(() => imponibileIVA * 0.22, [imponibileIVA])
  const totaleConIVA = useMemo(() => imponibileIVA + iva22, [imponibileIVA, iva22])

  const calcoli = useMemo(() => ({
    principale,
    cautelare,
    baseTot,
    percAumento,
    aumentoAssistitiEuro,
    totaleFinale,
    contributo4,
    iva22,
    totaleConIVA,
  }), [principale, cautelare, baseTot, percAumento, aumentoAssistitiEuro, totaleFinale, contributo4, iva22, totaleConIVA])

  const templateRendered = useMemo(() => renderTemplate(state, calcoli), [state, calcoli])

  const canGoNext = useMemo(() => {
    if (step === 0) return validateStep1(state)
    if (step === 1) return validateStep2(state)
    if (step === 2) return validateStep3(state)
    return true
  }, [step, state])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    const next = Math.min(4, step + 1)
    setStep(next)
    setMaxCompleted((m) => Math.max(m, next))
  }, [canGoNext, step])

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const downloadJson = useCallback(() => {
    const payload = buildJsonOutput(state)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `liquidazione-gratuito-patrocinio-brindisi-${date}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [state])

  const header = (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">TRIBUNALE DI BRINDISI</div>
          <div className="text-xl md:text-2xl font-bold text-slate-900">Sezione Penale · Liquidazione gratuito patrocinio</div>
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
  )

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 space-y-6">
        {header}

        {step === 0 ? (
          <Step1 state={state} dispatch={dispatch} />
        ) : step === 1 ? (
          <Step2 state={state} dispatch={dispatch} calcoli={calcoli} />
        ) : step === 2 ? (
          <Step3 state={state} dispatch={dispatch} calcoli={calcoli} />
        ) : step === 3 ? (
          <Step4 state={state} dispatch={dispatch} calcoli={calcoli} />
        ) : (
          <Step5 state={state} calcoli={calcoli} onPreview={() => setPreviewOpen(true)} onDownload={downloadJson} />
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Indietro
          </button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className={
                  `rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition
                   ${canGoNext ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`
                }
              >
                Avanti
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Anteprima decreto (testo template invariato)">
        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap text-[13px] leading-5 font-mono text-slate-900">{templateRendered}</pre>
          </div>
          <div className="text-xs text-slate-500">
            Nota: l’anteprima rende il contenuto del template con sostituzione dei segnaposto, preservando spazi, tabulazioni e a-capo.
          </div>
        </div>
      </Modal>
    </div>
  )
}

const Step1 = memo(function Step1({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="grid gap-6">
      <Card title="Step 1 · Dati Generali" tone="slate">
        <div className="grid gap-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InputField label="Procedimento · N. R.G.T." value={state.rgt} onChange={(v) => dispatch({ type: 'set', key: 'rgt', value: v })} placeholder="es. 123/2025" />
            <InputField label="Procedimento · N. R.G.N.R." value={state.rgnr} onChange={(v) => dispatch({ type: 'set', key: 'rgnr', value: v })} placeholder="es. 456/2024" />
            <InputField label="Procedimento · N. SIAMM" value={state.siamm} onChange={(v) => dispatch({ type: 'set', key: 'siamm', value: v })} placeholder="es. 7890" />
            <InputField label="Data udienza/sentenza" value={state.dataSentenza} onChange={(v) => dispatch({ type: 'set', key: 'dataSentenza', value: v })} placeholder="gg/mm/aaaa" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Ammissione G.P. · N. Mod. 27" value={state.numeroMod27} onChange={(v) => dispatch({ type: 'set', key: 'numeroMod27', value: v })} placeholder="es. 27/2025" />
            <InputField label="Ammissione G.P. · Data decreto ammissione" value={state.dataMod27} onChange={(v) => dispatch({ type: 'set', key: 'dataMod27', value: v })} placeholder="gg/mm/aaaa" />
            <InputField label="Giudice (titolo + nome completo)" value={state.giudice} onChange={(v) => dispatch({ type: 'set', key: 'giudice', value: v })} placeholder="es. dott. Mario Rossi" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InputField label="Avvocato · Nome e Cognome" value={state.avvocato} onChange={(v) => dispatch({ type: 'set', key: 'avvocato', value: v })} placeholder="es. avv. Giulia Bianchi" className="md:col-span-2" />
            <label className="block">
              <div className="text-sm font-medium text-slate-700 mb-1">Avvocato · Tipo</div>
              <select
                value={state.tipoDifensore}
                onChange={(e) => dispatch({ type: 'set', key: 'tipoDifensore', value: e.target.value as TipoDifensore })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fiducia">fiducia</option>
                <option value="ufficio">ufficio</option>
              </select>
            </label>
            <InputField label="Avvocato · C.F." value={state.cfAvvocato} onChange={(v) => dispatch({ type: 'set', key: 'cfAvvocato', value: v })} placeholder="codice fiscale" />
            <InputField label="Avvocato · P.IVA" value={state.pivaAvvocato} onChange={(v) => dispatch({ type: 'set', key: 'pivaAvvocato', value: v })} placeholder="partita IVA" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InputField label="Assistito · Cognome" value={state.assistitoCognome} onChange={(v) => dispatch({ type: 'set', key: 'assistitoCognome', value: v })} />
            <InputField label="Assistito · Nome" value={state.assistitoNome} onChange={(v) => dispatch({ type: 'set', key: 'assistitoNome', value: v })} />
            <InputField label="Assistito · Luogo di nascita" value={state.assistitoLuogoNascita} onChange={(v) => dispatch({ type: 'set', key: 'assistitoLuogoNascita', value: v })} />
            <InputField label="Assistito · Data di nascita" value={state.assistitoDataNascita} onChange={(v) => dispatch({ type: 'set', key: 'assistitoDataNascita', value: v })} placeholder="gg/mm/aaaa" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Assistito · Residenza" value={state.assistitoResidenza} onChange={(v) => dispatch({ type: 'set', key: 'assistitoResidenza', value: v })} className="md:col-span-2" />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={state.domiciliatoPressoDifensore}
                onChange={(e) => dispatch({ type: 'set', key: 'domiciliatoPressoDifensore', value: e.target.checked })}
                className="h-4 w-4"
              />
              <div className="text-sm font-semibold text-slate-800">Domiciliato presso il difensore</div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <div className="text-sm font-medium text-slate-700 mb-1">Qualità assistito</div>
              <select
                value={state.tipoAssistito}
                onChange={(e) => dispatch({ type: 'set', key: 'tipoAssistito', value: e.target.value as TipoAssistito })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="imputato">imputato</option>
                <option value="parte_civile">parte civile</option>
                <option value="persona_offesa">persona offesa</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextAreaField label="Motivazione · Fase di studio" value={state.motivazioneStudio} onChange={(v) => dispatch({ type: 'set', key: 'motivazioneStudio', value: v })} placeholder="es. attività svolta nella fase di studio…" />
            <TextAreaField label="Motivazione · Fase introduttiva" value={state.motivazioneIntroduttiva} onChange={(v) => dispatch({ type: 'set', key: 'motivazioneIntroduttiva', value: v })} placeholder="es. attività svolta nella fase introduttiva…" />
            <TextAreaField label="Motivazione · Fase istruttoria" value={state.motivazioneIstruttoria} onChange={(v) => dispatch({ type: 'set', key: 'motivazioneIstruttoria', value: v })} placeholder="es. attività svolta nella fase istruttoria…" />
            <TextAreaField label="Motivazione · Fase decisionale" value={state.motivazioneDecisionale} onChange={(v) => dispatch({ type: 'set', key: 'motivazioneDecisionale', value: v })} placeholder="es. attività svolta nella fase decisionale…" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900 mb-1">Suggerimento operativo</div>
            <div>
              Per abilitare lo step successivo inserisci almeno: (RGT o RGNR), Giudice, Avvocato e Assistito.
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})

const Step2 = memo(function Step2({ state, dispatch, calcoli }: { state: AppState; dispatch: React.Dispatch<Action>; calcoli: any }) {
  const t = DM55_A[state.complessita]
  return (
    <div className="grid gap-6">
      <Card title="Step 2 · Importi Procedimento Principale (D.M. 55/2014 – Allegato A)" tone="blue">
        <div className="grid gap-5">
          <label className="block max-w-sm">
            <div className="text-sm font-medium text-slate-700 mb-1">Complessità</div>
            <select
              value={state.complessita}
              onChange={(e) => dispatch({ type: 'set', key: 'complessita', value: e.target.value as Complessita })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="semplice">Semplice</option>
              <option value="medio">Medio</option>
              <option value="complesso">Complesso</option>
            </select>
          </label>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-900 mb-3">Fasi da liquidare</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <FaseCheckbox label={`Studio (€ ${t.studio})`} checked={state.fasiRichieste.studio} onToggle={(v) => dispatch({ type: 'setFasePrincipale', key: 'studio', value: v })} />
              <FaseCheckbox label={`Introduttiva (€ ${t.introduttiva})`} checked={state.fasiRichieste.introduttiva} onToggle={(v) => dispatch({ type: 'setFasePrincipale', key: 'introduttiva', value: v })} />
              <FaseCheckbox label={`Istruttoria (€ ${t.istruttoria})`} checked={state.fasiRichieste.istruttoria} onToggle={(v) => dispatch({ type: 'setFasePrincipale', key: 'istruttoria', value: v })} />
              <FaseCheckbox label={`Decisionale (€ ${t.decisionale})`} checked={state.fasiRichieste.decisionale} onToggle={(v) => dispatch({ type: 'setFasePrincipale', key: 'decisionale', value: v })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CalcBox title="Totale parziale" value={`€ ${euro(calcoli.principale.totaleParziale)}`} />
            <CalcBox title="Riduzione 1/3 (art. 106-bis)" value={`€ -${euro(calcoli.principale.riduzione)}`} />
            <CalcBox title="Rimborso spese 15%" value={`€ ${euro(calcoli.principale.rimborso15)}`} />
          </div>

          <div className="rounded-2xl border border-blue-200 bg-white p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-slate-600">Totale (ridotto + rimborso 15%)</div>
              <div className="text-xl font-extrabold text-slate-900">€ {euro(calcoli.principale.totaleCalcoli)}</div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Calcolo: somma fasi selezionate → riduzione 1/3 → aggiunta rimborso spese forfettario 15%.
          </div>
        </div>
      </Card>
    </div>
  )
})

const FaseCheckbox = memo(function FaseCheckbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition ${checked ? 'border-blue-300 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <Check checked={checked} />
    </button>
  )
})

const CalcBox = memo(function CalcBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  )
})

const Step3 = memo(function Step3({ state, dispatch, calcoli }: { state: AppState; dispatch: React.Dispatch<Action>; calcoli: any }) {
  const t = DM55_B[state.complessitaCautelare]
  return (
    <div className="grid gap-6">
      <Card title="Step 3 · Subprocedimento cautelare (D.M. 55/2014 – Allegato B)" tone="violet">
        <div className="grid gap-5">
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-violet-900">Attiva subprocedimento cautelare</div>
              <div className="text-xs text-violet-700">Toggle ON/OFF (se OFF non incide sui calcoli)</div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'set', key: 'cautelarePresente', value: !state.cautelarePresente })}
              className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${state.cautelarePresente ? 'bg-violet-700 text-white' : 'bg-white border border-violet-200 text-violet-800'}`}
            >
              {state.cautelarePresente ? 'ON' : 'OFF'}
            </button>
          </label>

          {state.cautelarePresente ? (
            <>
              <label className="block max-w-sm">
                <div className="text-sm font-medium text-slate-700 mb-1">Complessità cautelare</div>
                <select
                  value={state.complessitaCautelare}
                  onChange={(e) => dispatch({ type: 'set', key: 'complessitaCautelare', value: e.target.value as Complessita })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="semplice">Semplice</option>
                  <option value="medio">Medio</option>
                  <option value="complesso">Complesso</option>
                </select>
              </label>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="text-sm font-semibold text-violet-900 mb-3">Fasi da liquidare</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FaseCheckboxV title={`Studio (€ ${t.studio})`} checked={state.fasiCautelare.studio} onToggle={(v) => dispatch({ type: 'setFaseCautelare', key: 'studio', value: v })} />
                  <FaseCheckboxV title={`Introduttiva (€ ${t.introduttiva})`} checked={state.fasiCautelare.introduttiva} onToggle={(v) => dispatch({ type: 'setFaseCautelare', key: 'introduttiva', value: v })} />
                  <FaseCheckboxV title={`Decisionale (€ ${t.decisionale})`} checked={state.fasiCautelare.decisionale} onToggle={(v) => dispatch({ type: 'setFaseCautelare', key: 'decisionale', value: v })} />
                </div>
              </div>

              <TextAreaField
                label="Motivazione cautelare"
                value={state.motivazioneCautelare}
                onChange={(v) => dispatch({ type: 'set', key: 'motivazioneCautelare', value: v })}
                placeholder="es. attività svolta nel subprocedimento cautelare…"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CalcBox title="Totale parziale" value={`€ ${euro(calcoli.cautelare?.totaleParziale ?? 0)}`} />
                <CalcBox title="Riduzione 1/3" value={`€ -${euro(calcoli.cautelare?.riduzione ?? 0)}`} />
                <CalcBox title="Rimborso 15%" value={`€ ${euro(calcoli.cautelare?.rimborso15 ?? 0)}`} />
              </div>

              <div className="rounded-2xl border border-violet-200 bg-white p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-sm text-slate-600">Totale cautelare (ridotto + rimborso 15%)</div>
                  <div className="text-xl font-extrabold text-slate-900">€ {euro(calcoli.cautelare?.totaleCalcoli ?? 0)}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">
              Subprocedimento cautelare disattivato.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
})

const FaseCheckboxV = memo(function FaseCheckboxV({ title, checked, onToggle }: { title: string; checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition ${checked ? 'border-violet-300 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'bg-violet-700 border-violet-700' : 'bg-white border-slate-300'}`}>
        {checked ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : null}
      </span>
    </button>
  )
})

const Step4 = memo(function Step4({ state, dispatch, calcoli }: { state: AppState; dispatch: React.Dispatch<Action>; calcoli: any }) {
  const principaleFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(' ').trim() || '(assistito non compilato)'
  const totalSubjects = 1 + state.assistitiMultipli.length
  return (
    <div className="grid gap-6">
      <Card title="Step 4 · Assistiti multipli (art. 12 D.M. 55/2014)" tone="green">
        <div className="grid gap-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-900">Assistito principale</div>
            <div className="mt-1 text-sm text-emerald-800">{principaleFull}</div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Assistiti aggiuntivi</div>
              <div className="text-xs text-slate-500">Ogni assistito oltre il primo: +30% fino a 10; +10% oltre (max 20 totali).</div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'addAssistito' })}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              Aggiungi assistito
            </button>
          </div>

          <div className="grid gap-4">
            {state.assistitiMultipli.length === 0 ? (
              <div className="text-sm text-slate-600">Nessun assistito aggiuntivo inserito.</div>
            ) : (
              state.assistitiMultipli.map((a, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-semibold text-slate-900">Assistito #{idx + 2}</div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'removeAssistito', idx })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Rimuovi
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <InputField label="Cognome" value={a.cognome} onChange={(v) => dispatch({ type: 'setAssistito', idx, key: 'cognome', value: v })} />
                    <InputField label="Nome" value={a.nome} onChange={(v) => dispatch({ type: 'setAssistito', idx, key: 'nome', value: v })} />
                    <InputField label="Luogo nascita" value={a.luogoNascita} onChange={(v) => dispatch({ type: 'setAssistito', idx, key: 'luogoNascita', value: v })} />
                    <InputField label="Data nascita" value={a.dataNascita} onChange={(v) => dispatch({ type: 'setAssistito', idx, key: 'dataNascita', value: v })} placeholder="gg/mm/aaaa" />
                  </div>
                </div>
              ))
            )}
          </div>

          <TextAreaField
            label="Motivazione assistiti (art. 12 D.M. 55/2014)"
            value={state.motivazioneAssistiti}
            onChange={(v) => dispatch({ type: 'set', key: 'motivazioneAssistiti', value: v })}
            placeholder="es. identità di posizione processuale, attività svolta per ciascun assistito…"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CalcBox title="Numero assistiti totali" value={String(totalSubjects)} />
            <CalcBox title="Maggiorazione percentuale" value={`${Math.round(calcoli.percAumento * 100)}%`} />
            <CalcBox title="Aumento (Euro)" value={`€ ${euro(calcoli.aumentoAssistitiEuro)}`} />
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-slate-600">Totale (principale + cautelare + aumenti)</div>
              <div className="text-xl font-extrabold text-slate-900">€ {euro(calcoli.totaleFinale)}</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})

const Step5 = memo(function Step5({
  state,
  calcoli,
  onPreview,
  onDownload,
}: {
  state: AppState
  calcoli: any
  onPreview: () => void
  onDownload: () => void
}) {
  const assistitoFull = [state.assistitoCognome, state.assistitoNome].filter(Boolean).join(' ').trim()
  return (
    <div className="grid gap-6">
      <Card title="Step 5 · Anteprima e genera" tone="slate">
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Riepilogo</div>
              <SummaryRow label="RGT / RGNR / SIAMM" value={`${state.rgt} · ${state.rgnr} · ${state.siamm}`} />
              <SummaryRow label="Giudice" value={state.giudice} />
              <SummaryRow label="Avvocato" value={`${state.avvocato} (${state.tipoDifensore})`} />
              <SummaryRow label="Assistito" value={assistitoFull} />
              <SummaryRow label="Complessità principale" value={state.complessita} />
              <SummaryRow label="Cautelare" value={state.cautelarePresente ? `Sì (${state.complessitaCautelare})` : 'No'} />
              <SummaryRow label="Assistiti aggiuntivi" value={String(state.assistitiMultipli.length)} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Totali</div>
              <SummaryRow label="Totale principale" value={`€ ${euro(calcoli.principale.totaleCalcoli)}`} />
              <SummaryRow label="Totale cautelare" value={`€ ${euro(calcoli.cautelare?.totaleCalcoli ?? 0)}`} />
              <SummaryRow label="Aumenti assistiti" value={`€ ${euro(calcoli.aumentoAssistitiEuro)}`} />
              <SummaryRow label="Totale definitivo" value={`€ ${euro(calcoli.totaleFinale)}`} />
              <SummaryRow label="+ 4% contributo previdenziale" value={`€ ${euro(calcoli.contributo4)}`} />
              <SummaryRow label="+ 22% IVA (su totale + contributo)" value={`€ ${euro(calcoli.iva22)}`} />
              <SummaryRow label="Totale complessivo" value={`€ ${euro(calcoli.totaleConIVA)}`} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              onClick={onPreview}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Anteprima (modal)
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Genera documento (JSON)
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Il file scaricato contiene tutti i campi secondo la struttura JSON richiesta.
          </div>
        </div>
      </Card>
    </div>
  )
})
