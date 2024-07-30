import { EventEmitter } from "eventemitter3";

export default class MockAudioInputsService extends EventEmitter {
  public startListening = jest.fn();

  public stopListening = jest.fn();

  public resetTimeout = jest.fn();
}
