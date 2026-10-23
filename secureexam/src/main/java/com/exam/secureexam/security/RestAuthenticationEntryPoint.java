package com.exam.secureexam.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Returns HTTP 401 Unauthorized with clean JSON payload.
 * Crucially omits the WWW-Authenticate header so browsers never display the native modal prompt.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

        String json = String.format(
                "{\"status\":%d,\"error\":\"Unauthorized\",\"message\":\"Authentication required. Please sign in to access the administrator console.\",\"path\":\"%s\",\"timestamp\":\"%s\"}",
                HttpServletResponse.SC_UNAUTHORIZED,
                escapeJson(request.getRequestURI()),
                Instant.now().toString()
        );

        response.getWriter().write(json);
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\"", "\\\"");
    }
}
