import { EventEmitter } from "eventemitter3";

export default class MockAudioInputsBrowser extends EventEmitter {
  public isSupported = true;

  public startListening = jest.fn();

  public stopListening = jest.fn();

  public resetTimeout = jest.fn();
}
