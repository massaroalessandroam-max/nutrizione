import { useCallback, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = !!getSpeechRecognitionCtor();

export function useSpeechRecognition() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback((onResult: (transcript: string) => void) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Riconoscimento vocale non supportato in questo browser.');
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onResult(transcript.trim());
    };
    recognition.onerror = (event: any) => {
      setError(event.error === 'not-allowed' ? 'Permesso microfono negato.' : 'Errore riconoscimento vocale.');
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return { recording, error, start, stop };
}
