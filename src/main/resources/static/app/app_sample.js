"use strict";

const BREEZE_HOST = "https://testws.arisys.co.kr";
const CLIENT_ID = "SampleSoftphone";
const API_URL = BREEZE_HOST + "/services/UnifiedAgentController/UACAPI";
const BROADCAST_URL =
    BREEZE_HOST + "/services/Broadcast-UnifiedAgentController/broadcast";
const SESSION_COOKIE_NAME = "ArisysSoftphoneSession";
const jsonStr = getCookie(SESSION_COOKIE_NAME);
const SSOToken = "Bearer " + jsonStr.currentUser.authdata;
const tokenData = SSOToken && parseSSOToken(SSOToken);
const CALL_DATE_TIMEOUT = 5000;
const PARAM_RS = String.fromCharCode(29); // 레코드 구분자
const PARAM_US = String.fromCharCode(31); // 단위 구분자
const DEBUG_MODE = window.CtiProxy === undefined;
const AGENT_STATE_CHECK_PERIOD = 5000;

const CtiPhoneKeywords = Object.freeze({
    CmdClose: "Close",
    CmdMakeCall: "MakeCall",
    CmdAnswerCall: "AnswerCall",
    CmdReleaseCall: "ReleaseCall",
    CmdConsultCall: "ConsultCall",
    CmdHoldCall: "HoldCall",
    CmdUnholdCall: "UnholdCall",
    CmdTransferCall: "TransferCall",
    CmdConferenceCall: "ConferenceCall",
    CmdSetAgentState: "SetAgentState",
    CmdSingleStepTransferCall: "SingleStepTransferCall",
    CmdSendDtmf: "SendDtmf",
    CmdMute: "Mute",
    CmdUnmute: "Unmute",
    CmdLineInit: "LineInit",
    CmdLineClose: "LineClose",
    CmdGetAllAgentStatus: "GetAllAgentStatus",
    CmdReconnectCall: "ReconnectCall",
    CmdOpenAck: "OpenAck",


    CallCreatedEvent: "CallCreatedEvent",
    CallDeletedEvent: "CallDeletedEvent",
    CallHeldEvent: "CallHeldEvent",
    CallRetrievedEvent: "CallRetrievedEvent",
    CallActiveEvent: "CallActiveEvent",
    CallAcceptedEvent: "CallAcceptedEvent",
    CallRemoteAcceptedEvent: "CallRemoteAcceptedEvent",
    AgentStateEvent: "AgentStateEvent",
    AgentActivatedEvent: "AgentActivatedEvent",
    AgentDeactivatedEvent: "AgentDeactivatedEvent",
    UserDataEvent: "UserDataEvent",
    PartyAddedEvent: "PartyAddedEvent",
    PartyRemovedEvent: "PartyRemovedEvent",
    SessionClosedEvent: "SessionClosedEvent",
    SessionErrorEvent: "SessionErrorEvent",


    MsgNotFoundCall: "Not found call",

    FieldId: "id",
    FieldCode: "code",
    FieldData: "data",
    FieldDn: "dn",
    FieldUui: "uui",
    FieldType: "type",

    ConsultTypeNone: 0,
    ConsultTypeTransfer: 1,
    ConsultTypeConference: 2,
    CONSULT_TRANSFER: 1,
    CONSULT_CONFERENCE: 2,

    InteractionTypeConsulting: "CONSULTING",
    InteractionTypeConsulted: "CONSULTED",
    InteractionTypeTtransferred: "TRANSFERRED",
    InteractionTypeConferenced: "CONFERENCED",
    InteractionTypeCalled: "CALLED",

    DirectionIncoming: "INCOMING",

    ConsultedReleaseDelayTime: 1500,

    Success: 0,
    ErrorServiceFail: 1,
    ErrorNotFoundCall: 2,
    ErrorTimeout: 3,
    ErrorInvalidParamter: 4,

    AGENT_STATE_UNKNOWN: 0,
    AGENT_STATE_LOGIN: 4353,
    AGENT_STATE_LOGOUT: 4354,
    AGENT_STATE_BUSY: 4355,
    AGENT_STATE_NOTREADY: 4357,
    AGENT_STATE_READY: 4358,
    AGENT_STATE_ACTIVITY_CODE: 4367

});

/**
 * WFE 정보.
 */
class WSFE {
    // WFE Work object
    work = null;
    // WFE Agent object
    agent = null;
    // 현재 활성화되어 있는 Profile object
    activatedProfile = null;
    // login extension ?? -->
    extension = '';
    iteractionTraceMap = new Map();
    /* UUI를 포함한 1-step transfer 처리를 위한 정보.  */
    sstRequest = false;
    sstRequestTime = 0;
    // 마지막 에이전트 상태
    lastAgentState_ = 0;
    lastAgentSubState_ = 0;
    lastAgentStateTime_ = '';
    /**
     * Consulting 콜 종류 구분: transfer(1), conference(2)
     */
    consultType = 0;
    /** Consult 콜의 original call-id */
    consultOrigId = undefined;
    /** 클라이언트에서 CTI 로그인을 함 */
    calledAgentLoginByAgent_ = false;
    fireLoggedOutEvent_ = false;

    /**
     *  CallDeletedEvent 발생 연기를 위한 timer ID와 parameters
     *  클리어는 타이머 실행이나 InteractionCreated에서 클리어.
     */
    consultedReleaseTimerId_ = 0;
    consultedReleaseParameters = '';

    /**
     * APP 설정, 상담원 상태
     */
    reqAgentState_ = 0;
    reqAgentStateReason_ = 0;
    reqAgentStateTimerId_ = 0;
    clearAgentStateTimer() {
        if (this.reqAgentStateTimerId_) {
            clearTimeout(this.reqAgentStateTimerId_);
            this.reqAgentStateTimerId_ = 0;
            // console.log('clear AgentStateTimer');
        }
    }
    setAgentStateTimer(state, reason) {
        if (this.reqAgentStateTimerId_)
            this.clearAgentStateTimer();
        this.reqAgentState_ = state;
        this.reqAgentStateReason_ = reason;
        this.reqAgentStateTimerId_ = setTimeout(() => {
            this.reqAgentStateTimerId_ = 0;
            if (this.reqAgentState_ !== this.lastAgentState_ || this.reqAgentStateReason_ != this.lastAgentSubState_) {
                // console.log('setAgentStateTimer: retry');
                switch (state) {
                    case CtiPhoneKeywords.AGENT_STATE_READY:
                        if (this.iteractionTraceMap.size !== 0)
                            this.agent.goReady('MANUAL_IN');
                        break;
                    case CtiPhoneKeywords.AGENT_STATE_NOTREADY:
                        this.agent.goNotReady(0);
                        break;
                    case CtiPhoneKeywords.AGENT_STATE_ACTIVITY_CODE:
                        if (reason === 19 && this.iteractionTraceMap.size !== 0)
                            break;
                        this.agent.goNotReady(reason || 0);
                        break;
                }
            } else {
                //                console.debug('setAgentStateTimer: success');
            }
        }, AGENT_STATE_CHECK_PERIOD);
    }

    /**
     *  로그인 사용자 정보. 세션이 확립되면 가져옴. LineInit()에서 사용하기 위함.
     * - profileList: 사용자 프로파일 object 목록.
     */
    user = {
        profileList: [],
        id: "",
        userHandle: "",
        defaultUserProfileId: "",
    };

    constructor() { }

    getLastAgentState() {
        return this.lastAgentState_;
    }
    getLastAgentSubState() {
        return lastAgentSubState_;
    }
    /**
     * 컨설트 콜을 생성시에 호출.
     * @param {number} type 컨설트 유형
     * @param {string} consultOrigId 오리지널 콜ID
     */
    setConsultType(type, consultOrigId) {
        this.consultType = type;
        this.consultOrigId = consultOrigId;
        /*        
                if (type != CtiPhoneKeywords.ConsultTypeNone) {
                    const mycall = this.get(consultOrigId);
                    if (mycall) {
        //                mycall.consulting = true;
                    }
                }
        */
    }
    getConsultType() {
        return this.consultType;
    }

    agentLogin() {
        this.calledAgentLoginByAgent_ = true;
        this.agent.login("Not_Ready");
    }
    agentLogout() {
        this.calledAgentLoginByAgent_ = false;
        this.agent.logout();
    }
    /**
     * 상담원 상태 갱신.
     * @param {number} state 상태.
     * @param {number} reason 상태가 NotReady인 경우 세부 사유.
     */
    updateAgentState(state, reason, message) {

        if (message) {
            if (message.lastStateChangeTime === this.lastAgentStateTime_) {
                // console.log('AgentState skip: lastStateChangeTime');
                return;
            }
            this.lastAgentStateTime_ = message.lastStateChangeTime;
        }
        this.lastAgentState_ = state;
        this.lastAgentSubState_ = reason;
        if (!this.calledAgentLoginByAgent_) { //  클라이언트에서 cti로그인을 하지 않음
            return;
        }
        let fireEvent = true;
        if (state === CtiPhoneKeywords.AGENT_STATE_LOGOUT) {
            fireEvent = this.fireLoggedOutEvent_;
        } else {
            this.fireLoggedOutEvent_ = true;
        }
        if (fireEvent)
            CtiProxy.sendMessage(
                CtiPhoneKeywords.AgentStateEvent,
                "",
                CtiPhone.makeParameter(
                    "state",
                    state,
                    "previousState",
                    message ? message.previousState : "",
                    "reason",
                    reason
                )
            );
    }

