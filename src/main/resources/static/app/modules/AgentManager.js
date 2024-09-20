// AgentManager.js

export class AgentManager {
    constructor(clientSession) {
        this.clientSession = clientSession;
        this.agent = null;
        this.extension = null;
    }

    createAgent() {
        this.agent = this.clientSession.createAgent();
        this.addAgentCallbacks();
        return this.agent;
    }

    addAgentCallbacks() {
        if (this.agent) {
            this.agent.addOnActivatedCallback((message) => {
                // console.log("agent activated : ", message);
                onAgentActivated(message);
            });
            this.agent.addOnDeactivatedCallback((message) => {
                // console.log("agent deactivated", message);
                onAgentDeactivated(message);
            });
            this.agent.addOnStateCompleteCallback((message) => {
                // console.log("agent complete", message);
            });
            this.agent.addOnStateLoginPendingCallback((message) => {
                // console.log("agent Login Pending", message);
            });
            this.agent.addOnStateLoggedOutCallback((message) => {
                // console.log("agent LoggedOut", message);
                onAgentLoggedOut(message);
            });
            this.agent.addOnStateLogoutPendingCallback((message) => {
                // console.log("agent Logout Pending", message);
            });
            this.agent.addOnStateAfterContactWorkCallback((message) => {
                // 로그인 체크
                if (message.previousState === 'Login Pending')
                    onAgentLoggedIn(message);
                onAgentAfterContactWork(message);
                // console.log("agent status : after contact work", message);
            });
            this.agent.addOnStateAfterContactWorkPendingCallback((message) => {
                // 로그인 체크
                if (message.previousState === 'Login Pending')
                    onAgentLoggedIn(message);
                // console.log("agent status : after contact work pending", message);
            });
            this.agent.addOnStateNotReadyCallback((message) => {
                // 로그인 체크
                if (message.previousState === 'Login Pending')
                    onAgentLoggedIn(message);
                onAgentNotReady(message);
                // console.log("agent status : not ready", message);
            });
            this.agent.addOnStateNotReadyPendingCallback((message) => {
                // 로그인 체크
                if (message.previousState === 'Login Pending')
                    onAgentLoggedIn(message);
                // console.log("agent status : not ready pending", message);
            });
            this.agent.addOnStateReadyCallback((message) => {
                // 로그인 체크
                if (message.previousState === 'Login Pending')
                    onAgentLoggedIn(message);
                onAgentReady(message);
                // console.log("agent status : ready", message);
            });
            this.agent.addOnStateUnknownCallback((message) => {
                // console.log("agent status : unknown", message);
            });
        }
    }
}

/*
    event handler
*/

function onAgentActivated(agentInfo) {
    const agentActivatedEvent = new CustomEvent('agentActivatedEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: ''
        }
    });
    agentActivatedEvent.detail.id = agentInfo.id;
    agentActivatedEvent.detail.name = agentInfo.displayName;
    agentActivatedEvent.detail.role = agentInfo.role;
    if(agentInfo.isActivated)
        agentActivatedEvent.detail.status = 'Activated';
    document.dispatchEvent(agentActivatedEvent);
}

function onAgentDeactivated(agentInfo) {
    const agentDeactivatedEvent = new CustomEvent('agentDeactivatedEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: ''
        }
    });
    agentDeactivatedEvent.detail.id = agentInfo.id;
    agentDeactivatedEvent.detail.name = agentInfo.displayName;
    agentDeactivatedEvent.detail.role = agentInfo.role;
    agentDeactivatedEvent.detail.status = 'Deactivated';
    document.dispatchEvent(agentDeactivatedEvent);
}

function onAgentLoggedIn(agentInfo) {
    const agentLoggedInEvent = new CustomEvent('agentLoggedInEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: '',
            reasonCode: '',
            capabilities: {
                canDeactivate: '',
                canLogin: '',
                canLogout: '',
                canSetAfterContactWork: '',
                canSetReady: '',
                canSetNotReady: '',
            }
        }
    });
    agentLoggedInEvent.detail.status = agentInfo.currentState;
    if (agentInfo.capabilities)
        agentLoggedInEvent.detail.capabilities = setCapabilities(agentInfo.capabilities)
    if (agentLoggedInEvent.detail.status !== undefined) {
        document.dispatchEvent(agentLoggedInEvent);
    }

}

