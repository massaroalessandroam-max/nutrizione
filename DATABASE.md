# Database persistente (Turso / libSQL)

I dati dell'app (pasti registrati, stato del diario, pazienti) vengono
scritti su un database SQLite. Il codice usa il client
[`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts), che
parla sia con un file locale sia con un database Turso nel cloud, **con lo
stesso codice**: cambia solo l'URL.

## Perché serve

Su hosting gratuiti (Render, Railway, Fly) il disco è **effimero**: viene
azzerato a ogni nuovo deploy. Un file SQLite locale, quindi, perderebbe tutti
i dati a ogni rilascio. Turso tiene i dati su un database gestito, che
sopravvive ai deploy.

## Sviluppo locale (nessun account necessario)

Se `DATABASE_URL` non è impostata, il server crea da solo un file
`server/data.sqlite`. Basta `npm run dev`. I dati restano tra un riavvio e
l'altro sulla stessa macchina.

## Produzione: Turso (piano gratuito)

Il piano gratuito di Turso è ampiamente sufficiente per questa app.

1. **Crea l'account** su <https://turso.tech> (login con GitHub).

2. **Installa la CLI** e accedi:

   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```

3. **Crea il database:**

   ```bash
   turso db create diario-nemis
   ```

4. **Prendi l'URL del database:**

   ```bash
   turso db show diario-nemis --url
   # -> libsql://diario-nemis-<tua-org>.turso.io
   ```

5. **Genera un token di accesso:**

   ```bash
   turso db tokens create diario-nemis
   # -> stampa una stringa lunga: è il DATABASE_AUTH_TOKEN
   ```

6. **Imposta le variabili d'ambiente** sul servizio di hosting (es. Render →
   Environment):

   ```
   DATABASE_URL=libsql://diario-nemis-<tua-org>.turso.io
   DATABASE_AUTH_TOKEN=<il token del passo 5>
   ```

Al riavvio, nei log comparirà:

```
Database remoto (persistente tra i deploy) collegato.
```

Puoi anche verificare da `GET /api/health`: `"remoteDb": true`.

Lo schema (tabelle `app_state`, `meals`, `patients`, `patient_meals`) viene
creato in automatico al primo avvio: non serve nessuna migrazione manuale.

## Note

- Le variabili accettano anche i nomi `TURSO_DATABASE_URL` /
  `TURSO_AUTH_TOKEN`, se preferisci la convenzione di Turso.
- Il file `server/data.sqlite` è in `.gitignore`: i dati locali non finiscono
  nel repository.

## Deploy su Render

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Environment:** `DATABASE_URL` e `DATABASE_AUTH_TOKEN` (vedi sopra). Non
  serve un disco persistente su Render — i dati stanno su Turso.