    updateCallTable() {
        const interactions = wsfe.work.getInteractions()._collection;
        if (interactions.length !== 0) {
            // 자동으로 에이전트 상태를 통화중으로 변경.
            // 자동으로 에이전트 상태를 통화중으로 변경.
            this.updateAgentState(CtiPhoneKeywords.AGENT_STATE_BUSY, 0);
        }
    }

    put(interaction) {
        this.updateCallTable();
        const call = {
            userToUserInfo: interaction.userToUserInfo,
            callData: undefined,
            interaction,
            incoming: false,
            accepted: false,
            // 컨설트콜인 경우 유형
            consultType: 0,
            consultOrigId: undefined,
            // 전화끊기 명령 호출 유무
            calledRelease: false,
            // Reconnect  호출 유무, 종료 cause를 'Release'를 주기 위함.
            callledReconnect: false,
            // 호전환, 회의통화 완료 혹은 1-step conference, 1-st transfer 호출 유무, 
            calledConsultComplete: false,
            // 보류 유무
            held: false,
            // 현재 콜의 참가자.
            participants: [],
            // SingleStepTransfer 시도 정보.
            sst: null,
            wsfe: this,
            // Consult 콜에서 transfer, conference  완료 가능한 시점까지 
            // CallCreatedEvent를 발생 보류하기 위함.
            // OnInteractionActiveCallback에서 CallCreatedEvent를 발생.
            sendCallCreatedEvent: true,
            // CallDeletedEvent 전달을 연기 유무.
            // IPT에서 IPCC로 호천환 시 처리를 위함.
            delaySendingCallDeletedEvent: false,

            setCalledConsultComplete: function () {
                this.calledConsultComplete = true;
                this.calledRelease = false;
                if (this.consultOrigId && this.consultType
                    === CtiPhoneKeywords.ConsultTypeTransfer) {
                    const orginCall = this.wsfe.get(this.consultOrigId);
                    if (orginCall)
                        orginCall.setCalledConsultComplete();
                }
            },
            checkConsult() {
                if (this.calledConsultComplete
                    && this.consultOrigId
                    && this.consultType === CtiPhoneKeywords.ConsultTypeTransfer) {
                    const orgiCall = this.wsfe.get(this.consultOrigId);
                    if (orgiCall)
                        orgiCall.clearReleaseReason();
                }
            },
            setCalledRelease: function () {
                this.checkConsult();
                this.calledConsultComplete = false;
                this.calledRelease = true;
                this.callledReconnect = false;
            },
            setCalledReconnect: function () {
                this.checkConsult();
                this.calledConsultComplete = false;
                this.calledRelease = false;
                this.callledReconnect = true;
            },
            clearReleaseReason: function () {
                this.checkConsult();
                this.calledConsultComplete = false;
                this.calledRelease = false;
            }
        };
        this.iteractionTraceMap.set(interaction.id, call);
        return call;
    }

    remove(interactionId) {
        const mycall = this.iteractionTraceMap.get(interactionId);
        this.iteractionTraceMap.delete(interactionId);
        this.updateCallTable();
        return mycall;
    }
    get(interactionId) {
        return this.iteractionTraceMap.get(interactionId);
    }
    /**
     * Profile를 찾는다.
     *
     * @param {string} id
     * @returns
     */
    findProfile(id) {
        if (this.user == null) return null;
        for (let profile of this.user.profileList) {
            if (id === profile.id) return profile;
        }
        return null;
    }

    getActivatedProfile() {
        return this.activatedProfile;
    }
    /**
     * 열려진 호의 목록.
     */
    get interactions() {
        return this.work.getInteractions()._collection;
    }
    /**
     * 호 ID로 호를 찾는다.
     * @param {string} id
     * @returns {Iteraction|undefined}
     */
    findCall(id) {
        if (id) {
            for (let iter of this.interactions) {
                if (iter.id == id) return iter;
            }
        }
        return undefined;
    }
    /**
     * 링이 울리는 호를 찾는다.
     *
     * @param {string} id
     * @returns {Interaction|undefined}
     */
    findAlertingCall(id) {
        if (id) return this.findCall(id);
        let interaction;
        for (let iter of this.interactions) {
            if (iter.detail.capabilities.canAccept) interaction = iter;
        }
        return interaction;
    }
    /**
     * 활성화되어 있는 콜을 찾는다.
     *
     * @param {string} id
     * @returns {Interaction|undefined}
     */
    findActiveCall(id) {
        if (id) return this.findCall(id);
        let interaction;
        for (let iter of this.interactions) {
            if (iter.data.state !== "HELD") interaction = iter;
        }
        if (interaction)
            return interaction;
        if (this.interactions.length === 1)
            return this.interactions[0];
        return undefined;
    }
    /**
     * 보류중인 호를 찾는다.
     *
     * @param {string} id
     * @returns {Interaction|undefined}
     */
    findHoldCall(id) {
        if (id) return this.findCall(id);
        let interaction;
        for (let iter of this.interactions) {
            if (iter.detail.capabilities.canUnhold) interaction = iter;
        }
        if (interaction)
            return interaction;
        if (this.interactions.length === 1)
            return this.interactions[0];
        return undefined;
    }

    findTransferCall(id) {
        if (id) return this.findCall(id);
        let call;
        for (let iter of this.interactions) {
            if (
                iter.detail.capabilities.canTransferComplete &&
                iter.detail.interactionType === "CONSULTING"
            )
                call = iter;
        }
        return call;
    }
    findConferenceCall(id) {
        if (id) return this.findCall(id);
        let call;
        for (let iter of this.interactions) {
            if (
                iter.detail.capabilities.canConferenceComplete &&
                iter.detail.interactionType === "CONSULTING"
            )
                call = iter;
        }
        return call;
    }

    findConsultingCall(id) {
        let call = undefined;
        let orgCall = undefined;
        if (id) call = this.findCall(id);
        for (let iter of this.interactions) {
            if (iter.detail.interactionType === "CONSULTING") call = iter;
            else if (iter.detail.capabilities.canUnhold && !call) orgCall = iter;
        }
        return {
            call,
            orgCall,
        };
    }

    /**
     * ClientSession.getConfiguration() 콜백. 클라이언트 세션 확립됨.
     *
     * @param {Object} authUser
     */
    initUserProfileList(authUser) {

        this.user.profileList = [];
        this.user.id = authUser.user.id;
        this.user.userHandle = authUser.user.userHandle;
        this.user.defaultUserProfileId = authUser.defaultUserProfileId;

        for (let p of authUser.userProfileDetailsList) {
            this.user.profileList.push({
                id: p.userProfile.id,
                name: p.userProfile.profileName,
                address: p.defaultResource.address,
            });
            console.log("User Profile: ", p);
        }
        CtiProxy.sendMessage(CtiPhoneKeywords.CmdOpenAck, "", CtiPhone.makeParameter("code", 0));
        // console.log("getConfiguration user paramter", authUser);
        //
        // LineInit으로 변경한다. 전화번호를 찾아야 한다.
        //
        // setTimeout(() => wsfe.agent.activate(wsfe.user.userHandle, wsfe.user.defaultUserProfileId), 100);
    }

