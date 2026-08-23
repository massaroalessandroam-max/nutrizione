import { WhatsappIcon } from '../icons';
import { buildWhatsappLink } from '../lib/whatsapp';

interface Props {
  text: string;
  emailSubject?: string;
}

// Bottoni di invio per un testo breve (codice, invito, password
// temporanea): WhatsApp ed email sempre disponibili (link nativi, nessuna
// libreria); "Altro" solo dove il browser supporta la condivisione nativa
// (Web Share API) — apre la scheda di condivisione del sistema con tutti i
// canali installati (Messaggi, Telegram, AirDrop...).
export function ShareActions({ text, emailSubject }: Props) {
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shareNative = () => {
    navigator.share({ text }).catch(() => {
      // annullato dall'utente o canale non disponibile — nessun errore da mostrare
    });
  };

  return (
    <div className="nm-share-row">
      <a className="nm-share-btn is-whatsapp" href={buildWhatsappLink(text)} target="_blank" rel="noopener noreferrer">
        <WhatsappIcon size={14} /> WhatsApp
      </a>
      <a
        className="nm-share-btn"
        href={`mailto:?subject=${encodeURIComponent(emailSubject ?? '')}&body=${encodeURIComponent(text)}`}
      >
        Email
      </a>
      {canNativeShare && (
        <button className="nm-share-btn" onClick={shareNative}>Altro</button>
      )}
    </div>
  );
}
