"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceSearchOptions {
  onResult?: (transcript: string) => void;
  lang?: string;
}

export function useVoiceSearch({ onResult, lang = 'es-MX' }: VoiceSearchOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);

          if (event.results[0]?.isFinal) {
            const finalClean = currentTranscript.trim();
            if (finalClean && onResultRef.current) {
              onResultRef.current(finalClean);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Voice recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setError('Permiso de micrófono denegado. Permite el acceso para buscar por voz.');
          } else if (event.error === 'no-speech') {
            setError('No se detectó voz. Intenta hablar más cerca del micrófono.');
          } else {
            setError(`Error de voz: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization failed:', err);
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [lang]);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition start error, attempting restart', e);
        try {
          recognitionRef.current.abort();
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
    } else {
      setError('Búsqueda por voz no soportada en este navegador.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    setTranscript,
  };
}