    /**
     * Agent의 Activated 이벤트 처리.
     * Cti Extension Server에 연결한다.
     */
    processAgentActivated() {
        try {
            if (this.lineInitParameters) {
                CtiPhone.sendSuccessResponse(
                    CtiPhoneKeywords.CmdLineInit,
                    this.lineInitSessionId,
                    this.lineInitParameters
                );
                this.lineInitParameters = null;
            }
            CtiProxy.sendMessage(
                CtiPhoneKeywords.AgentActivatedEvent,
                "",
                CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldCode,
                    CtiPhoneKeywords.Success
                )
            );
        } catch (e) {
            console.log("OnActivatedCallback exception", e);
        }
    }

    /**
     * Agent의 Deactived 이벤트 처리.
     *
     */
    processAgentDeactivated() {
        console.log("OnDeactivatedCallback");
        CtiProxy.sendMessage(CtiPhoneKeywords.AgentDeactivatedEvent, "0", "");
    }

    /**
     * 에이전트 활성화.
     *
     * @param {string} sessionId
     * @param {string} parameters
     */
    agentActivate(sessionId, parameters) {

        if (this.agent.active) {
            this.log.info(
                "LineInit failed: reason=already activated, profile=" +
                this.activatedProfile
            );
            CtiPhone.sendSuccessResponse(
                CtiPhoneKeywords.CmdLineInit,
                sessionId,
                parameters
            );
        }
        this.activatedProfile = this.findProfile(
            this.user.defaultUserProfileId
        );
        this.lineInitSessionId = sessionId;
        this.lineInitParameters = parameters;
        const extension = parameters["profile"]; // extention에 prifile에 해당하는 데이터를 넣는다
        if (extension) { // extention이 존재할 시
            return this.agent  // 상담원 활성화
                .activate(this.user.userHandle, this.user.defaultUserProfileId, extension)
                .then(
                    () => {
                        this.log.info("LineInit success: extension=" + extension);
                        this.extension = extension;
                    },
                    (reason) => { // active 실패시 
                        CtiPhone.sendFailResponse( // fail메시지 전송
                            CtiPhoneKeywords.CmdLineInit,
                            sessionId,
                            parameters,
                            CtiPhoneKeywords.ErrorServiceFail,
                            reason
                        );
                        this.log.error(
                            `LineInit failed: reason=${reason}, profile=${this.user.defaultUserProfileId},extension=${extension}`
                        );
                        onEncounterErrorEvent(CtiPhoneKeywords.ErrorServiceFail, reason);
                    }
                );
        } else {
            this.extension = this.getActivatedProfile().address;
            return this.agent
                .activate(this.user.userHandle, this.user.defaultUserProfileId)
                .then(
                    () => {
                        this.log.info("LineInit success: extension=default");
                    },
                    (reason) => {
                        CtiPhone.sendFailResponse(
                            CtiPhoneKeywords.CmdLineInit,
                            sessionId,
                            parameters,
                            CtiPhoneKeywords.ErrorServiceFail,
                            reason
                        );
                        this.log.error(
                            `LineInit failed: reason=${reason}, profile=${this.user.defaultUserProfileId}, extension=default`
                        );
                        onEncounterErrorEvent(CtiPhoneKeywords.ErrorServiceFail, reason);
                    }
                );
        }
    }
    /**
     * 에이전트 비활성화.
     *
     * @param {string} sessionId
     * @param {string} parameters
     */
    agentDeactivate(sessionId, parameters) {
        if (this.calledAgentLoginByAgent_) {
            this.agentLogout();
        }
        this.agent.deactivate().then(
            () => {
                CtiPhone.sendSuccessResponse(
                    CtiPhoneKeywords.CmdLineClose,
                    sessionId,
                    parameters
                );
                this.log.info("LineClose success");
            },
            (reason) => {
                CtiPhone.sendFailResponse(
                    CtiPhoneKeywords.CmdLineClose,
                    sessionId,
                    parameters,
                    CtiPhoneKeywords.ErrorServiceFail,
                    reason
                );
                this.log.error("LineClose failed:");
            }
        );
    }

    findNewParty(totalset, subset) {
        for (const i of totalset) {
            const ok = subset.find(e => e.participantAddress === i.participantAddress);
            if (!ok)
                return i;
        }
        return undefined;
    }
    /**
     * Interaction에 대하여 콜백 설정.
     *
     * @param {Interaction} interaction
     */
    setInteractionCallback(interaction) {
        /**
         * 통화보류 이벤트
         */

        let state = '';

        interaction.addOnInteractionHeldCallback((event) => {
            // console.log("OnInteractionHeldCallback", event);
            const mycall = this.get(event.id);
            if (mycall)
                mycall.held = true;
            CtiProxy.sendMessage(
                CtiPhoneKeywords.CallHeldEvent,
                "",
                CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldData,
                    JSON.stringify(this.copyCallEventObject(event))
                )
            );
            state = 'HOLD'
            onChangeCallState(event, state);
        });
        /**
         * 콜상태 변경 이벤트
         */
        interaction.addOnInteractionActiveCallback((event) => {
            const callEventObject = this.copyCallEventObject(event);
            const mycall = this.get(event.id);
            // console.log("OnInteractionActiveCallback", event, mycall);
            if (!mycall) {
                // Not found mycall
                // error log
                // console.log("CallActive: Not found call", event);
                onEncounterErrorEvent(CtiPhoneKeywords.ErrorNotFoundCall, event);
            }
            callEventObject.consultType = mycall.consultType;
            if (!mycall.sendCallCreatedEvent) {
                CtiProxy.sendMessage(
                    CtiPhoneKeywords.CallCreatedEvent,
                    "",
                    CtiPhone.makeParameter(
                        CtiPhoneKeywords.FieldData,
                        JSON.stringify(callEventObject)
                    )
                );
                mycall.sendCallCreatedEvent = true;
            }
            if (mycall.sst) {
                const call = this.findCall(callEventObject.id);
                CtiPhone.sendResponse(
                    call.completeTransfer(),
                    CtiPhoneKeywords.CmdSingleStepTransferCall,
                    mycall.sst.sessionId,
                    mycall.sst.parameters
                );
                mycall.setCalledConsultComplete();
                mycall.sst = null;
            }
            if (mycall.incoming &&
                !mycall.accepted &&
                !event.capabilities.canAccept
            ) {
                // answer
                mycall.accepted = true;
                CtiProxy.sendMessage(
                    CtiPhoneKeywords.CallAcceptedEvent,
                    "",
                    CtiPhone.makeParameter(
                        CtiPhoneKeywords.FieldData,
                        JSON.stringify(callEventObject)
                    )
                );
                state = 'ACCEPT';
                onChangeCallState(event, state);
                return;
            }

            if (mycall.held && event.capabilities.canHold) {
                // HeldEvent
                mycall.held = false;
                CtiProxy.sendMessage(
                    CtiPhoneKeywords.CallRetrievedEvent,
                    "",
                    CtiPhone.makeParameter(
                        CtiPhoneKeywords.FieldData,
                        JSON.stringify(callEventObject)
                    )
                );
                state = '';
                onChangeCallState(event, state);
            }

            /*
            if (event.userToUserInfo) {
                // CallData 변경 검사.
                ctiExt
                    .getCallData(callEventObject.userToUserInfo)
                    .then((data) => {
                        if (data.message.data
                             && data.message.detail.uui
                             && data.message.detail.uui != mycall.callData
                            ) {
                                mycall.callData = data.message.detail.uui;
                                mycall.userToUserInfo = callEventObject.userToUserInfo;
                                const userData = {
                                    uui: data.message.detail.uui,
                                    key: callEventObject.userToUserInfo,
                                };
                                CtiProxy.sendMessage(
                                    CtiPhoneKeywords.UserDataEvent,
                                    "",
                                    CtiPhone.makeParameter(
                                        CtiPhoneKeywords.FieldData,
                                        JSON.stringify(userData)
                                    )
                                );
                        }
                    })
                    .catch((error) => {
                        //
                    });
            } 
            */

            if (mycall.participants.length > 1
                && event.participants.length > 1
                && event.participants.length != mycall.participants.length) {
                // 참가자가 변경됨.
                if (event.participants.length > mycall.participants.length) {
                    // 추가됨.
                    const party = this.findNewParty(event.participants, mycall.participants);
                    callEventObject.party = party ? party.participantAddress : "";
                    CtiProxy.sendMessage(
                        CtiPhoneKeywords.PartyAddedEvent,
                        "",
                        CtiPhone.makeParameter(
                            CtiPhoneKeywords.FieldData,
                            JSON.stringify(callEventObject)
                        )
                    );
                } else {
                    // 제거됨.
                    const party = this.findNewParty(mycall.participants, event.participants);
                    callEventObject.party = party ? party.participantAddress : "";
                    CtiProxy.sendMessage(
                        CtiPhoneKeywords.PartyRemovedEvent,
                        "",
                        CtiPhone.makeParameter(
                            CtiPhoneKeywords.FieldData,
                            JSON.stringify(callEventObject)
                        )
                    );
                }
                mycall.participants = event.participants.slice();
            } else {
                if (event.participants.length != mycall.participants.length)
                    mycall.participants = event.participants.slice();
                /*                
                                CtiProxy.sendMessage(
                                    CtiPhoneKeywords.CallActiveEvent,
                                    "",
                                    CtiPhone.makeParameter(
                                        CtiPhoneKeywords.FieldData,
                                        JSON.stringify(callEventObject)
                                    )
                                );
                */
            }
            onChangeCallState(event, event.state);
        });
        interaction.addOnInteractionUnheldCallback((event) => {
            console.log("OnInteractionUnheldCallback", event);
            onChangeCallState(event, event.state);
        });
        interaction.addOnInteractionUpdatedCallback((event) => {
            console.log("OnInteractionUpdatedCallback", event);
            onChangeCallState(event, event.state);
        });
        interaction.addOnRemoteParticipantAcceptedCallback((event) => {
            // console.log("OnRemoteParticipantAcceptedCallback", event);
            const eventObject = { id: event.id, consultType: 0 };
            const mycall = this.get(event.id);
            if (mycall)
                eventObject.consultType = mycall.consultType;
            /*
                        if (mycall) {
                            eventObject.consultType = mycall.consultType;
                            if (mycall.sst) {
                                const call = this.findCall(event.id);
                                if (call) {
                                    CtiPhone.sendResponse(
                                        call.completeTransfer(),
                                        CtiPhoneKeywords.CmdSingleStepTransferCall,
                                        mycall.sst.sessionId,
                                        mycall.sst.parameters
                                    );
                                    return;
                                }
                            }
                        }
            */
            CtiProxy.sendMessage(
                CtiPhoneKeywords.CallRemoteAcceptedEvent,
                "",
                CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldData,
                    JSON.stringify(eventObject)
                )
            );
            // console.log("OnRemoteParticipantAcceptedCallback");
            onChangeCallState(event, 'REMOTE ACCEPTED');
            return CtiPhoneKeywords.Success;
        });
    }

    copyCallEventObject(event) {
        return {
            skill: event.skill,
            direction: event.direction,
            id: event.id,
            originatingAddress: event.originatingAddress,
            destinationAddress: event.destinationAddress,
            interactionType: event.interactionType,
            userToUserInfo: event.userToUserInfo,
            contactId: event.contactId,
            state: event.state,
            participants: Object.assign({}, event.participants),
            // 이벤트 발생 원인
            cause: "Normal",
            // 0: normal, 1: transfer, 2: conference
            consultType: 0,
        };
    }
    /**
     * 호가 생성될때 발생함.
     *
     * @param {Event} event
     */
    processInteractionCreated(event) {
        // console.log("OnInteractionCreatedCallback", event);
        const isConsulting = event.interactionType === CtiPhoneKeywords.InteractionTypeConsulting;
        const isInbound = event.direction === CtiPhoneKeywords.DirectionIncoming;
        const isSingleStepTransfer = this.sstRequest && isConsulting;
        const callEventObject = this.copyCallEventObject(event);
        let sendCallCreatedEvent = true;
        // if true: not send event
        let noSendEvent = false;
        if (this.lastInteractionId_ && this.lastInteractionId_ === event.id) {
            console.log("*** ERROR Call event duplication  ****** : " + event.id);
            return;
        }

        if (this.consultedReleaseTimerId_ != 0) {
            // 이전콜에 대하여 Release 연기 상태 이면
            // consulted call && (transferred || conferenced)
            if (event.interactionType === CtiPhoneKeywords.InteractionTypeTtransferred
                || event.interactionType === CtiPhoneKeywords.InteractionTypeConferenced) {
                noSendEvent = true;
            } else {
                CtiProxy.sendMessage(
                    CtiPhoneKeywords.CallDeletedEvent,
                    "",
                    this.consultedReleaseParameters
                );
            }
            clearTimeout(this.consultedReleaseTimerId_);
            this.consultedReleaseTimerId_ = 0;
            this.consultedReleaseParameters = '';
        } else if (event.interactionType === CtiPhoneKeywords.InteractionTypeTtransferred
            || event.interactionType === CtiPhoneKeywords.InteractionTypeConferenced) {
            if (this.iteractionTraceMap.size !== 0)
                noSendEvent = true;
        }

        if (isConsulting) {
            // Consulting 호인 경우. interactionType === 'CONSULTING'
            callEventObject.consultType = this.consultType;
        }
        this.sstRequest = false;
        if (isSingleStepTransfer) {
            // 1-step transfer.
            if (this.sstRequestParameters[CtiPhoneKeywords.FieldUui])
                callEventObject.uui = this.sstRequestParameters[CtiPhoneKeywords.FieldUui];
            CtiProxy.sendMessage(
                CtiPhoneKeywords.CallCreatedEvent,
                "",
                CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldData,
                    JSON.stringify(callEventObject)
                )
            );
        } else {
            if (isConsulting
                && this.consultType == CtiPhoneKeywords.ConsultTypeConference
                && !event.capabilities.canConferenceComplete) {
                sendCallCreatedEvent = false;
            } else if (isConsulting
                && this.consultType == CtiPhoneKeywords.ConsultTypeTransfer
                && !event.capabilities.canTransferComplete) {
                sendCallCreatedEvent = false;
            } else if (!noSendEvent) {
                CtiProxy.sendMessage(
                    CtiPhoneKeywords.CallCreatedEvent,
                    "",
                    CtiPhone.makeParameter(
                        CtiPhoneKeywords.FieldData,
                        JSON.stringify(callEventObject)
                    )
                );
            }
        }
        for (let i of this.work.getInteractions()._collection) {
            if (i.id === event.id) {
                this.setInteractionCallback(i);
                const mycall = this.put(i);
                mycall.incoming = isInbound;
                mycall.callData = callEventObject.uui;
                mycall.consultType = callEventObject.consultType;
                mycall.sendCallCreatedEvent = sendCallCreatedEvent;
                mycall.participants = event.participants.slice();
                if (mycall.consultType != CtiPhoneKeywords.ConsultTypeNone)
                    mycall.consultOrigId = this.consultOrigId;
                if (isSingleStepTransfer) {
                    //                    mycall.setCalledConsultComplete();
                    mycall.sst = {
                        sessionId: this.sstRequestSessionId,
                        parameters: this.sstRequestParameters
                    };
                } else if (sendCallCreatedEvent
                    && !isConsulting
                    && event.interactionType === CtiPhoneKeywords.InteractionTypeCalled
                    && event.originatingAddress
                    && event.participants.length >= 2
                    && ((!event.participants[0].isSelf && event.participants[0].participantType === "STATION")
                        || !event.participants[1].isSelf && event.participants[1].participantType === "STATION")) {
                    mycall.delaySendingCallDeletedEvent = true;
                }
                break;
            }
        }
        this.setConsultType(CtiPhoneKeywords.ConsultTypeNone);
        // console.log("OnInteractionCreatedCallback");
    }
    /**
     * 호 종료 이벤트 처리.
     *
     * @param {Event} event
     */
    processInteractionDeleted(event) {
        const mycall = this.remove(event.id);
        const callEventObject = this.copyCallEventObject(event);
        // console.log("OnInteractionDeletedCallback", event, mycall);
        if (!mycall) {
            console.log("OnInteractionDeletedCallback: not found mycall");
            return;
        }
        callEventObject.consultType = mycall.consultType;
        if (mycall.calledRelease) {
            callEventObject.cause = "Release";
        } else if (mycall.calledConsultComplete) {
            if (mycall.consultType == CtiPhoneKeywords.ConsultTypeTransfer) {
                callEventObject.cause = "On_hook/Complete_Transfer";
            }
            else if (mycall.consultType == CtiPhoneKeywords.ConsultTypeConference)
                callEventObject.cause = "ConferenceCompleted";
        } else if (mycall.callledReconnect) {
            callEventObject.cause = "Release";
            if (mycall.consultOrigId) {
                const orgiCall = this.findCall(mycall.consultOrigId);
                if (orgiCall) {
                    orgiCall.unhold();
                }
            }
        } else if (event.interactionType === CtiPhoneKeywords.InteractionTypeConsulted
            || mycall.delaySendingCallDeletedEvent) {
            // Consulting call의 CallDeletedEvent 발생을 연기한다.
            // or IPT Consulting call을 대비해..
            if (this.iteractionTraceMap.size === 0) {
                this.consultedReleaseParameters = CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldData,
                    JSON.stringify(callEventObject)
                );
                this.consultedReleaseTimerId_ = setTimeout(() => {
                    this.consultedReleaseTimerId_ = 0;
                    CtiProxy.sendMessage(
                        CtiPhoneKeywords.CallDeletedEvent,
                        "",
                        this.consultedReleaseParameters
                    );
                }, CtiPhoneKeywords.ConsultedReleaseDelayTime);
            }
            return;
        }

        if (!mycall.sendCallCreatedEvent) {
            CtiProxy.sendMessage(
                CtiPhoneKeywords.CallCreatedEvent,
                "",
                CtiPhone.makeParameter(
                    CtiPhoneKeywords.FieldData,
                    JSON.stringify(callEventObject)
                )
            );
        }
        CtiProxy.sendMessage(
            CtiPhoneKeywords.CallDeletedEvent,
            "",
            CtiPhone.makeParameter(
                CtiPhoneKeywords.FieldData,
                JSON.stringify(callEventObject)
            )
        );
        // console.log("OnInteractionDeletedCallback");
    }

    log = {
        get debugEnabled() {
            return DEBUG_MODE;
        },
        info(...s) {
            console.info(s);
        },
        debug(...s) {
            console.debug(s)
        },
        error(...s) {
            console.error(s);
        },
        warning(...s) {
            console.warn(s);

        },
    };

    setSstFlag(sessionId, parameters) {
        this.sstRequest = true;
        this.sstRequestTime = Date.now();
        this.sstRequestSessionId = sessionId;
        this.sstRequestParameters = parameters;
    }

    sendSessionErrorEvent(code, message, reason, action) {
        if (action === "")
            action = "관리자에게 문의 하십시요";
        CtiProxy.sendMessage(
            CtiPhoneKeywords.SessionErrorEvent,
            "",
            CtiPhone.makeParameter(
                "code",
                code,
                "message",
                message,
                "reason",
                reason,
                "action",
                action
            )
        );
    }

    start() {
        /**
         * UAC Configuration for Avaya Customer Services SDK
         */
        const config = {
            uacConfiguration: new AvayaCustomerServices.Config.UACConfiguration(
                {
                    enabled: true,
                    clientInfo: { id: CLIENT_ID },
                    serverInfo: { apiUrl: API_URL },
                    notificationInfo: { broadcastUrl: BROADCAST_URL },
                    authenticationInfo: {
                        enabled: true,
                        tokens: ["Authorization"],
                    },
                }
            ),
        };
        // Bootstrap Customer Interaction Services SDK
        this.client_ = new AvayaCustomerServices(config);
        this.clientSession_ = this.client_.createClientSession();
        this.clientSession_.setToken({
            header: "Authorization",
            value: SSOToken,
        });
        console.log("SSOToken : ", SSOToken);
        this.clientSession_.start();

        // websocket error
        this.clientSession_.addOnCloseCallback((callback)=> {
            onSocketClosed(callback);
        });

        this.clientSession_.addOnErrorCallback((error) => {

            if (error.code == 2000017 || error.code == 4000014 || error.code == 3000007) {
                this.sendSessionErrorEvent(error.code, error.message, error.reason, "");
            } else if (error.code == 4000001) {
                this.sendSessionErrorEvent(error.code, error.message, error.reason, "다시 로그인하여 주십시요.");
            }

            onEncounterErrorEvent("5", error);
            //console.log(error);
        });
        console.log("tokenData : ", tokenData);
        // Get configuration
        this.clientSession_
            .getConfiguration(tokenData.authHandle)
            .then((authUser) => {
                this.initUserProfileList(authUser);
                onSessionopened(authUser);
            });

        this.agent = this.clientSession_.createAgent();
        this.work = this.clientSession_.createWork();
        const agent = this.agent;

        // Attach listener for agent deactivate event
        agent.addOnDeactivatedCallback((message) => {
            this.processAgentDeactivated();
            onChangeAgentState(message);
        });

        agent.addOnActivatedCallback((message) => {
            this.processAgentActivated()
            onAgentActivatedState(message);
        });

        agent.addOnStateCompleteCallback((message) => {
            // console.log("OnStateCompleteCallback", message);
        });

        agent.addOnStateLoggedOutCallback((message) => {
            // console.log("OnStateLoggedOutCallback", message);
            this.updateAgentState(CtiPhoneKeywords.AGENT_STATE_LOGOUT, 0, message);
            // onChangeAgentState(CtiPhoneKeywords.AGENT_STATE_LOGOUT);
            onChangeAgentState(message);
        });
        agent.addOnStateLoginPendingCallback((message) => {
            // console.log("OnStateLoginPendingCallback", message);
            this.updateAgentState(CtiPhoneKeywords.AGENT_STATE_LOGIN, 0, message);
            onChangeAgentState(message);
        });
        agent.addOnStateLogoutPendingCallback((message) => {
            // console.log("OnStateLogoutPendingCallback", message);
            onChangeAgentState(message);
        });
        agent.addOnStateAfterContactWorkCallback((message) => {
            // console.log("OnStateAfterContactWorkCallback", message);
            //            this.updateAgentState(CtiExtensionConsts.STATE_CWC, 0, message);
            //
            this.updateAgentState(
                CtiPhoneKeywords.AGENT_STATE_ACTIVITY_CODE,
                17,
                message);
            onChangeAgentState(message);
        });
        agent.addOnStateAfterContactWorkPendingCallback((message) => {
            // console.log("OnStateAfterContactWorkPendingCallback", message);
            onChangeAgentState(message);
        });
        agent.addOnStateNotReadyCallback((message) => {
            // console.log("OnStateNotReadyCallback", message);
            const reasonCode = message.reasonCode ? parseInt(message.reasonCode) : 0;
            if (reasonCode != 0) {
                this.updateAgentState(
                    CtiPhoneKeywords.AGENT_STATE_ACTIVITY_CODE,
                    message.reasonCode,
                    message
                );

            } else {
                this.updateAgentState(
                    CtiPhoneKeywords.AGENT_STATE_NOTREADY,
                    message.reasonCode ? message.reasonCode : 0,
                    message
                );
            }
            onChangeAgentState(message);
        });
        agent.addOnStateNotReadyPendingCallback((message) => {
            // console.log("OnStateNotReadyPendingCallback", message);
        });
        agent.addOnStateReadyCallback((message) => {
            // console.log("OnStateReadyCallback", message);
            if (this.iteractionTraceMap.size === 0)
                this.updateAgentState(CtiPhoneKeywords.AGENT_STATE_READY, 0, message);
            onChangeAgentState(message);
        });
        agent.addOnStateUnknownCallback((message) => {
            console.log("OnStateUnknownCallback", message);
        });

        // 호 시작
        this.work.addOnInteractionCreatedCallback((event) => {
            this.processInteractionCreated(event)
            onCallCreated(event);
        });
        // 호 종료 이벤트.
        this.work.addOnInteractionDeletedCallback((event) => {
            this.processInteractionDeleted(event);
            onCallReleased(event);
        });
        // 2023-07-13
        //        CtiProxy.sendMessage("OpenAck", "", CtiPhone.makeParameter("code", 0));
    }

    deleteCookie(key) {
        //	document.cookie = encodeURIComponent(key) + '=; expires=-1;path=/'
        document.cookie = encodeURIComponent(key) + "=; expires=-1";
    }


    close() {
        this.deleteCookie(SESSION_COOKIE_NAME);
        //        deleteCookie("JSESSIONID");
        document.cookie =
            encodeURIComponent("JSESSIONID") + "=; expires=-1;path=/";
        this.clientSession_.stop();
        CtiProxy.sendMessage(CtiPhoneKeywords.SessionClosedEvent, "0", "");
    }
}

