import {ClientSessionManager} from './modules/ClientSessionManager.js';
import {AgentManager} from './modules/AgentManager.js';
import {WorkManager} from './modules/WorkManager.js';

const ERROR_CODES = Object.freeze({
    ACTIVATE_FAILED: 2001,
    DEACTIVATE_FAILED: 2002,
    LOGIN_FAILED: 2003,
    LOGOUT_FAILED: 2004,
    READY_FAILED: 2005,
    NOTREADY_FAILED: 2006,
    ACW_FAILED: 2007,
    MAKECALL_FAILED: 3001,
    ACCEPT_FAILED: 3002,
    END_FAILED: 3003,
    HOLD_FAILED: 3004,
    UNHOLD_FAILED: 3005,
    CONSULT_FAILED: 3006,
    SSTRANSFER_FAILED: 3007,
    TRANSFER_FAILED: 3008,
    CONFERENCE_FAILD: 3009,
    CALL_NOT_FOUND: 3010
});

export class Softphone {
    
    constructor(hostAddress) {
        this.agent = null;
        this.work = null;
        this.user = null;
        this.callList = [];
        this.clientManager = new ClientSessionManager(hostAddress);
        this.agentManager = null;
        this.workManager = null;
    }

    initialize() {
        const clientSession = this.clientManager.initiateClientSession();
        this.agentManager = new AgentManager(clientSession);
        this.workManager = new WorkManager(clientSession);
        this.agent = this.agentManager.createAgent();
        this.work = this.workManager.createWork();
        this.user = this.clientManager.getUser();
    }

    // api
    setConfiguration() {


    }

    activate(extension) {
        if (extension !== null && extension !== undefined && extension !== "") {
            return this.agent.activate(this.user.defaultUserName, this.user.defaultUserProfileId, extension)
                .then((data) => {
                    this.agent.extension = extension;
                    return 1;
                })
                .catch((exception) => {
                    onAgentRequestFailed(ERROR_CODES.ACTIVATE_FAILED, exception);
                    return 0;
                });
        } else {
            return this.agent.activate(this.user.defaultUserName, this.user.defaultUserProfileId, this.user.profileList[0].address)
                .then((data) => {
                    this.agent.extension = this.user.profileList[0].address;
                    return 1;
                })
                .catch((exception) => {
                    onAgentRequestFailed(ERROR_CODES.ACTIVATE_FAILED, exception);
                    return 0;
                });
        }
    }

