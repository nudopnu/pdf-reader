import { Component, EventEmitter, Input, Output, Signal, WritableSignal } from '@angular/core';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'pdf-playcontrols',
  templateUrl: './playcontrols.component.html',
  styleUrl: './playcontrols.component.scss'
})
export class PlaycontrolsComponent {

  @Input() resolution = 2;

  @Output() resolutionChange = new EventEmitter<number>();
  @Output() previousPageRequest = new EventEmitter<void>();
  @Output() nextPageRequest = new EventEmitter<void>();

  isSpeaking: Signal<boolean>;
  voices: Signal<SpeechSynthesisVoice[]>;
  pitch = 1;
  rate = 1;
  selectedVoiceIdx: WritableSignal<number>;

  constructor(private tts: TextToSpeechService) {
    this.isSpeaking = tts.isSpeaking;
    this.voices = tts.voices;
    this.selectedVoiceIdx = tts.selectedVoiceIdx;
  }

  togglePlay() {
    if (this.isSpeaking()) {
      this.tts.pause();
    } else {
      this.tts.resume();
    }
  }

  onChangePitch(pitchValue: number) {
    this.tts.pitch = pitchValue;
    this.pitch = pitchValue;
  }

  onChangeRate(rateValue: number) {
    this.tts.rate = rateValue;
    this.rate = rateValue;
  }

  speakText() {
    const text = "Hello, this is a test";
    this.tts.speak(text, () => {
      console.log("Speech finished");
    });
  }

}
