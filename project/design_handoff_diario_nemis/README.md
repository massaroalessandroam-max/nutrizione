# Handoff: Diario Nemis — App di tracciamento nutrizionale gamificata

## Overview
Prototipo di un'app (web responsive, mobile-first) che aumenta la retention dei pazienti di una società di nutrizionisti tramite la registrazione quotidiana dei pasti. Il paziente registra colazione, pranzo, cena, spuntini (o segnala il digiuno intermittente) via **testo, audio o foto**. Ogni alimento viene confrontato con il piano alimentare consigliato ("Metodo Nemis") e riceve un voto; il pasto ottiene un giudizio sintetico **"Buona scelta"**. L'attività è premiata con una **gamification** (punti, streak, badge, progresso settimanale). Il paziente sceglie la frequenza di invio del report al nutrizionista (ogni pasto / più pasti / una volta al giorno / manuale) e può **esportare in PDF** e **inviare su WhatsApp**. È inclusa una **vista nutrizionista collegata** che riceve i report in tempo reale.

## About the Design Files
I file in questo bundle sono **riferimenti di design realizzati in HTML** — un prototipo che mostra aspetto e comportamento previsti, **non** codice di produzione da copiare direttamente. Il compito è **ricreare questi design nell'ambiente del codebase di destinazione** (React, Vue, React Native, SwiftUI, ecc.) usando i suoi pattern e le sue librerie consolidate. Se non esiste ancora un ambiente, scegliere il framework più appropriato e implementare lì i design.

Il prototipo è costruito come un singolo "Design Component" (`.dc.html`): il markup è nel template, la logica in una classe `Component`. Serve solo come specifica visiva e comportamentale.

## Fidelity
**High-fidelity (hifi).** Colori, tipografia, spaziature, raggi, ombre e interazioni sono definitivi. Ricreare la UI in modo fedele usando le librerie/pattern del codebase.

⚠️ **Nota brand:** palette e font (Poppins via Google Fonts) sono stati ricostruiti da screenshot del sito Nemis, **non** da asset ufficiali. Prima dell'implementazione in produzione, sostituire con i token di colore e il font brand reali.

## Screens / Views

### 1. Role switch (header globale)
- **Purpose:** passare tra vista Paziente e vista Nutrizionista (nel prodotto reale saranno due app/ruoli distinti; qui è un toggle di prototipazione).
- **Layout:** due bottoni affiancati (`flex`, gap 6px), padding `14px 16px 10px`.
- **Componenti:** bottone attivo `background:#17241C; color:#fff`; inattivo `background:rgba(23,36,28,.06); color:#6E7B71`. Radius 11px, font 13px/600.

### 2. Diario del giorno (Paziente → tab Diario)
- **Purpose:** vista principale; stato della giornata e accesso rapido alla registrazione.
- **Layout:** colonna, padding `6px 20px 20px`, contenuto verticale con gap.
- **Componenti:**
  - **Header:** eyebrow data (`12px/600`, uppercase, letter-spacing .14em, `#8A9990`) + saluto (`23px/700`). A destra due pill: streak (icona fiamma `#E2A32C`, sfondo `#FFF3DC`, bordo `#F0DCA8`) e punti (icona check `#2E8B57`, sfondo `#E7F3EB`, bordo `#BFE0CC`). Pill: radius 999px, padding `6px 11px`.
  - **Card anello giornata:** `background:linear-gradient(150deg,#2E8B57,#1C5E41)`, radius 22px, padding 20px, ombra `0 12px 26px rgba(28,94,65,.28)`, testo bianco. Anello SVG (r=48, stroke-width 10, traccia `rgba(255,255,255,.22)`, progresso `#F4D06A`, linecap round, `stroke-dashoffset` = `circ*(1 - pastiFatti/4)`). Centro: "N/4" (26px/700) + "PASTI" (10px). A destra headline + sottotitolo + barra "Obiettivo settimana" (traccia `rgba(255,255,255,.24)`, fill `#F4D06A`, altezza 7px, radius 999px, width = percentuale).
  - **Lista pasti** (Colazione, Pranzo, Cena, Spuntino): card bianche, radius 16px, bordo `rgba(23,36,28,.07)`, padding `12px 14px`, `flex` gap 13px. Icona quadrata 44px radius 13px (sfondo `#E7F3EB`/testo `#1C5E41` se fatto, altrimenti `#EFEADD`/`#8A9990`) con sigla (COL/PRA/CEN/SPU). Titolo 15px/600 + orario 11px `#8A9990`; sotto anteprima alimenti 12.5px `#6E7B71` (ellissi). A destra: se fatto un badge giudizio; se da fare un "+" `#2E8B57`. Click → apre la sheet di registrazione su quel pasto.
  - **Card digiuno (mini):** `background:#17241C`, testo bianco, radius 18px; icona orologio `#F4D06A`; mostra stato ("In corso · Nh Mm") e percentuale.
  - **CTA "Registra un pasto":** full-width, `background:#2E8B57`, radius 16px, padding 16px, testo bianco 15px/600, ombra `0 10px 22px rgba(46,139,87,.32)`, icona "+".

