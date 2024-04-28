import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextToSpeechService {

  isSpeaking = signal(false);
  voices = signal<SpeechSynthesisVoice[]>([]);
  selectedVoiceIdx = signal<number>(0);

  pitch = 1;
  rate = 1;
  currentUtterance: SpeechSynthesisUtterance | undefined;

  constructor() {
    this.voices.set(speechSynthesis.getVoices());
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.voices.set(speechSynthesis.getVoices());
    }
  }

  speak(text: string, callback: () => void) {
    if (this.isSpeaking()) {
      speechSynthesis.cancel();
    }
    this.isSpeaking.set(false);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voices()[this.selectedVoiceIdx()];
    utterance.voice = voice;
    utterance.pitch = this.pitch;
    utterance.rate = this.rate;
    utterance.onboundary = function (event) {
      if (event.name !== 'word') return;
    };
    utterance.onend = () => {
      this.isSpeaking.set(false);
      callback();
    };
    this.isSpeaking.set(true);
    speechSynthesis.speak(utterance);
    this.currentUtterance = utterance;
  }

  pause() {
    this.isSpeaking.set(false);
    speechSynthesis.pause();
  }

  resume() {
    this.isSpeaking.set(true);
    window.speechSynthesis.resume();
  }

}