/**
 * CTI Agent와 연동 및 소프트폰 기능.
 *
 */
const CtiPhone = {};

/**
 * CTI Proxy로부터 메시지 수신.
 *
 */
CtiPhone.onMessage = (name, sessionId, parameters) => {

    console.log(name + "(" + sessionId + "," + parameters + ")");
    if (CtiPhone.func[name]) {
        if (parameters.length == 0) {
            CtiPhone.func[name](sessionId, []);
        } else {
            CtiPhone.func[name](
                sessionId,
                CtiPhone.decodeParameter(parameters)
            );
        }
    } else {
        console.log("Not found message handler: " + name);
    }
};

CtiPhone.sendSuccessResponse = (
    name,
    sessionId,
    requestParameters,
    addParameters
) => {
    try {
        const s = CtiPhone.objectToParameter(
            Object.assign(  // Object.assign(target, ..sources) {} 빈객체에 requestParameters ~ addParameters ? addParameters : {} 객체 복사
                {},
                requestParameters,
                { code: "0" },
                addParameters ? addParameters : {}
            )
        );
        CtiProxy.sendMessage(name + "Ack", sessionId, s);
    } catch (e) {
        console.log(e);
    }
};
CtiPhone.sendFailResponse = (
    name,
    sessionId,
    requestParameters,
    errorCode,
    errorMessage
) => {
    console.log("Reason", errorMessage);
    CtiProxy.sendMessage(
        name + "Ack",
        sessionId,
        CtiPhone.objectToParameter(
            Object.assign({}, requestParameters, {
                code: errorCode,
                message: errorMessage ? errorMessage : "",
            })
        )
    );
};

