
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export interface PatientInfo {
  memberId: string;
  dob: Date;
  organization: string;
  name?: string;
  uuid?: string;
}

export interface Itinerary {
  pickup: {
    addressText: string;
    longLat: [number, number];
  },
  dropOff: {
    addressText: string;
    longLat: [number, number];
  }
  pickupDateTime: Date;
  appointmentReasons: string;
  levelOfService: string;
  noteToDriver: string;
  medicalNeeds: string;
  companions: boolean;
}

export interface BookingInfo {
  patientInfo: PatientInfo;
  itinerary: Itinerary;
}

export enum AgentStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING', // User finished speaking, waiting for Gemini
  SPEAKING = 'SPEAKING',   // Agent TTS is active
  ENDED = 'ENDED',     // Conversation finished, info extracted
  ERROR = 'ERROR',
  NO_API_KEY = 'NO_API_KEY'
}