    deactivate() {
        return this.agent.deactivate()
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.DEACTIVATE_FAILED, exception);
                return 0;
            });
    }

    login(readyState) {
        return this.agent.login(readyState)
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.LOGIN_FAILED, exception);
                return 0;
            });
    }

    logout() {
        return this.agent.logout()
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.LOGOUT_FAILED, exception);
                return 0;
            });
    }

    goReady() {
        return this.agent.goReady()
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.READY_FAILED, exception);
                return 0;
            });
    }

    goNotReady(reason) {
        return this.agent.goNotReady(reason)
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.NOTREADY_FAILED, exception);
                return 0;
            });
    }

    goAfterContactWork() {
        return this.agent.goAfterContactWork()
            .then(() => {
                return 1;
            })
            .catch((exception) => {
                onAgentRequestFailed(ERROR_CODES.ACW_FAILED, exception);
                return 0;
            });
    }

    getActivatedExtension() {
        return this.agent.extension;
    }

    getCall(callId) {
        const callList = this.workManager.interactions;
        for (let call of callList) {
            if (call.id == callId) {
                return call;
            }

            // 예외처리 필요
        }
    }

    getCallInfo(callId) {

        const callList = this.workManager.interactions;

        for (let call of callList) {
            if (call.id == callId) {
                let callInfo = {};
                callInfo.callId = call.data.id;
                callInfo.contactId = call.data.contactId;
                callInfo.direction = call.data.direction;
                callInfo.state = call.data.state;
                callInfo.skill = call.data.skill;
                callInfo.callType = call.data.interactionType;
                callInfo.originatingAddress = call.data.originatingAddress;
                callInfo.destinationAddress = call.data.destinationAddress;
                const partyInfos = call.data.participants.map(participant => {
                    return `${participant.participantName} (${participant.participantAddress})`;
                });
                document.getElementById('partyInfo').textContent = "Party Info : " + partyInfos.join(', ');
                callInfo.participants = partyInfos;
                callInfo.uui = call.data.userToUserInfo;

                let capabilities = {};

                if (call.data.capabilities) {
                    capabilities.canAccept = call.data.capabilities.canAccept;
                    capabilities.canConsult = call.data.capabilities.canConsult;
                    capabilities.canEnd = call.data.capabilities.canEnd;
                    capabilities.canHold = call.data.capabilities.canHold;
                    capabilities.canUnhold = call.data.capabilities.canUnhold;
                    capabilities.canSetUui = call.data.capabilities.canSetUui;
                    capabilities.canSingleStepTransfer = call.data.capabilities.canSingleStepTransfer;
                    capabilities.canConferenceComplete = call.data.capabilities.canConferenceComplete;
                    capabilities.canTransferComplete = call.data.capabilities.canTransferComplete;
                    callInfo.capabilities = capabilities;
                }
                return callInfo;
            }
            else {
                onCallRequestFailed(ERROR_CODES.CALL_NOT_FOUND, "call not Found");
            }
        }
    }


    makeCall(destinationAddress) {
        return this.work.createInteraction("VOICE", destinationAddress)
            .then((data) => {
                // console.log("try makeCall() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.MAKECALL_FAILED, exception);
                return 0;
            });
    }

    acceptCall(callId) {
        let call = this.getCall(callId);
        return call.accept()
            .then((data) => {
                console.log("try accept() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.ACCEPT_FAILED, exception);
                return 0;
            });
    }

    endCall(callId) {
        let call = this.getCall(callId);
        return call.end()
            .then((data) => {
                console.log("try end() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.END_FAILED, exception);
                return 0;
            });
    }

    // consult콜을 회수
    releaseCall() {
        // let call = this.workManager.getConsultCall();


    }

    holdCall(callId) {
        let call = this.getCall(callId);
        return call.hold()
            .then((data) => {
                console.log("try hold() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.HOLD_FAILED, exception);
                return 0;
            });
    }

    unholdCall(callId) {
        let call = this.getCall(callId);
        return call.unhold()
            .then((data) => {
                console.log("try unhold() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.UNHOLD_FAILED, exception);
                return 0;
            });
    }

    makeSingleStepTransferCall(callId, remoteAddress) {
        let call = this.getCall(callId);
        return call.singleStepTransfer()
            .then((data) => {
                console.log("try sstransfer() : ", data);
                return 1;
            })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.SSTRANSFER_FAILED, exception);
                return 0;
            });
    }

    makeTwoStepTransferCall(callId, remoteAddress, uui) {
        let call = this.getCall(callId);
        return call.consult(remoteAddress, uui).then((data) => {
            console.log("try 2step transfer() : ", data);
            return 1;
        })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.CONSULT_FAILED, exception);
                return 0;
            });
    }

    makeConferenceCall(callId, remoteAddress, uui) {
        let call = this.getCall(callId);
        return call.consult(remoteAddress, uui).then((data) => {
            console.log("try sstransfer() : ", data);
            return 1;
        })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.CONSULT_FAILED, exception);
                return 0;
            });
    }

    completeTransferCall(callId) {
        let call = this.getCall(callId);
        return call.completeTransfer().then((data) => {
            console.log("try complete sstransfer() : ", data);
            return 1;
        })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.TRANSFER_FAILED, exception);
                return 0;
            });

    }

    completeConferenceCall(callId) {
        let call = this.getCall(callId);
        return call.completeConference().then((data) => {
            console.log("try complete conference() : ", data);
            return 1;
        })
            .catch((exception) => {
                onCallRequestFailed(ERROR_CODES.CONFERENCE_FAILD, exception);
                return 0;
            });

    }
}

function onAgentRequestFailed(code, message)
{
    const agentRequestFailedEvent = new CustomEvent('agentRequestFailedEvent', {
        detail: {
            code: code,
            message: message
        }
    });
    document.dispatchEvent(agentRequestFailedEvent);
}

function onCallRequestFailed(code, message)
{
    const callRequestFailedEvent = new CustomEvent('callRequestFailedEvent', {
        detail: {
            code: code,
            message: message
        }
    });
    document.dispatchEvent(callRequestFailedEvent);
}




