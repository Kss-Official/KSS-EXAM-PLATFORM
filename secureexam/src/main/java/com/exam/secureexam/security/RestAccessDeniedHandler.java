package com.exam.secureexam.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Returns HTTP 403 Forbidden with clean JSON payload when an authenticated user lacks required roles.
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        String json = String.format(
                "{\"status\":%d,\"error\":\"Forbidden\",\"message\":\"Access denied. Insufficient administrative privileges (SUPER_ADMIN required).\",\"path\":\"%s\",\"timestamp\":\"%s\"}",
                HttpServletResponse.SC_FORBIDDEN,
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
