package com.arisys.authSample;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.security.KeyStore;

@Service
public class KeyStoreService {

    @Autowired
    private Environment env;

    public KeyStore initKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("JKS");
        keyStore.load(new FileInputStream(env.getProperty("clientKeystorePath")),
                env.getProperty("clientKeystorePassword").toCharArray());
        return keyStore;
    }

    public KeyStore initTrustStore() throws Exception {
        KeyStore trustStore = KeyStore.getInstance("JKS");
        trustStore.load(new FileInputStream(env.getProperty("clientTruststorePath")),
                env.getProperty("clientTruststorePassword").toCharArray());
        return trustStore;
    }
}
