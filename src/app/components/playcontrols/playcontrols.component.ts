import { Component, Signal } from '@angular/core';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'pdf-playcontrols',
  templateUrl: './playcontrols.component.html',
  styleUrl: './playcontrols.component.scss'
})
export class PlaycontrolsComponent {

  isSpeaking: Signal<boolean>;

  constructor(private tts: TextToSpeechService) {
    this.isSpeaking = tts.isSpeaking;
  }

  togglePlay() {
    if (this.isSpeaking()) {
      this.tts.pause();
    } else {
      this.tts.resume();
    }
  }

}
