# Tribunale di Brindisi – Sezione Penale
## Webapp React (5 step) per liquidazione del gratuito patrocinio

### Avvio in locale
```bash
npm install
npm run dev
```

### Build / Preview
```bash
npm run build
npm run preview
```

### Deploy (link pubblico)
- **Vercel**: importa questo progetto (GitHub/zip), framework **Vite**, build `npm run build`, output `dist`.
- **Netlify**: build `npm run build`, publish `dist`.

### Note
- Componenti memoizzati (React.memo) + calcoli in useMemo.
- Input con stato locale e debounce (250ms) per evitare re-render/lag.
- Stepper cliccabile sugli step già completati.
- Anteprima: render del **testo template invariato** con sostituzione segnaposto; uso di `<pre>` con `whitespace-pre-wrap`.
- Generazione documento: download JSON.