CtiPhone.func = {};

CtiPhone.makeParameter = function () {
    let s = "";
    for (let i = 0; i < arguments.length - 1; i += 2) {
        if (s.length !== 0) s = s.concat(PARAM_RS);
        if (arguments[i + 1] === undefined || arguments[i + 1] === null)
            s = s.concat(arguments[i] + PARAM_US);
        else s = s.concat(arguments[i] + PARAM_US + arguments[i + 1]);
    }
    return s;
};
CtiPhone.objectToParameter = (obj) => {
    let s = "";
    for (const prop in obj) {
        if (s.length !== 0) s = s.concat(PARAM_RS);
        if (obj[prop] === undefined || obj[prop] === null) {
            s = s.concat(prop + PARAM_US);
        } else {
            s = s.concat(prop + PARAM_US + obj[prop]);
        }
    }
    return s;
    //    Object.keys(obj).forEach()
};

CtiPhone.decodeParameter = (s) => {
    const arr = s.split(PARAM_RS);
    const params = [];
    for (let ele of arr) {
        const p = ele.split(PARAM_US);
        if (p.length == 1) {
            params[p[0]] = "";
        } else {
            params[p[0]] = p[1];
        }
    }
    return params;
    /*
        return arr.map((ele) => {
            const p = ele.split(PARAM_US);
            if (p.length == 1) {
                return {[p[0]]: ''} ;
            } else {
                return {[p[0]]: p[1]} ;
            }
        });
    */
};
CtiPhone.sendResonseNotFoundCall = (command, sessionId, parameters) => {
    CtiPhone.sendFailResponse(
        command,
        sessionId,
        parameters,
        CtiPhoneKeywords.ErrorNotFoundCall,
        CtiPhoneKeywords.MsgNotFoundCall
    );
};

