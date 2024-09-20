import {Softphone} from './Softphone.js';

const softphone = new Softphone("https://testws.arisys.co.kr");
softphone.initialize();


/*
* agent  control
* */

document.getElementById('agent-activate').addEventListener('click', () => {
    let extension = document.getElementById('extension').value;
    softphone.activate(extension)
        .then((result) => {
            // if (result == 1)
                // console.log("activate 요청 성공");
        });
});


document.getElementById('agent-deactivate').addEventListener('click', () => {
    softphone.deactivate()
        .then((result) => {
            // if (result == 1)
                // console.log("deactivate 요청 성공");
        });
    deleteCookie('ArisysSoftphoneSession');
    window.location.reload();
});

document.getElementById('agent-login').addEventListener('click', () => {
    softphone.login().then((result) => {
        // if (result == 1)
            // console.log("login 요청 성공");
    });
});

document.getElementById('agent-logout').addEventListener('click', () => {
    softphone.logout().then((result) => {
        // if (result == 1)
            // console.log("logout 요청 성공");
    });
});

document.getElementById('agent-goready').addEventListener('click', () => {
    softphone.goReady().then((result) => {
        // if (result == 1)
            // console.log("ready 요청 성공");
    })
});

document.getElementById('agent-gonotready').addEventListener('click', () => {
    const reason = document.getElementById('notready-reason').value;
    softphone.goNotReady(reason).then((result) => {
        // if (result == 1)
            // console.log("not ready 요청 성공");
    })
});

document.getElementById('agent-goACW').addEventListener('click', () => {
    softphone.goAfterContactWork().then((result) => {
        // if (result == 1)
            // console.log("ACW 요청 성공");
    })
});


/*
* call  control
* */

document.getElementById('make-call').addEventListener('click', () => {
    let destinationAddress = document.getElementById('dn').value;
    softphone.makeCall(destinationAddress).then((result) => {
    });
});

document.getElementById('accept').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.acceptCall(callId).then((result) => {
    });
});

document.getElementById('hold').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.holdCall(callId).then((result) => {
    });;
});

document.getElementById('unhold').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.unholdCall(callId).then((result) => {
    });
});

document.getElementById('blindTransfer').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    const remoteAddress = document.getElementById('remoteAddr').value;
    const uui = document.getElementById('uui').value;
    softphone.makeSingleStepTransferCall(remoteAddress, callId).then((result) => {
    });
});

document.getElementById('transfer').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    const remoteAddress = document.getElementById('remoteAddr').value;
    const uui = document.getElementById('uui').value;
    softphone.makeTwoStepTransferCall(remoteAddress, uui, callId).then((result) => {
    });
});

document.getElementById('conference').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    const remoteAddress = document.getElementById('remoteAddr').value;
    const uui = document.getElementById('uui').value;
    // console.log("정보 : ", remoteAddress);
    softphone.makeConferenceCall(remoteAddress, uui, callId).then((result) => {
    });
});

document.getElementById('completeTransfer').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.completeTransferCall(callId).then((result) => {
    });;
});

document.getElementById('completeConference').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.completeConferenceCall(callId).then((result) => {
    });
});

document.getElementById('release').addEventListener('click', () => {
    let callId = document.getElementById('callId').value;
    softphone.releaseCall(callId);
});

document.getElementById('getCalls').addEventListener('click', () => {
    softphone.getCalls();
});


//------------------- 이벤트 리스너
document.addEventListener('sessionOpenedEvent', (event) => {
    // console.log('Session opened : ', event);
    document.getElementById('defaultProfileId').textContent = "Profile Id : " + event.detail.defaultProfileId;
    document.getElementById('userName').textContent = "User Name : " + event.detail.defaultUserName;
    document.getElementById('userRole').textContent = "User Role : " + event.detail.role;
    document.getElementById('defaultExtension').textContent = "Default Extension : " + event.detail.defaultExtension;
    document.getElementById('sessionId').textContent = "Session Id : " + event.detail.sessionId;
});

document.addEventListener('sessionClosedEvent', (event) => {
    // console.log("Session Closed : ", event.detail.sessionId);
});

document.addEventListener('connectionClosedEvent', (event) => {
    // console.log("Connection Closed : ", event.detail);
});

document.addEventListener('errorEvent', (event) => {
    // console.log("error occured : ", event.detail);
});

//----- 상담원 이벤트 리스너

