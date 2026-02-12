import { useEffect, useMemo, useRef, useState } from "react";

const BrowserSpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = ({ language }) => {
  const recRef = useRef(null);
  const [isOn, setIsOn] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const supported = useMemo(() => Boolean(BrowserSpeechRecognition), []);

  useEffect(() => {
    if (!supported) return;

    const rec = new BrowserSpeechRecognition();
    rec.lang = language;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      setErr("");
      setIsOn(true);
    };

    rec.onresult = (event) => {
      const joined = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setText(joined);
    };

    rec.onerror = (event) => {
      setErr(event.error || "Speech recognition failed");
      setIsOn(false);
    };

    rec.onend = () => {
      setIsOn(false);
    };

    recRef.current = rec;

    return () => {
      rec.stop();
    };
  }, [supported, language]);

  const startListening = () => {
    if (!recRef.current) return;
    setText("");
    recRef.current.lang = language;
    recRef.current.start();
  };

  const stopListening = () => {
    recRef.current?.stop();
  };

  return {
    supported,
    isListening: isOn,
    transcript: text,
    error: err,
    setTranscript: setText,
    startListening,
    stopListening
  };
};

