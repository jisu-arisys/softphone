// AgentManager.js
import {ClientSessionManager} from './ClientSessionManager.js';

export class WorkManager {
    constructor(clientSession) {
        this.clientSession = clientSession;
        this.work = null;
        this.calls = [];
    }

    createWork() {
        this.work = this.clientSession.createWork();
        this.addWorkCallbacks();
        return this.work;
    }

    get interactions() {
        return this.work.getInteractions()._collection;
    }

    addWorkCallbacks() {
        if (this.work) {
            this.work.addOnInteractionCreatedCallback((message) => {
                onCallCreated(message);
                this.addInteractionCallbacks(message);
           });
            this.work.addOnInteractionDeletedCallback((message) => {
            });
        }
    }

    addInteractionCallbacks(interactionInfo) {
        for (let i of this.work.getInteractions()._collection) {
            if (i.id === interactionInfo.id) {
                i.addOnInteractionActiveCallback((callback) => {
                    console.log("액티브 : ", callback);
                    onCallCreated(callback);
                });

                i.addOnInteractionHeldCallback((callback) => {
                    console.log("홀드 : ", callback);
                    onCallHeld(callback);
                });

                i.addOnInteractionUnheldCallback((callback) => {
                    console.log("언홀드 : ", callback);
                    onCallUnheld(callback);
                });

                i.addOnInteractionEndedCallback((callback) => {
                    console.log("끊음 : ", callback);
                    onCallEnded(callback);
                });

                i.addOnRemoteParticipantAcceptedCallback((callback) => {
                    console.log("상대가 받음 : ", callback);
                });

                i.addOnInteractionUpdatedCallback((callback) => {
                    console.log("상태 업데이트 : ", callback);
                });
            }
        }
    }

}


function onCallCreated(call) {
    const callCreatedEvent = new CustomEvent('callCreatedEvent', {
        detail: {
            id: '',
            ucid: ''
        }
    });
    callCreatedEvent.detail.id = call.id;
    callCreatedEvent.detail.ucid = call.contactId;
    document.dispatchEvent(callCreatedEvent);
}

function onCallEnded(callInfo) {
    const callEndedEvent = new CustomEvent('callEndedEvent', {
        detail: {
            id: '',
        }
    });
    callEndedEvent.detail.id = callInfo.id;
    document.dispatchEvent(callEndedEvent);
}

function onCallHeld(callInfo) {
    const callHeldEvent = new CustomEvent('callHeldEvent', {
        detail: {
            id: ''
        }
    });

    callHeldEvent.detail.id = callInfo.id;
    document.dispatchEvent(callHeldEvent);
}

function onCallUnheld(callInfo) {
    const callUnheldEvent = new CustomEvent('callUnheldEvent', {
        detail: {
            id: ''
        }
    });
    callUnheldEvent.detail.id = callInfo.id;
    document.dispatchEvent(callUnheldEvent);
}

function onRemoteParticapantAccepted(callInfo) {
    const remoteParticapantAcceptedEvent = new CustomEvent('remoteParticapantAcceptedEvent', {
        detail: {
            id: ''
        }
    });
    remoteParticapantAcceptedEvent.detail.id = callInfo.id;
    document.dispatchEvent(remoteParticapantAcceptedEvent);
}