document.addEventListener('agentActivatedEvent', (event) => {
    // console.log('agentActivatedEvent : ', event.detail);

    let activatedExtension = softphone.getActivatedExtension();
    document.getElementById('agentId').textContent = "Agent Id : " + event.detail.id;
    document.getElementById('agentName').textContent = "Agent Name : " + event.detail.name;
    document.getElementById('agentRole').textContent = "Agent Role : " + event.detail.role;
    document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    document.getElementById('agentExtension').textContent = "Extension : " + activatedExtension;

});

document.addEventListener('agentLoggedInEvent', (event) => {
    // console.log('agentLoggedInEvent : ', event.detail);
    setAgentUI(event.detail.capabilities);
    if (!event.detail.reasonCode)
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    else
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status + "(" + event.detail.reasonCode + ")";
});

document.addEventListener('agentLoggedOutEvent', (event) => {
    // console.log('agentLoggedOutEvent : ', event.detail);
    setAgentUI(event.detail.capabilities);
    if (!event.detail.reasonCode)
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    else
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status + "(" + event.detail.reasonCode + ")";
});

document.addEventListener('agentReadyEvent', (event) => {
    // console.log('agentReadyEvent : ', event.detail);
    setAgentUI(event.detail.capabilities);
    if (!event.detail.reasonCode)
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    else
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status + "(" + event.detail.reasonCode + ")";
});

document.addEventListener('agentNotReadyEvent', (event) => {
    // console.log('agentNotReadyEvent : ', event.detail);
    setAgentUI(event.detail.capabilities);
    if (!event.detail.reasonCode)
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    else
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status + "(" + event.detail.reasonCode + ")";
});

document.addEventListener('agentAfterContactWorkEvent', (event) => {
    console.log('agentAfterContactWorkEvent : ', event.detail);
    setAgentUI(event.detail.capabilities);
    if (!event.detail.reasonCode)
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status;
    else
        document.getElementById('agentStatus').textContent = "Agent Status : " + event.detail.status + "(" + event.detail.reasonCode + ")";
});


//---- 콜 이벤트 리스너
document.addEventListener('callCreatedEvent', (event) => {
    console.log('callCreatedEvent : ', event.detail);
    storeCallIds(event.detail.id);
    setCallIds(callIds);
    let callInfo = softphone.getCallInfo(event.detail.id);
    setCallUI(callInfo.capabilities);
});

document.addEventListener('callHeldEvent', (event) => {
    console.log('callHeldEvent : ', event.detail);
    storeCallIds(event.detail.id);
    setCallIds(callIds);
    let callInfo = softphone.getCallInfo(event.detail.id);
    setCallUI(callInfo.capabilities);
});

document.addEventListener('callUnheldEvent', (event) => {
    console.log('callUnheldEvent : ', event.detail);
    storeCallIds(event.detail.id);
    setCallIds(callIds);
    let callInfo = softphone.getCallInfo(event.detail.id);
    setCallUI(callInfo.capabilities);
});

document.addEventListener('remoteParticapantAcceptedEvent', (event) => {
    console.log('remoteParticapantAcceptedEvent : ', event.detail);
    storeCallIds(event.detail.id);
    setCallIds(callIds);

    let callInfo = softphone.getCallInfo(event.detail.id);
    setCallUI(callInfo.capabilities);
});
4
document.addEventListener('callEndedEvent', (event) => {
    console.log('callEndedEvent : ', event.detail);
    deleteCallId(event.detail.id);
    setCallIds(callIds);
    let callInfo = softphone.getCallInfo(event.detail.id);
    setCallUI(callInfo.capabilities);
});


document.addEventListener('agentRequestFailedEvent', (event) => {
    console.log('agentRequestFailedEvent : ', event.detail);
});

document.addEventListener('callRequestFailedEvent', (event) => {
    console.log('callRequestFailedEvent : ', event.detail);
})


//------------------ 이벤트 리스너


let callIds = [];

// 현재 생성된 call들의 id 정보를 배열에 보관한다.
function storeCallIds(callId) {
    callIds.push(callId);
}

