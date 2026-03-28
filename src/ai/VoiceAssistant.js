/**
 * Voice Assistant powered by Gemini Live API (audio-only).
 * Connects via WebSocket, streams mic audio, receives spoken responses,
 * and uses function calling to update the music config.
 */

const SYSTEM_PROMPT = `You are a friendly music assistant for a basketball training app called MuseMotion.
The user is setting up their training session and needs help choosing music settings.
You help them pick the right genre, energy level, tempo, mood, and instruments based on natural conversation.

When the user describes what they want (e.g. "something like John Summit", "hype workout music", "chill vibes"),
use the updateMusicConfig function to set the appropriate values. You can call it multiple times to adjust settings.

Available options:
- genre: "hip-hop", "edm", "lo-fi", "pop"
- energy: 1-10 (1 = very calm, 10 = maximum intensity)
- mood: "aggressive", "upbeat", "chill"
- instruments: any combination of "drums", "bass", "synth", "keys"
- tempo_min / tempo_max: BPM range (typically 70-180)

Artist/style mappings you should know:
- John Summit, Fisher, Chris Lake = edm, energy 8-9, upbeat, tempo 124-128, drums+bass+synth
- Travis Scott, Metro Boomin = hip-hop, energy 8-9, aggressive, tempo 130-160, drums+bass+synth
- Drake, J. Cole = hip-hop, energy 5-7, upbeat, tempo 80-120, drums+bass+keys
- Lofi Girl, Nujabes = lo-fi, energy 3-4, chill, tempo 70-90, drums+bass+keys
- Dua Lipa, The Weeknd = pop, energy 7-8, upbeat, tempo 110-128, drums+bass+synth+keys

After updating settings, briefly confirm what you set in a natural way. Keep responses short and conversational.
When greeting the user, be brief: "Hey! What kind of vibe are you going for today?"`;

const TOOLS = [{
  functionDeclarations: [{
    name: "updateMusicConfig",
    description: "Update the music configuration settings for the training session",
    parameters: {
      type: "OBJECT",
      properties: {
        genre: {
          type: "STRING",
          enum: ["hip-hop", "edm", "lo-fi", "pop"],
          description: "Music genre"
        },
        energy: {
          type: "NUMBER",
          description: "Energy level from 1-10"
        },
        mood: {
          type: "STRING",
          enum: ["aggressive", "upbeat", "chill"],
          description: "Music mood"
        },
        instruments: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Instruments to include: drums, bass, synth, keys"
        },
        tempo_min: {
          type: "NUMBER",
          description: "Minimum BPM"
        },
        tempo_max: {
          type: "NUMBER",
          description: "Maximum BPM"
        }
      }
    }
  }]
}];

export class VoiceAssistant {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.audioContext = null;
    this.micStream = null;
    this.micProcessor = null;
    this.isConnected = false;
    this.isListening = false;
    this.onConfigUpdate = null; // callback: (configChanges) => void
    this.onStateChange = null;  // callback: (state) => void — 'idle' | 'connecting' | 'listening' | 'speaking'
    this.audioQueue = [];
    this.isPlayingAudio = false;
  }

  async connect(mediaStream) {
    if (!this.apiKey) {
      console.warn("VoiceAssistant: No API key");
      return;
    }

    this._setState('connecting');

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        setup: {
          model: "models/gemini-2.0-flash-live-001",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          tools: TOOLS
        }
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Setup complete — start mic streaming
        if (data.setupComplete) {
          console.log("VoiceAssistant: Connected");
          this.isConnected = true;
          this._setState('listening');
          this._startMicStream(mediaStream);
          return;
        }

        // Function call from Gemini
        if (data.toolCall) {
          for (const call of data.toolCall.functionCalls || []) {
            if (call.name === 'updateMusicConfig' && this.onConfigUpdate) {
              console.log("VoiceAssistant: Config update", call.args);
              this.onConfigUpdate(call.args);
              // Send function response back
              this.ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [{
                    id: call.id,
                    response: { result: { success: true } }
                  }]
                }
              }));
            }
          }
          return;
        }

        // Audio response from Gemini
        if (data.serverContent?.modelTurn?.parts) {
          for (const part of data.serverContent.modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
              this._setState('speaking');
              this._queueAudio(part.inlineData.data);
            }
          }
        }

        // Turn complete
        if (data.serverContent?.turnComplete) {
          // Audio will finish playing, then go back to listening
          if (!this.isPlayingAudio) {
            this._setState('listening');
          }
        }
      } catch (e) {
        // Ignore partial message parse errors
      }
    };

    this.ws.onerror = (e) => {
      console.error("VoiceAssistant: WebSocket error", e);
      this._setState('idle');
    };

    this.ws.onclose = () => {
      console.log("VoiceAssistant: Disconnected");
      this.isConnected = false;
      this._stopMicStream();
      this._setState('idle');
    };
  }

  _startMicStream(mediaStream) {
    if (!mediaStream || !this.audioContext) return;

    const source = this.audioContext.createMediaStreamSource(mediaStream);
    // Downsample to 16kHz mono for Gemini input
    this.micProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    // We need 16kHz 16-bit PCM. AudioContext is at 24kHz, so resample.
    const inputSampleRate = this.audioContext.sampleRate;
    const outputSampleRate = 16000;

    this.micProcessor.onaudioprocess = (e) => {
      if (!this.isConnected || !this.isListening) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Resample
      const ratio = inputSampleRate / outputSampleRate;
      const outputLength = Math.floor(inputData.length / ratio);
      const pcm16 = new Int16Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        const srcIndex = Math.floor(i * ratio);
        const sample = Math.max(-1, Math.min(1, inputData[srcIndex]));
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      // Convert to base64
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=16000",
              data: base64
            }]
          }
        }));
      }
    };

    source.connect(this.micProcessor);
    this.micProcessor.connect(this.audioContext.destination);
    this.isListening = true;
  }

  _stopMicStream() {
    this.isListening = false;
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
  }

  _queueAudio(base64Data) {
    // Decode base64 to PCM 24kHz 16-bit LE
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x8000;
    }

    this.audioQueue.push(float32);
    if (!this.isPlayingAudio) {
      this._playNextAudio();
    }
  }

  _playNextAudio() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      if (this.isConnected) this._setState('listening');
      return;
    }

    this.isPlayingAudio = true;
    const float32 = this.audioQueue.shift();
    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => this._playNextAudio();
    source.start();
  }

  _setState(state) {
    if (this.onStateChange) this.onStateChange(state);
  }

  disconnect() {
    this._stopMicStream();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isConnected = false;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this._setState('idle');
  }
}
