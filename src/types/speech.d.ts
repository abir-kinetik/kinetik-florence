// Global type definitions for Web Speech API

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative; // Index signature
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult; // Index signature
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string; // e.g., 'no-speech', 'audio-capture', 'not-allowed'
  readonly message: string; // Potentially empty
}

export interface SpeechGrammar {
  src: string;
  weight: number;
}

export interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  addFromString(grammarString: string, weight?: number): void; // Parameter name changed
  addFromURI(src: string, weight?: number): void;
  [index: number]: SpeechGrammar; // Index signature
}

export interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

export interface SpeechRecognition extends EventTarget {
  grammars: SpeechGrammarList;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI?: string; // Optional property

  start(): void;
  stop(): void;
  abort(): void;

  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

  addEventListener(type: 'result', listener: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'error', listener: (this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'nomatch', listener: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  // Add other specific events if needed, or fallback to generic EventListener
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  
  removeEventListener(type: 'result', listener: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: 'error', listener: (this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: 'nomatch', listener: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

// Augment the global Window interface
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    // SpeechSynthesisUtterance and speechSynthesis are typically part of lib.dom.d.ts
  }
}

export {}; // Ensures this file is treated as a module