// call id들을 selectbox에 표시한다.
function setCallIds(list) {
    let selectElement = document.getElementById('callId');
    while (selectElement.firstChild) {
        selectElement.removeChild(selectElement.firstChild);
    }
    for (var i = 0; i < list.length; i++) {
        let iOption = document.createElement('option');
        iOption.value = list[i];
        iOption.textContent = list[i];
        selectElement.append(iOption);
    }

    if (list.length != 0) {

        selectElement.selectedIndex = list.length - 1;

        const selectedOption = selectElement.options[selectElement.selectedIndex];
        selectedOption.selected = true;
        const selectedCallId = selectedOption.value;

        let callInfo = softphone.getCallInfo(selectedCallId);
        console.log("callinfo : ", callInfo);
        document.getElementById('callIdInfo').textContent = "Call ID : " + selectedCallId;
        document.getElementById('contactIdInfo').textContent = "Call ID : " + callInfo.contactId;
        document.getElementById('callTypeInfo').textContent = "Call Type : " + callInfo.callType;
        document.getElementById('callStateInfo').textContent = "Call State : ";
        document.getElementById('directionInfo').textContent = "Direction : " + callInfo.direction;
        document.getElementById('partyInfo').textContent = "Party Info : " + callInfo.participants;
        document.getElementById('uuiInfo').textContent = "UUI : " + callInfo.userToUserInfo;
        document.getElementById('originatedInfo').textContent = "Originated : " + callInfo.originatingAddress;
        document.getElementById('destinationInfo').textContent = "Destination : " + callInfo.destinationAddress;

        // select 박스의 선택이 바뀌었을 경우
        selectElement.addEventListener('change', function () {
            const selected = selectElement.options[selectElement.selectedIndex];
            const selectedId = selected.value;

            let callInfo = softphone.getCallInfo(selectedId);

            document.getElementById('callIdInfo').textContent = "Call ID : " + selectedId;
            document.getElementById('contactIdInfo').textContent = "UCID : " + callInfo.contactId;
            document.getElementById('contactIdInfo').textContent = "UCID : " + callInfo.contactId;
            document.getElementById('callTypeInfo').textContent = "Call Type : " + callInfo.callType;
            document.getElementById('callStateInfo').textContent = "Call State : ";
            document.getElementById('directionInfo').textContent = "Direction : " + callInfo.direction;
            document.getElementById('partyInfo').textContent = "Party Info : " + callInfo.participants;
            document.getElementById('uuiInfo').textContent = "UUI : " + callInfo.userToUserInfo;
            document.getElementById('originatedInfo').textContent = "Originated : " + callInfo.originatingAddress;
            document.getElementById('destinationInfo').textContent = "Destination : " + callInfo.destinationAddress;

        });
    } else {
        document.getElementById('callIdInfo').textContent = "Call ID : ";
        document.getElementById('contactIdInfo').textContent = "UCID : ";
        document.getElementById('callTypeInfo').textContent = "Call Type : ";
        document.getElementById('callStateInfo').textContent = "Call State : ";
        document.getElementById('originatedInfo').textContent = "Direction : ";
        document.getElementById('directionInfo').textContent = "Originated : ";
        document.getElementById('partyInfo').textContent = "Destination : ";
        document.getElementById('uuiInfo').textContent = "Party Info : ";
        document.getElementById('destinationInfo').textContent = "Party Info : ";
    }

}

function deleteCallId(callId) {
    const indexToDelete = callIds.indexOf(callId);
    callIds.splice(indexToDelete, 1);

}

// 임시
function deleteCookie(key) {
    //	document.cookie = encodeURIComponent(key) + '=; expires=-1;path=/'
    document.cookie = encodeURIComponent(key) + "=; expires=-1";
}


function setAgentUI(capabilities) {
    document.getElementById('agent-deactivate').disabled = capabilities.canDeactivate ? false : true;
    document.getElementById('agent-activate').disabled = capabilities.canDeactivate ? true : false;
    document.getElementById('agent-login').disabled = capabilities.canLogin ? false : true;
    document.getElementById('agent-logout').disabled = capabilities.canLogout ? false : true;
    document.getElementById('agent-goready').disabled = capabilities.canSetReady ? false : true;
    document.getElementById('agent-gonotready').disabled = capabilities.canSetNotReady ? false : true;
    document.getElementById('agent-goACW').disabled = capabilities.canSetAfterContactWork ? false : true;

}

function setCallUI(capabilities) {
    document.getElementById('accept').disabled = capabilities.canAccept ? false : true;
    document.getElementById('conference').disabled = capabilities.canConsult ? false : true;
    document.getElementById('transfer').disabled = capabilities.canConsult ? false : true;
    document.getElementById('end').disabled = capabilities.canEnd ? false : true;
    document.getElementById('hold').disabled = capabilities.canHold ? false : true;
    document.getElementById('uui').disabled = capabilities.canSetUui ? false : true;
    document.getElementById('blindTransfer').disabled = capabilities.canSingleStepTransfer ? false : true;
    document.getElementById('completeConference').disabled = capabilities.canConferenceComplete ? false : true;
    document.getElementById('completeTransfer').disabled = capabilities.canTransferComplete ? false : true;
}