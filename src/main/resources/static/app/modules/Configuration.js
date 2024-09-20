"use strict";

const CLIENT_ID = "SampleSoftphone";

export class Configuration {
    constructor(hostAddress) {
        this.config = {
            uacConfiguration: new AvayaCustomerServices.Config.UACConfiguration({
                enabled: true,
                clientInfo: { id: CLIENT_ID },
                serverInfo: { apiUrl: hostAddress + "/services/UnifiedAgentController/UACAPI" },
                notificationInfo: { broadcastUrl: hostAddress + "/services/Broadcast-UnifiedAgentController/broadcast"},
                fallbackTransport: 'websocket',
                authenticationInfo: {
                    enabled: true,
                    tokens: ["Authorization"],
                },
            }),
        };
    }
    getConfig() {
        return this.config;
    }
}