function onAgentLoggedOut(agentInfo) {
    const agentLoggedOutEvent = new CustomEvent('agentLoggedOutEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: '',
            reasonCode: '',
            capabilities: {
                canDeactivate: '',
                canLogin: '',
                canLogout: '',
                canSetAfterContactWork: '',
                canSetReady: '',
                canSetNotReady: '',
            }
        }
    });
    agentLoggedOutEvent.detail.status = agentInfo.currentState;
    if (agentInfo.reasonCode)
        agentLoggedOutEvent.detail.reasonCode = agentInfo.reasonCode;
    else
        agentLoggedOutEvent.detail.reasonCode = null;
    if (agentInfo.capabilities)
        agentLoggedOutEvent.detail.capabilities = setCapabilities(agentInfo.capabilities)
    if (agentLoggedOutEvent.detail.status !== undefined) {
        document.dispatchEvent(agentLoggedOutEvent);
    }
}

function onAgentReady(agentInfo) {
    const agentReadyEvent = new CustomEvent('agentReadyEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: '',
            reasonCode: '',
            capabilities: {
                canDeactivate: '',
                canLogin: '',
                canLogout: '',
                canSetAfterContactWork: '',
                canSetReady: '',
                canSetNotReady: '',
            }
        }
    });
    agentReadyEvent.detail.status = agentInfo.currentState;
    if (agentInfo.reasonCode)
        agentReadyEvent.detail.reasonCode = agentInfo.reasonCode;
    else
        agentReadyEvent.detail.reasonCode = null;
    if (agentInfo.capabilities)
        agentReadyEvent.detail.capabilities = setCapabilities(agentInfo.capabilities)
    if (agentReadyEvent.detail.status !== undefined) {
        document.dispatchEvent(agentReadyEvent);
    }
}


function onAgentNotReady(agentInfo) {
    const agentNotReadyEvent = new CustomEvent('agentNotReadyEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: '',
            reasonCode: '',
            capabilities: {
                canDeactivate: '',
                canLogin: '',
                canLogout: '',
                canSetAfterContactWork: '',
                canSetReady: '',
                canSetNotReady: '',
            }
        }
    });
    agentNotReadyEvent.detail.status = agentInfo.currentState;
    if (agentInfo.reasonCode)
        agentNotReadyEvent.detail.reasonCode = agentInfo.reasonCode;
    else
        agentNotReadyEvent.detail.reasonCode = null;
    if (agentInfo.capabilities)
        agentNotReadyEvent.detail.capabilities = setCapabilities(agentInfo.capabilities)
    if (agentNotReadyEvent.detail.status !== undefined) {
        document.dispatchEvent(agentNotReadyEvent);
    }
}

function onAgentAfterContactWork(agentInfo) {
    const agentAfterContactWorkEvent = new CustomEvent('agentAfterContactWorkEvent', {
        detail: {
            id: '',
            name: '',
            role: '',
            status: '',
            reasonCode: '',
            capabilities: {
                canDeactivate: '',
                canLogin: '',
                canLogout: '',
                canSetAfterContactWork: '',
                canSetReady: '',
                canSetNotReady: '',
            }
        }
    });
    agentAfterContactWorkEvent.detail.status = agentInfo.currentState;
    if (agentInfo.reasonCode)
        agentAfterContactWorkEvent.detail.reasonCode = agentInfo.reasonCode;
    else
        agentAfterContactWorkEvent.detail.reasonCode = null;
    if (agentInfo.capabilities)
        agentAfterContactWorkEvent.detail.capabilities = setCapabilities(agentInfo.capabilities)
    if (agentAfterContactWorkEvent.detail.status !== undefined) {
        document.dispatchEvent(agentAfterContactWorkEvent);
    }
}

function setCapabilities(capabilitiesInfo) {
    let capabilities = {
        canDeactivate: null,
        canLogin: null,
        canLogout: null,
        canSetReady: null,
        canSetNotReady: null,
        canSetAfterContactWork: null
    };
    capabilities.canDeactivate = capabilitiesInfo.canDeactivate;
    capabilities.canLogin = capabilitiesInfo.canLogin;
    capabilities.canLogout = capabilitiesInfo.canLogout;
    capabilities.canSetReady = capabilitiesInfo.canSetReady;
    capabilities.canSetNotReady = capabilitiesInfo.canSetNotReady;
    capabilities.canSetAfterContactWork = capabilitiesInfo.canSetAfterContactWork;
    return capabilities;
}
