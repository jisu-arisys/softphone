package com.arisys.authSample;

import com.arisys.authSample.types.CurrentUser;
import com.arisys.authSample.types.UserSession;
import com.avaya.collaboration.authorization.AccessToken;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.util.Calendar;
import java.util.Date;

@Controller
@RequestMapping("/")
public class AuthController {

    @Autowired
    AuthorizationClientHelperService authHelperService;

    @Autowired
    private Environment env;

    @GetMapping("/home")
    public String login() {
        return "login.html";
    }

    @PostMapping("/auth")
    public String getOAuth2Token(HttpServletRequest request, HttpServletResponse response) {
        try {
            String username = request.getParameter("username");
            String password = request.getParameter("password");

            AccessToken accessToken = authHelperService.getAccessToken(username, password);


            // 쿠키, 세션 생성
            if (accessToken != null)
            {
                final String userSession = buildUserSession(accessToken);
                Cookie cookie = setCookie(userSession, accessToken.getExpiresIn());
                response.addCookie(cookie);
                return "redirect:/";
            }
            else
                return "login.html";
        }
            catch (Exception e) {
                e.printStackTrace();
                return "login.html";
            }
        }

    // userSession 생성
    private String buildUserSession(final AccessToken accessToken) throws JsonProcessingException
    {
        final CurrentUser currentUser = new CurrentUser();
        currentUser.setUsername(accessToken.getSubject());
        currentUser.setAuthdata(accessToken.toString());
        currentUser.setExpiry(getExpiryTime(accessToken.getExpiresIn()));

        final UserSession userSession = new UserSession();
        userSession.setCurrentUser(currentUser);

        return new ObjectMapper().writeValueAsString(userSession);
    }

    private String getExpiryTime(final int expiryInSeconds)
    {
        final Calendar cal = Calendar.getInstance();
        cal.setTime(new Date());
        cal.add(Calendar.SECOND, expiryInSeconds);
        return String.valueOf(cal.getTimeInMillis());
    }

    // 쿠키 값 세팅
    private Cookie setCookie(final String userSession, final int cookieExpiry)
            throws IOException
    {
        // JSON 문자열을 URL 인코딩합니다.
        String encodedSession = URLEncoder.encode(userSession, "UTF-8");
        final Cookie sessionCookie = new Cookie(env.getProperty("sessionCookieName"), encodedSession);
        sessionCookie.setMaxAge(cookieExpiry);
        return sessionCookie;
    }


}
