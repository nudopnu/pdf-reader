import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextToSpeechService {

  isSpeaking = signal(false);

  constructor() {
    const voices = window.speechSynthesis.getVoices();
    console.log(voices);
  }

  speak(text: string, callback: () => void) {
    this.isSpeaking.set(false);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onboundary = function (event) {
      if (event.name !== 'word') return;
    };
    utterance.onend = () => {
      this.isSpeaking.set(false);
      callback();
    };
    this.isSpeaking.set(true);
    window.speechSynthesis.speak(utterance);
  }

  pause() {
    this.isSpeaking.set(false);
    window.speechSynthesis.pause();
  }

  resume() {
    this.isSpeaking.set(true);
    window.speechSynthesis.resume();
  }

}