CtiPhone.sendResponse = (aPromise, command, sessionId, parameters, successCallback, failCallback) => {
    aPromise.then(
        () => {
            CtiPhone.sendSuccessResponse(command, sessionId, parameters);
            if (successCallback)
                successCallback();
            wsfe.log.info(`${command} success`);
        },
        (reason) => {
            CtiPhone.sendFailResponse(
                command,
                sessionId,
                parameters,
                CtiPhoneKeywords.ErrorServiceFail,
                reason
            );
            if (failCallback)
                failCallback();
            wsfe.log.warning(`${command} failed: cause=${reason}`);
        }
    );
};
/**
 * 프로파일 활성화 시킨다, 현재 버전은 무조건 기본 profile을 활성화 시킨다.
 * 추후에  profileId에 따른 활성화를 지원함, profileId가 공백이면 기본 프로파일에 연관된 DN을 활성화 시킨다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdLineInit] = async (sessionId, parameters) => {
    wsfe.agentActivate(sessionId, parameters);
};

/**
 * 프로파일 비활성화 시킨다. CtiExtension에서 deactive.
 *
 */
CtiPhone.func[CtiPhoneKeywords.CmdLineClose] = (sessionId, parameters) => {
    wsfe.agentDeactivate(sessionId, parameters);
};

/**
 *
 * @param {*} sessionId
 * @param {*} parameters
 */
CtiPhone.func[CtiPhoneKeywords.CmdClose] = (sessionId, parameters) => {
    wsfe.close();
    CtiProxy.sendMessage("CloseAck", "", CtiPhone.makeParameter("code", 0));
    window.location.reload();
};

/**
 * 전화를 건다. UUI 데이터는 무시한다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdMakeCall] = async (sessionId, parameters) => {
    wsfe.sstRequest = false;
    const dn = parameters["dn"];
    if (dn) {
        try {
            const message = wsfe.work.createInteraction("VOICE", dn);
            CtiPhone.sendSuccessResponse(
                CtiPhoneKeywords.CmdMakeCall,
                sessionId,
                parameters
            );
            wsfe.log.info("MakeCall success: dn=" + dn);
            return CtiPhoneKeywords.Success;
        } catch (reason) {

            CtiPhone.sendFailResponse(
                CtiPhoneKeywords.CmdMakeCall,
                sessionId,
                parameters,
                CtiPhoneKeywords.ErrorServiceFail,
                reason
            );
            wsfe.log.error("MakeCall error: dn=" + dn);
            return CtiPhoneKeywords.ErrorServiceFail;
        }
    } else {
        wsfe.log.warning("MakeCall failed: cause=Invalid parameters");
        CtiPhone.sendFailResponse(
            CtiPhoneKeywords.CmdMakeCall,
            sessionId,
            parameters,
            CtiPhoneKeywords.ErrorInvalidParamter,
            "Invalid parameters"
        );
        onEncounterErrorEvent(CtiPhoneKeywords.ErrorServiceFail, "Invalid parameters");
        return CtiPhoneKeywords.ErrorServiceFail;
    }
};
/**
 * 전화를 받는다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdAnswerCall] = (sessionId, parameters) => {
    const call = wsfe.findAlertingCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.accept(),
            CtiPhoneKeywords.CmdAnswerCall,
            sessionId,
            parameters
        );
        return CtiPhoneKeywords.Success;
    } else {
        wsfe.log.info("AnswerCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdAnswerCall,
            sessionId,
            parameters
        );
        onEncounterErrorEvent(CtiPhoneKeywords.ErrorNotFoundCall, "Not found Call");
        return CtiPhoneKeywords.ErrorNotFoundCall;
    }
};

/**
 * 호를 끊는다.
 * 활성화된 콜을 찾는다. 활성화된 콜이 없으면 보류상태 호를 찾는다.
 * 콜 추적정보에 calledRelease를 true 설정.
 */
CtiPhone.func[CtiPhoneKeywords.CmdReleaseCall] = (sessionId, parameters) => {
    let call = wsfe.findActiveCall(parameters[CtiPhoneKeywords.FieldId]);
    if (call) {
        CtiPhone.sendResponse(
            call.end(),
            CtiPhoneKeywords.CmdReleaseCall,
            sessionId,
            parameters
        );
    } else {
        call = wsfe.findHoldCall(parameters[CtiPhoneKeywords.FieldId]);
        wsfe.log.info("ReleaseCall: cause=not found active call");
        if (call)
            CtiPhone.sendResponse(
                call.end(),
                CtiPhoneKeywords.CmdReleaseCall,
                sessionId,
                parameters
            );
        else
            CtiPhone.sendResonseNotFoundCall(
                CtiPhoneKeywords.CmdReleaseCall,
                sessionId,
                parameters
            );
    }
    if (call) {
        const mycall = wsfe.get(call.id);
        if (mycall) {
            mycall.setCalledRelease();
        }
    }
};

CtiPhone.func[CtiPhoneKeywords.CmdHoldCall] = (sessionId, parameters) => {
    const call = wsfe.findActiveCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.hold(),
            CtiPhoneKeywords.CmdHoldCall,
            sessionId,
            parameters
        );
    } else {
        wsfe.log.info("HoldCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdHoldCall,
            sessionId,
            parameters
        );
    }
};

CtiPhone.func[CtiPhoneKeywords.CmdUnholdCall] = (sessionId, parameters) => {
    const call = wsfe.findHoldCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.unhold(),
            CtiPhoneKeywords.CmdUnholdCall,
            sessionId,
            parameters
        );
    } else {
        wsfe.log.info("UnholdCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdUnholdCall,
            sessionId,
            parameters
        );
    }
};

/**
 * 컨설트 콜을 생성한다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdConsultCall] = (sessionId, parameters) => {
    wsfe.sstRequest = false;
    const dn = parameters[CtiPhoneKeywords.FieldDn];
    const uui = parameters[CtiPhoneKeywords.FieldUui];
    const type = parameters[CtiPhoneKeywords.FieldType] == "1" ? 1 : 2;
    const call = wsfe.findActiveCall(parameters[CtiPhoneKeywords.FieldId]);

    if (call) {
        let p;
        if (uui) {
            p = call.consult(dn, uui);
            // p = call.consult(dn, call.data.contactId);
        } else {
            p = call.consult(dn);
        }
        CtiPhone.sendResponse(
            p,
            CtiPhoneKeywords.CmdConsultCall,
            sessionId,
            parameters
        );
        wsfe.setConsultType(type, call.id);
    } else {
        wsfe.log.info("ConsultCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdConsultCall,
            sessionId,
            parameters
        );
    }
};
/**
 * 2-step 호전환을 완료한다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdTransferCall] = (sessionId, parameters) => {
    let call = wsfe.findTransferCall(parameters[CtiPhoneKeywords.FieldId]);
    if (call) {
        CtiPhone.sendResponse(
            call.completeTransfer(),
            CtiPhoneKeywords.CmdTransferCall,
            sessionId,
            parameters
        );
        const mycall = wsfe.get(call.id);
        if (mycall) {
            mycall.setCalledConsultComplete();
        }
    } else {
        wsfe.log.warning("TransferCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdTransferCall,
            sessionId,
            parameters
        );
    }
};

/**
 * 2-step 회의통화를 완료한다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdConferenceCall] = (sessionId, parameters) => {
    let call = wsfe.findConferenceCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.completeConference(),
            CtiPhoneKeywords.CmdConferenceCall,
            sessionId,
            parameters
        );
        const mycall = wsfe.get(call.id);
        if (mycall) {
            mycall.setCalledConsultComplete();
        }
    } else {
        wsfe.log.warning("ConferenceCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdConferenceCall,
            sessionId,
            parameters
        );
    }
};

/**
 * 1-step 호전환.
 * 만약 UUI를 포함하는 경우, 2-step 호전환을 실시한다.
 */
