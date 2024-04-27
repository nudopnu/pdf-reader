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
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onboundary = function (event) {
      if (event.name !== 'word') return;
    };
    utterance.onend = () => {
      this.isSpeaking.set(false);
      callback();
    };
    window.speechSynthesis.speak(utterance);
    this.isSpeaking.set(true);
  }

  pause() {
    window.speechSynthesis.pause();
    this.isSpeaking.set(true);
  }

  resume() {
    window.speechSynthesis.resume();
  }

}
