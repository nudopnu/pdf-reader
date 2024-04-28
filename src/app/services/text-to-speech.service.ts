import { EnvironmentInjector, Injectable, signal } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';

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
  synth: SpeechSynthesis;

  constructor(private notifications: NzNotificationService) {
    this.synth = window.speechSynthesis;
    this.voices.set(this.synth.getVoices());
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.voices.set(this.synth.getVoices());
    }
  }

  speak(text: string, callback: () => void) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    this.isSpeaking.set(false);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voices()[this.selectedVoiceIdx()];
    utterance.voice = voice;
    utterance.pitch = this.pitch;
    utterance.rate = this.rate;
    utterance.onboundary = (event) => {
      if (event.name !== 'word') return;
    };
    utterance.onend = () => {
      this.isSpeaking.set(false);
      callback();
    };
    this.isSpeaking.set(true);
    this.synth.speak(utterance);
    this.notifications.info(`Voice: ${utterance.voice.name}, Rate: ${utterance.rate}, Pitch: ${utterance.pitch} ${this.synth.speaking}:`, `"${text}"`);
    setTimeout(() => {
      this.notifications.info("Speaking status after delay:", `${this.synth.speaking}`);
    }, 1000);
    this.currentUtterance = utterance;
  }

  pause() {
    this.isSpeaking.set(false);
    this.synth.pause();
  }

  resume() {
    this.isSpeaking.set(true);
    this.synth.resume();
  }

}