CtiPhone.func[CtiPhoneKeywords.CmdSingleStepTransferCall] = (
    sessionId,
    parameters
) => {
    wsfe.sstRequest = false;
    const call = wsfe.findActiveCall(parameters[CtiPhoneKeywords.FieldId]);
    if (call) {
        const mycall = wsfe.get(call.id);
        if (parameters[CtiPhoneKeywords.FieldUui]) {
            wsfe.setConsultType(CtiPhoneKeywords.ConsultTypeTransfer, call.id);
            wsfe.setSstFlag(sessionId, parameters);
            console.log("SingleStep", call.data.contactId)
            call.consult(parameters[CtiPhoneKeywords.FieldDn], parameters[CtiPhoneKeywords.FieldUui]).then( // 23.11.28 수정
                () => { },
                (error) => {
                    CtiPhone.sendResonseNotFoundCall(
                        CtiPhoneKeywords.CmdSingleStepTransferCall,
                        sessionId,
                        parameters
                    );
                    console.log("error : ", e);
                    if (mycall)
                        mycall.clearReleaseReason();
                }
            );
        } else {
            if (mycall)
                mycall.setCalledConsultComplete();
            CtiPhone.sendResponse(
                call.singleStepTransfer(parameters[CtiPhoneKeywords.FieldDn]),
                CtiPhoneKeywords.CmdSingleStepTransferCall,
                sessionId,
                parameters,
                null,
                () => { if (mycall) mycall.clearReleaseReason(); }
            );
        }
    } else {
        wsfe.log.warning("SingleStepTransferCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdSingleStepTransferCall,
            sessionId,
            parameters
        );
    }
};

CtiPhone.func[CtiPhoneKeywords.CmdSendDtmf] = (sessionId, parameters) => {
    const call = wsfe.findActiveCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.sendDTMF(parameters["dtmf"]),
            CtiPhoneKeywords.CmdSendDtmf,
            sessionId,
            parameters
        );
    } else {
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdSendDtmf,
            sessionId,
            parameters
        );
    }
};

CtiPhone.func[CtiPhoneKeywords.CmdMute] = (sessionId, parameters) => {
    const call = wsfe.findActiveCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.muteAudio(),
            CtiPhoneKeywords.CmdMute,
            sessionId,
            parameters
        );
    } else {
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdMute,
            sessionId,
            parameters
        );
    }
};

CtiPhone.func[CtiPhoneKeywords.CmdUnmute] = (sessionId, parameters) => {
    const call = wsfe.findActiveCall(parameters["id"]);
    if (call) {
        CtiPhone.sendResponse(
            call.unmuteAudio(),
            CtiPhoneKeywords.CmdUnmute,
            sessionId,
            parameters
        );
    } else {
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdUnmute,
            sessionId,
            parameters
        );
    }
};

/**
 * Reconnect.
 */
CtiPhone.func[CtiPhoneKeywords.CmdReconnectCall] = (sessionId, parameters) => {
    let { call, orgCall } = wsfe.findConsultingCall(parameters["id"]);
    if (call && orgCall) {
        ;
        const mycall = wsfe.get(call.id);
        if (mycall)
            mycall.setCalledReconnect();
        CtiPhone.sendResponse(
            call.end(),
            CtiPhoneKeywords.CmdReconnectCall,
            sessionId,
            parameters
        );
    } else {
        if (orgCall) {
            orgCall.unhold();
        }
        wsfe.log.warning("ReconnectCall failed: cause=not found call");
        CtiPhone.sendResonseNotFoundCall(
            CtiPhoneKeywords.CmdReconnectCall,
            sessionId,
            parameters
        );
    }
};

/**
 * 상담원 상태 변경.
 * @param {string} parameters
 * 	- state:
 *  - reason:
 */
CtiPhone.func[CtiPhoneKeywords.CmdSetAgentState] = (sessionId, parameters) => {
    const reason = parameters["reason"];
    const state = parseInt(parameters["state"]);
    /*    wsfe.log.info(
            `SetAgentState: state=${state}, reason=${reason}`
        );*/
    wsfe.clearAgentStateTimer();
    let apromise = null;
    switch (state) {
        case CtiPhoneKeywords.AGENT_STATE_READY:
            wsfe.agent.goReady('MANUAL_IN');
            break;
        case CtiPhoneKeywords.AGENT_STATE_NOTREADY:
            wsfe.setAgentStateTimer(CtiPhoneKeywords.AGENT_STATE_NOTREADY, 0);
            apromise = wsfe.agent.goNotReady(0); // 23.10.21 - cti 설정 필요
            break;
        case CtiPhoneKeywords.AGENT_STATE_ACTIVITY_CODE:
            if (reason === 19 && wsfe.iteractionTraceMap.size !== 0)
                break;
            wsfe.setAgentStateTimer(CtiPhoneKeywords.AGENT_STATE_ACTIVITY_CODE, reason);
            apromise = wsfe.agent.goNotReady(reason || 0);
            break;
        //        case 5:
        //            wsfe.agent.goAfterContactWork();
        //            break;
        case CtiPhoneKeywords.AGENT_STATE_LOGIN:
            //            wsfe.agent.login();
            apromise = wsfe.agentLogin();
            break;
        case CtiPhoneKeywords.AGENT_STATE_LOGOUT:
            //            wsfe.agent.logout();
            apromise = wsfe.agentLogout();
            break;
        default:
            wsfe.log.warning(
                `SetAgentState error: cause=unknown state, state=${state}`
            );
            break;
    }
    if (apromise) {
        apromise.then(
            () => {
                //
            },
            (reason) => {
                this.log.error(`SetAgentState failed: reason=${reason}`);
            }
        );
    }
    CtiPhone.sendSuccessResponse(
        CtiPhoneKeywords.CmdSetAgentState,
        sessionId,
        parameters
    );
};

/**
 * AgentStateInfo를 문자열로 변환한다.
 * @param {AgentStateInfoDto} agents
 * @returns
 */
const toAgentStateInfoToString = (agents) => {
    let s = "";
    for (let agent of agents) {
        //        s = s.concat("|" + agent.id + ":" + agent.state + ":" + agent.subState);
        s = s.concat("|" + agent.id + ":" + agent.state + ":" + agent.extension);
    }
    return s + "|";
};

/**
 *  Proxy에서 호출됨.
 *
 * @param {*} reason
 */
CtiPhone.logout = (reason) => {
    console.log("Call agent.deactivate()");
    try {
        wsfe.agentLogout();
        wsfe.agent.deactivate();
    } catch (e) {
        //
    }
    try {
        wsfe.close();
    } catch (e) {
        //
    }
    setTimeout(() => window.location.reload(), 100);
};


/**
 * Parse JSON Web Token
 *
 * @private
 * @returns {Object}
 */
function parseSSOToken(token) {
    console.log("token : ", token);
    let parsedJWT;
    let encodedJWT = token.split(" ")[1];
    if (!encodedJWT) return;

    let payload = encodedJWT.split(".")[1];
    if (!payload) return;

    try {
        parsedJWT = JSON.parse(window.atob(payload));
        console.log("parsedJWT : ", parsedJWT);
    } catch (error) {
        parsedJWT = {};
    }
    return {
        authHandle: parsedJWT.sub,
        expires: parsedJWT.exp,
    };
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

    // 24.08.07 pnh
    if (getItem.length > 0) {
        const decodedCookieValue = decodeURIComponent(getItem[0]);
        return JSON.parse(decodedCookieValue);
    }
}

// -----------------------------------------------------------------------------------

function setServerInfos(url) {

    const callList = wsfe.interactions;
    return callList;

}

function activate(profileId) {

    CtiPhone.onMessage(
        "LineInit",
        "0",
        ''
    );

}

function deactivate() {

    CtiPhone.onMessage(
        "LineClose",
        "0",
        ''
    );
}

function login() {

    let param = 'state';

    CtiPhone.onMessage(
        "SetAgentState",
        "0",
        param.concat(PARAM_US, CtiPhoneKeywords.AGENT_STATE_LOGIN)
    );
}

function logout() {

    let param = 'state';

    CtiPhone.onMessage(
        "SetAgentState",
        "0",
        param.concat(PARAM_US, CtiPhoneKeywords.AGENT_STATE_LOGOUT)
    );
}

function goReady() {

    let param = 'state';

    CtiPhone.onMessage(
        "SetAgentState",
        "0",
        param.concat(PARAM_US, CtiPhoneKeywords.AGENT_STATE_READY)
    );
}

function goNotReady(reason) {

    let param1 = 'state';
    let param2 = 'reason';

    CtiPhone.onMessage(
        "SetAgentState",
        "0",
        param1.concat(PARAM_US, CtiPhoneKeywords.AGENT_STATE_NOTREADY, PARAM_RS, param2, PARAM_US, reason)
    );
}

function makeCall(dn) {

    let param = 'dn';

    CtiPhone.onMessage(
        "MakeCall",
        "0",
        param.concat(PARAM_US, dn)
    );
}

