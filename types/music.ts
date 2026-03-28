export interface VocalElement {
  style?: string;
  melody_description?: string;
  lyrics?: string;
}

export interface TrackParameters {
  tempo?: string;
  genre?: string;
  mood?: string;
  primary_instrumentation?: string;
  percussion?: string;
  vocal_element?: VocalElement;
}

export interface MuseSessionState {
  isComplete: boolean;
  parameters: TrackParameters;
}
