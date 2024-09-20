import {Configuration} from './Configuration.js';

const SESSION_COOKIE_NAME = "ArisysSoftphoneSession";
const jsonStr = getCookie(SESSION_COOKIE_NAME);
const ERROR_CODES = Object.freeze({
    SERVER_ERROR: 4000
});
export const SSOToken = "Bearer " + jsonStr.currentUser.authdata;
export const tokenData = SSOToken && parseSSOToken(SSOToken);

export class ClientSessionManager {
    constructor(hostAddress) {
        const configuration = new Configuration(hostAddress);
        this.user = {
            profileList: [],
            defaultUserName: "",
            role: "",
            defaultUserProfileId: ""
        };
        this.config = configuration.getConfig();
        this.client = new AvayaCustomerServices(this.config);
        this.client.registerLogger(console);
        this.clientSession = null;
    }

    initiateClientSession() {
        this.clientSession = this.client.createClientSession();
        this.clientSession.setToken({
            header: "Authorization",
            value: SSOToken
        });

        this.clientSession
            .getConfiguration(tokenData.authHandle)
            .then((authUser) => {
                // console.log("get Configuration : ", authUser);
                this.initUserProfileList(authUser);
                this.initializeCallbacks();
                this.clientSession.start();
            });
        return this.clientSession;
    }


    initializeCallbacks() {

        this.clientSession.addOnClientSessionStartedCallback((message) => {
            // console.log("ClientSessionStarted : ", message);
            onSessionOpened(this.user, message);
        });
        this.clientSession.addOnClientSessionClosedCallback((message) => {
            // console.log("ClientSessionClosed : ", message);
            onSessionClosed(message);
        });
        this.clientSession.addOnCloseCallback((message) => {
            // console.log("notification provider connection has been closed : ", message);
            onConnectionClosed(message);
        });
        this.clientSession.addOnDeferredInteractionCallback((message) => {
            // console.log("interaction is moved to 'deferred' : ", message);
        });
        this.clientSession.addOnErrorCallback((error) => {
            // console.log("error has occurred : ", error);
            onServerErrorOccurred(error.code, error.message, error.reason);
        });
    }

    initUserProfileList(authUser) {
        // console.log("authUser : ", authUser);
        this.user.profileList = [];
        this.user.defaultUserProfileId = authUser.defaultUserProfileId; // 기본 프로필Id
        this.user.role = authUser.user.roleId;
        this.user.defaultUserName = authUser.user.userHandle;
        for (let p of authUser.userProfileDetailsList) {
            this.user.profileList.push({
                id: p.userProfile.id,
                name: p.userProfile.profileName,
                address: p.defaultResource.address,
            });
            // console.log("User Profile: ", p);
        }
    }
    getUser() { return this.user; }
}

function getCookie(key) {

    let cookies = document.cookie.split(`; `).map((el) => el.split("="));
    let getItem = [];

    for (let i = 0; i < cookies.length; i++) {
        if (cookies[i][0] === key) {
            getItem.push(cookies[i][1]);
            break;
        }
    }

    if (getItem.length > 0) {
        const decodedCookieValue = decodeURIComponent(getItem[0]);
        // console.log(decodedCookieValue);
        return JSON.parse(decodedCookieValue);
    }
}

function parseSSOToken(token) {
    // console.log("token : ", token);
    let parsedJWT;
    let encodedJWT = token.split(" ")[1];
    if (!encodedJWT) return;

    let payload = encodedJWT.split(".")[1];
    if (!payload) return;

    try {
        parsedJWT = JSON.parse(window.atob(payload));
        // console.log("parsedJWT : ", parsedJWT);
    } catch (error) {
        parsedJWT = {};
    }
    return {
        authHandle: parsedJWT.sub,
        expires: parsedJWT.exp,
    };
}

function onSessionOpened(user, sessionId) {
    const sessionOpenedEvent = new CustomEvent('sessionOpenedEvent', {
        detail: {
            sessionId: sessionId,
            defaultProfileId: user.defaultUserProfileId,
            defaultUserName: user.defaultUserName,
            role: user.role,
            defaultExtension: user.profileList[0].address
        }
    });
    document.dispatchEvent(sessionOpenedEvent);
}
function onSessionClosed(sessionId) {
    const sessionClosedEvent = new CustomEvent('sessionClosedEvent', {
        detail: {
            sessionId: sessionId
        }
    });
    document.dispatchEvent(sessionClosedEvent);
}
function onConnectionClosed(message) {
    const connectionClosedEvent = new CustomEvent('connectionClosedEvent', {
        detail: {
        }
    });
    document.dispatchEvent(connectionClosedEvent);
}
function onServerErrorOccurred(code, message, reason) {
    const onServerErrorOccurred = new CustomEvent('onServerErrorOccurred', {
        detail: {
            code: ERROR_CODES.SERVER_ERROR,
            errorCode: code,
            errorMessage: message,
            errorReason: reason
        }
    });
    document.dispatchEvent(onServerErrorOccurred);
}