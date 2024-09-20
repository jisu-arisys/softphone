package com.arisys.authSample;

import com.avaya.collaboration.authorization.AccessToken;
import com.avaya.collaboration.authorization.AuthorizationClientHelper;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpServletRequest;
import java.io.FileInputStream;
import java.security.KeyStore;

@Service
public class AuthorizationClientHelperService {

    @Autowired
    KeyStoreService keyStoreService;

    @Autowired
    private Environment env;

    private AuthorizationClientHelper clientHelper;

    @PostConstruct
    public void initAuthHelper() {

        try {
            String keyStorePath = env.getProperty("clientKeystorePath");
            String keyStorePassword = env.getProperty("clientKeystorePassword");
            String trustStorePath = env.getProperty("clientTruststorePath");
            String trustStorePassword = env.getProperty("clientTruststorePassword");
            String tokenEndpointURL = env.getProperty("tokenEndpointURL");
            String clientId = env.getProperty("clientId");
            String clientCertificateAlias = env.getProperty("clientCertificateAlias");

            // Initialize keystores
            KeyStore clientKeyStore = KeyStore.getInstance("JKS");
            clientKeyStore.load(new FileInputStream(keyStorePath), keyStorePassword.toCharArray());

            KeyStore clientTrustStore = KeyStore.getInstance("JKS");
            clientTrustStore.load(new FileInputStream(trustStorePath), trustStorePassword.toCharArray());

            // Initialize the helper
            clientHelper = new AuthorizationClientHelper.Builder()
                    .tokenEndpoint(tokenEndpointURL)
                    .clientIdentifier(clientId)
                    .keyStore(clientKeyStore, keyStorePassword, clientCertificateAlias)
                    .trustStore(clientTrustStore)
                    .build();
        }
        catch (Exception e) {
            System.out.println("Exception : " + e);
        }
    }

    public AccessToken getAccessToken(HttpServletRequest servletRequest) {
        try {
            return clientHelper.getAccessTokenForUser(servletRequest);
        }
        catch (Exception e) {
            System.out.println("Exception : " + e);
            return null;
        }
    }

    public AccessToken getAccessToken(String userName, String userPassword) {
        try {
            return clientHelper.getAccessTokenForUser(userName, userPassword);
        }
        catch (Exception e) {
            System.out.println("Exception : " + e);
            return null;
        }
    }
}
