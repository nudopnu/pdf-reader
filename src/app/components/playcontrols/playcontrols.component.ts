import { Component, Signal, WritableSignal } from '@angular/core';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'pdf-playcontrols',
  templateUrl: './playcontrols.component.html',
  styleUrl: './playcontrols.component.scss'
})
export class PlaycontrolsComponent {

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

}
