import { ErrorHandler, Injectable } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';

@Injectable()
export class ErrorHandlerService implements ErrorHandler {

  constructor(private notification: NzNotificationService) { }

  handleError(error: any): void {
    this.createNotification('error', error)
  }

  createNotification(type: string, error: any): void {
    this.notification.create(
      type,
      'An Error occured',
      error,
      { nzDuration: 0 },
    );
  }
}