### 3. Sheet "Registra" (bottom sheet)
- **Purpose:** registrare un pasto in testo, audio o foto.
- **Layout:** overlay `rgba(23,36,28,.42)` + pannello ancorato in basso, radius top 26px, animazione slide-up `nm-sheet .28s ease`, `max-height:94%`, scroll interno. Handle 40×4px.
- **Componenti:**
  - **Chip selezione pasto:** pill Colazione/Pranzo/Cena/Spuntino; attivo `#2E8B57`/bianco, inattivo bianco/bordo.
  - **Tab modalità:** contenitore `#EFEADD` radius 13px padding 4px; tab attivo `background:#fff` con ombra, testo `#1C5E41`; icone testo/audio/foto.
  - **Testo:** textarea min-height 110px, bordo `rgba(23,36,28,.12)`, radius 14px, 14.5px, placeholder di esempio; hint "separa con virgola".
  - **Audio:** bottone mic 64px tondo (`#2E8B57`, in registrazione `#D06A3C` con `nm-pulse`), barre waveform animate (`nm-rec`), label di stato; a fine registrazione compare la trascrizione in un box `#F4F0E6`.
  - **Foto:** dropzone tratteggiata ("Scatta o carica una foto"); dopo l'aggiunta mostra anteprima + chip "riconosciuto nella foto" con voto colore.
  - **CTA "Analizza pasto":** full-width `#2E8B57`, radius 14px, 15px/600.

### 4. Riepilogo pasto / "Buona scelta" (overlay)
- **Purpose:** mostrare l'esito del match col piano e i punti guadagnati.
- **Layout:** overlay full-screen, animazione `nm-rise .3s`. Testata con gradiente dipendente dall'esito: buono `#2E8B57→#1C5E41` (+ confetti animati `nm-conf`), medio `#B67B12→#8a5c0d`, scarso `#C0502A→#8f3a1c`. Emoji in cerchio (`nm-pop`), titolo giudizio, sottotitolo incoraggiante, pill "+N punti" (icona stella `#F4D06A`).
- **Corpo:** lista alimenti; ogni riga card bianca con icona voto (✓ consigliato `#2E8B57`/`#E7F3EB`, ~ consentito `#B67B12`/`#FFF3DC`, ✕ da limitare `#D06A3C`/`#FBE7DE`), nome 14px/600 e verdetto testuale colorato. In fondo: "Chiudi" e "Invia al nutrizionista".

### 5. Premi (Paziente → tab Premi)
- 3 stat card (giorni di fila, punti totali, obiettivi). Grafico settimana a barre (7 giorni; passati `#2E8B57`, oggi `#F4D06A`, futuri `#EFEADD`). Griglia badge 2 colonne (guadagnati pieni, futuri opacizzati).

### 6. Digiuno intermittente (Paziente → tab Digiuno)
- Protocollo 16:8. Anello grande (r=92, stroke 15) su card `#17241C`, timer **live** (HH:MM:SS) che avanza ogni secondo, stato, obiettivo 16:00. Bottone Inizia/Termina. Due card: inizio digiuno / prossimo pasto.

### 7. Report (Paziente → tab Report)
- Scelta frequenza invio (4 radio-card: Ad ogni pasto / Più pasti insieme / Una volta al giorno / Solo manuale); selezionato `background:#E7F3EB`, bordo `#2E8B57`. Anteprima report di oggi con righe pasto + badge giudizio e "Aderenza giornata %". CTA: **Esporta PDF** (outline verde) e **WhatsApp** (`#25D366`).

### 8. Nutritionist — lista pazienti
- 3 stat (report oggi / da ricontattare / aderenza media). Lista pazienti: avatar iniziali colorato per stato, nome, ultimo pasto, badge aderenza, orario. Click → dettaglio.

### 9. Nutritionist — dettaglio paziente
- Header paziente + piano. 3 stat (aderenza, giorni, pasti/oggi). "Diario di oggi": card per pasto con badge giudizio e chip alimenti con voto. CTA "Scarica PDF del diario".

