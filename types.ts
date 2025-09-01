export type Role = 'user' | 'model';

export interface Message {
  role: Role;
  text: string;
  images?: string[]; // array of base64 data URLs
}

export interface Persona {
  id: string;
  name: string;
  avatar: React.ReactNode;
  systemInstruction: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  artifactContent: string;
  isArtifactVisible: boolean;
  model: string;
  personaId: string;
}

export type Theme = 'light' | 'dark';