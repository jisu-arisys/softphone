package com.arisys.authSample;

import com.avaya.collaboration.authorization.AccessToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test; // junit5
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = AuthController.class) // MockitoExtension 추가
public class AuthControllerTest {

    @Autowired
    private MockMvc mvc;
    @MockBean
    AuthorizationClientHelperService authHelperService;


    @BeforeEach
    public void setup() {
        // mock 초기화
        MockitoAnnotations.openMocks(this);
    };

    @Test
    public void return_login() throws Exception {

        String login = "login.html";

        mvc.perform(get("/home"))
                .andExpect(status().isOk())
                .andExpect(view().name(login));

    }

    @Test
    public void return_accessToken() throws Exception {

        // given
        String username = "test02@arisys.co.kr";
        String password = "Arisys123$";
        String sessionCookieName = "ArisysSoftphoneSession";

        // Mocking the behavior of authHelperService
        AccessToken mockAccessToken = mock(AccessToken.class); // Create a mock AccessToken
        when(mockAccessToken.getExpiresIn()).thenReturn(3600); // Set mock expiration time
        when(authHelperService.getAccessToken(username, password)).thenReturn(mockAccessToken);

        mvc.perform(post("/auth")
                        .param("username", username)
                        .param("password", password)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(status().isOk())
                .andExpect(view().name("index.html"))
                .andExpect(cookie().exists(sessionCookieName)) // Replace with your actual cookie name
                .andDo(result -> {
                    // Output the cookie value for debugging
                    if (result.getResponse().getCookies() != null) {
                        for (javax.servlet.http.Cookie cookie : result.getResponse().getCookies()) {
                            System.out.println("Cookie Name: " + cookie.getName());
                            System.out.println("Cookie Value: " + cookie.getValue());
                        }
                    }
                });


    }

}
