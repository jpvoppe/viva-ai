"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** O navegador sabe transcrever fala? (Chrome, Edge e Safari sabem; Firefox não.) */
export function useSpeechRecognitionSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false,
  );
}

export function useSpeechSynthesisSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
}

export type DictationError = "permissao" | "sem_microfone" | "rede" | "outro";

/**
 * Ditado por voz usando o reconhecimento de fala do próprio navegador.
 * `level` (0 a 1) é o volume real do microfone, para as ondas de áudio.
 */
export function useDictation(options: {
  onFinalText: (text: string) => void;
  onError: (error: DictationError) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const recognitionRef = useRef<Recognition | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  const stopMeter = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelAnimationFrame(audio.raf);
    for (const track of audio.stream.getTracks()) track.stop();
    void audio.ctx.close().catch(() => {});
    audioRef.current = null;
    setLevels([]);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const entry = { ctx, stream, raf: 0 };
      audioRef.current = entry;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars: number[] = [];
        const step = Math.floor(data.length / 12) || 1;
        for (let i = 0; i < 12; i++) bars.push(Math.min(1, data[i * step] / 200));
        setLevels(bars);
        entry.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Sem medidor de volume: o ditado continua funcionando.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) callbacks.current.onFinalText(result[0].transcript);
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      const map: Record<string, DictationError> = {
        "not-allowed": "permissao",
        "service-not-allowed": "permissao",
        "audio-capture": "sem_microfone",
        network: "rede",
      };
      callbacks.current.onError(map[event.error] ?? "outro");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      stopMeter();
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      void startMeter();
    } catch {
      callbacks.current.onError("outro");
    }
  }, [startMeter, stopMeter]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopMeter();
    };
  }, [stopMeter]);

  const level = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  return { listening, interim, levels, level, start, stop };
}

/** Tira a marcação Markdown para o texto ser lido em voz alta sem "asteriscos". */
export function plainTextForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (trecho de código) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Leitura em voz alta pela síntese de voz do navegador (sem custo de IA). */
export function useSpeaker() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, markdown: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(plainTextForSpeech(markdown).slice(0, 6000));
      utterance.lang = "pt-BR";
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt-br"));
      if (voice) utterance.voice = voice;
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  useEffect(() => stop, [stop]);

  return { speakingId, speak, stop };
}