## Interactions & Behavior
- **Navigazione:** bottom nav a 4 voci (Diario, Premi, Digiuno, Report) cambia `tab`. Toggle ruolo cambia `role`.
- **Registrazione:** click su pasto o CTA apre la sheet con `activeMeal` preselezionato. "Analizza pasto" calcola i voti, marca il pasto come fatto, somma i punti e apre il riepilogo.
- **Match alimenti:** ogni alimento è classificato `good`/`ok`/`bad` confrontando il testo (lowercase, `includes`) con due liste (`CONSIGLIATI`, `SCONSIGLIATI`). Giudizio pasto: nessun `bad` + almeno un `good` → "Buona scelta"; ≥2 `bad` → "Da rivedere"; altrimenti "Nel complesso ok". Punti: good=15, ok=8, bad=3.
- **Audio:** toggle registrazione → al secondo tap genera una trascrizione di esempio nel campo testo.
- **Foto:** tap dropzone → mostra elenco alimenti riconosciuti (mock).
- **Digiuno:** timer live via `setInterval(1000)` che forza il re-render mentre `fastActive` è true.
- **Toast:** conferme ("PDF generato", "Report inviato su WhatsApp", "Pasto inviato al nutrizionista") con auto-dismiss ~2.6s.
- **Animazioni (keyframes):** `nm-pulse` (mic), `nm-rec` (waveform), `nm-pop` (emoji), `nm-rise` (entrate), `nm-conf` (confetti), `nm-sheet` (slide-up sheet).
- **Responsive:** colonna app centrata, `max-width:452px`; scala su schermi piccoli mantenendo hit target ≥44px.

## State Management
Variabili di stato principali:
- `role` ('paziente' | 'nutrizionista'), `tab` ('diario'|'premi'|'digiuno'|'report')
- `sheetOpen`, `summaryOpen`, `activeMeal`, `mode` ('text'|'audio'|'photo'), `logText`, `recording`, `hasTranscript`, `photoAdded`
- `points`, `streak`, `freq` (frequenza report)
- `fastActive`, `fastStart` (timestamp; elapsed derivato da `Date.now()`)
- `toast`, `lastMeal`, `lastPoints`, `activePatient`
- `meals`: mappa colazione/pranzo/cena/spuntino con `{ done, foods[], time }`

Requisiti dati per la produzione: piano alimentare consigliato per paziente (per il match), trascrizione audio (speech-to-text), riconoscimento alimenti da foto (image recognition), generazione PDF, invio WhatsApp (Business API o deep link), sync report paziente→nutrizionista.

## Design Tokens
**Colori**
- Ink / testo: `#17241C`
- Sfondo pagina: `#E9E3D5` · Superficie app: `#F4F0E6` · Card: `#FFFFFF`
- Primario (verde): `#2E8B57` · Primario scuro: `#1C5E41`
- Accento oro: `#F4D06A` · Oro scuro (testo su chiaro): `#B67B12` / `#E2A32C`
- Verdetti: good `#2E8B57` su `#E7F3EB`; ok `#B67B12` su `#FFF3DC`; bad `#D06A3C`/`#C0502A` su `#FBE7DE`
- Testo muted: `#6E7B71` / `#8A9990`
- Linee: `rgba(23,36,28,.07)` / `rgba(23,36,28,.12)`
- WhatsApp: `#25D366`

**Tipografia:** Poppins (400/500/600/700), Google Fonts (sostituto — verificare font brand). Scala usata: 10.5–12px (meta/label), 13–15px (corpo/UI), 19–26px (titoli), 32–38px (numeri anello/timer).

**Radius:** pill 999px; card 14–22px; shell app 30px. **Spacing:** gap 6–20px; padding card 12–20px.

**Ombre:** card verde `0 12px 26px rgba(28,94,65,.28)`; CTA `0 10px 22px rgba(46,139,87,.32)`; shell `0 24px 60px rgba(23,36,28,.16)`.

## Assets
- **Icone:** tutte SVG inline (nessuna dipendenza da librerie icone). In produzione sostituibili con l'icon set del codebase.
- **Font:** Poppins da Google Fonts.
- **Immagini:** nessuna reale; la foto pasto è un placeholder a gradiente.
- Nessun asset brand ufficiale incluso — usare quelli del codebase.

## Files
- `Diario Nemis.dc.html` — prototipo completo (template + logica). Le liste `CONSIGLIATI`/`SCONSIGLIATI` e la funzione `score()`/`verdict()` nella classe `Component` sono la spec di riferimento per il matching e il giudizio "Buona scelta".