function answer(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "AnswerCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function hold(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "HoldCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function unhold(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "UnholdCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function release(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "ReleaseCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function consult(dn, uui, type, iId) {

    let param1 = 'dn';
    let param2 = 'uui';
    let param3 = 'type';
    let param4 = 'iId';

    CtiPhone.onMessage(
        "ConsultCall",
        "0",
        param1.concat(PARAM_US, dn, PARAM_RS, param2, PARAM_US, uui, PARAM_RS, param3, PARAM_US, type, PARAM_RS, param4, PARAM_US, iId)
    );
}


// 2-step 호전환
function transfer(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "TransferCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

// 회의통화
function conference(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "ConferenceCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}


// single-step 호전환
function blindTransfer(dn, iId, uui) {

    let param1 = 'dn';
    let param2 = 'iId';
    let param3 = 'uui';

    CtiPhone.onMessage(
        "SingleStepTransferCall",
        "0",
        param1.concat(PARAM_US, dn, PARAM_RS, param2, PARAM_US, iId, PARAM_RS, param3, PARAM_US, uui)
    );
}

function sendDTMF(iId, dtmf) {

    let param1 = 'id';
    let param2 = 'dtmf';

    CtiPhone.onMessage(
        "SendDtmf",
        "0",
        param1.concat(PARAM_US, iId, PARAM_RS, param2, PARAM_US, dtmf)
    );
}

function mute(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "Mute",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function unmute(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "Unmute",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function reconnectCall(iId) {

    let param = 'id';

    CtiPhone.onMessage(
        "ReconnectCall",
        "0",
        param.concat(PARAM_US, iId)
    );
}

function getCallList() {

    const callList = wsfe.interactions;
    return callList;

}

function getCallInfo(iId) {

    const callList = getCallList();

    for (var i = 0; i < callList.length; i++) {

        if (callList[i].id == iId) {

            let callInfo = {};
            callInfo.contactId = callList[i].data.contactId; // 2023.10.16 contactId 추가
            callInfo.callType = callList[i].data.interactionType;
            callInfo.direction = callList[i].data.direction;
            callInfo.originatingAddress = callList[i].data.originatingAddress;
            callInfo.destinationAddress = callList[i].data.destinationAddress;
            const partyInfos = callList[i].data.participants.map(participant => {
                return `${participant.participantName} (${participant.participantAddress})`;
            });
            document.getElementById('partyInfo').textContent = "Party Info : " + partyInfos.join(', ');
            callInfo.participants = partyInfos;
            callInfo.userToUserInfo = callList[i].data.userToUserInfo;

            let capabilities = {}; // 2023.10.16 capabilities 추가
            if (callList[i].data.capabilities) {
                capabilities.canAccept = callList[i].data.capabilities.canAccept;
                capabilities.canConsult = callList[i].data.capabilities.canConsult;
                capabilities.canRelease = callList[i].data.capabilities.canEnd;
                capabilities.canHold = callList[i].data.capabilities.canHold;
                capabilities.canUnhold = callList[i].data.capabilities.canUnhold;
                capabilities.canSetUui = callList[i].data.capabilities.canSetUui;
                capabilities.canSetDispositionCode = callList[i].data.capabilities.canSetDispositionCode;
                capabilities.canSingleStepTransfer = callList[i].data.capabilities.canSingleStepTransfer;
                capabilities.canConferenceComplete = callList[i].data.capabilities.canConferenceComplete;
                capabilities.canTransferComplete = callList[i].data.capabilities.canTransferComplete;

                callInfo.capabilities = capabilities;

            }
            return callInfo;
        }
    }
}

// -------------------------------------------------------------------------------------

function onSessionopened(authUser) {

    // console.log("onSessionopened : ", authUser);

    const sessionopenedEvent = new CustomEvent('sessionopenedEvent', {

        detail: {
            userId: '',
            name: '',
            role: ''
        }

    });

    // console.log("authUser : ", authUser);
    sessionopenedEvent.detail.userId = authUser.defaultUserProfileId;    // 현재는 defaultId만 받도록 구현
    sessionopenedEvent.detail.name = authUser.user.displayName;
    sessionopenedEvent.detail.role = authUser.user.roleId;
    document.dispatchEvent(sessionopenedEvent);

}

// socket closed event 23.11.30
function onSocketClosed(msg) {

    // console.log("socket closed : ", msg);
    const socketClosedEvent = new CustomEvent('socketClosedEvent', {
        detail: {
            msg: ''
        }
    });

    socketClosedEvent.detail.msg = msg;
    document.dispatchEvent(socketClosedEvent);
}

function onAgentActivatedState(agent) {

    // console.log("onAgentActivatedState : ", agent);

    const agentActivatedEvent = new CustomEvent('agentActivatedEvent', {

        detail: {
            id: '',
            name: '',
            role: '',
            status: ''
        }

    });

    agentActivatedEvent.detail.id = agent.id;
    agentActivatedEvent.detail.name = agent.displayName;
    agentActivatedEvent.detail.role = agent.role;
    agentActivatedEvent.detail.status = 'active';

    document.dispatchEvent(agentActivatedEvent);

}

function onChangeAgentState(agent) {

    if(agent.currentState != "NOT_READY" && agent.currentState != agent.previousState) {
        const agentStatusChangedEvent = new CustomEvent('agentStatusChangedEvent', {

            detail: {
                status: '',
                reasonCode: ''
            }

        });

        agentStatusChangedEvent.detail.status = agent.currentState;
        if (agent.reasonCode)
            agentStatusChangedEvent.detail.reasonCode = agent.reasonCode;
        else
            agentStatusChangedEvent.detail.reasonCode = null;

        // agent capabilities 추가 2023.10.16

        if (agent.capabilities) {
            let capabilities = {};
            capabilities.canDeactivate = agent.capabilities.canDeactivate;
            capabilities.canLogin = agent.capabilities.canLogin;
            capabilities.canLogout = agent.capabilities.canLogout;
            capabilities.canSetReady = agent.capabilities.canSetReady;
            capabilities.canSetNotReady = agent.capabilities.canSetNotReady;
            agentStatusChangedEvent.detail.capabilities = capabilities;
        }

        // 23.10.21
        if (agentStatusChangedEvent.detail.status !== undefined) {
            document.dispatchEvent(agentStatusChangedEvent);
        }
    }
}

function onCallCreated(call) {

    // console.log("onCallCreated : ", call);


    const callCreatedEvent = new CustomEvent('callCreatedEvent', {

        detail: {
            id: '',
            contactId: ''
        }

    });

    callCreatedEvent.detail.id = call.id;
    callCreatedEvent.detail.contactId = call.contactId; // 2023.10.16 contactId 추가
    document.dispatchEvent(callCreatedEvent);

}

function onCallReleased(callInfo) {

    // console.log("onCallReleased : ", callInfo);

    const callReleasedEvent = new CustomEvent('callReleasedEvent', {

        detail: {
            id: ''
        }

    });

    callReleasedEvent.detail.id = callInfo.id;
    document.dispatchEvent(callReleasedEvent);
}



// 2023.10.16 callInfo 객체 값 비교 로직(테스트용)
/*
function deepDiff(a, b) {
    if (a === b) return undefined; // 두 객체가 같으면 차이 없음

    if (typeof a !== 'object' || typeof b !== 'object') return { before: a, after: b }; // 데이터 타입이 다르면 차이 반환

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = Array.from(new Set([...keysA, ...keysB]));

    const differences = {};

    for (const key of allKeys) {
      if (!deepEqual(a[key], b[key])) {
        differences[key] = deepDiff(a[key], b[key]);
      }
    }

    return differences;
  }

  function deepEqual(a, b) {
    if (a === b) return true;

    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
  */

// let list = [];

function onChangeCallState(callInfo, state) {

    // 2023.10.16 callInfo 비교 내용
    /*
    if (callInfo.state === "ACTIVE") {
        list.push(callInfo);
        console.log("리스트 : ", list);
    }
    if (list.length > 1) {
        let differences = deepDiff(list[0], list[1]);
        console.log(differences);
    }
    */

    const callStatusEvent = new CustomEvent('callStatusEvent', {

        detail: {
            id: '',
            state: ''
        }

    });

    callStatusEvent.detail.id = callInfo.id;
    callStatusEvent.detail.state = state;
    document.dispatchEvent(callStatusEvent);
}

function onEncounterErrorEvent(code, reason) {

    // console.log("onEncounterErrorEvent : ", reason);

    const errorEvent = new CustomEvent('errorEvent', {

        detail: {
            code: '',
            reason: ''
        }

    });

    errorEvent.detail.code = code;
    errorEvent.detail.reason = reason;
    document.dispatchEvent(errorEvent);

}


// -------------------------------------------------------------------------------------

/**
 * Page onunload 이벤트.
 */
function pageUnload() {
    //
    //    if (!DEBUG_MODE)
    //        wsfe.close();
}

if (window.CtiProxy === undefined) {
    // CtiProxy가 정의되지 않음, 웹브라우져에서 직접 시도한 경우.
    var CtiProxy = {};
    CtiProxy.sendMessage = (name, sessionId, parameters) => {
        // console.log("sendMessage", name, sessionId, parameters);
    };
}


const wsfe = new WSFE();

// Start session
SSOToken && wsfe.start();