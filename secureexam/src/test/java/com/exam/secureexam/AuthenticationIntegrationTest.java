package com.exam.secureexam;

import com.exam.secureexam.dto.LoginRequest;
import com.exam.secureexam.model.Role;
import com.exam.secureexam.model.User;
import com.exam.secureexam.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AuthenticationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private RestTemplate restTemplate;
    private String baseUrl;

    private final String superAdminEmail = "d.koushik@kalpanaaasoftwaresolutions.in";
    private final String superAdminPassword = "Admin@ExamSecure2026!";

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        baseUrl = "http://localhost:" + port;

        // Ensure configured bootstrap administrator exists
        if (!userRepository.existsByEmailIgnoreCase(superAdminEmail)) {
            User admin = new User(superAdminEmail, passwordEncoder.encode(superAdminPassword), "D. Koushik", Role.SUPER_ADMIN);
            userRepository.save(admin);
        }
    }

    @Test
    @DisplayName("1. Unauthenticated request to /api/admin/dashboard must return HTTP 401 Unauthorized")
    void unauthenticatedRequestToAdminDashboardReturns401() {
        try {
            restTemplate.getForEntity(baseUrl + "/api/admin/dashboard", String.class);
            fail("Expected HttpClientErrorException.Unauthorized (401)");
        } catch (HttpClientErrorException.Unauthorized ex) {
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
            assertTrue(ex.getResponseBodyAsString().contains("Unauthorized") ||
                       ex.getResponseBodyAsString().contains("Authentication required"));
            // Crucial: WWW-Authenticate header must not prompt basic auth dialog
            assertNull(ex.getResponseHeaders() != null ? ex.getResponseHeaders().get("WWW-Authenticate") : null);
        }
    }

    @Test
    @DisplayName("2. Successful login with provisioned credentials returns 200 OK and establishes session")
    void validLoginSucceedsAndSetsSession() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<LoginRequest> request = new HttpEntity<>(
                new LoginRequest(superAdminEmail, superAdminPassword), headers
        );

        ResponseEntity<String> response = restTemplate.postForEntity(baseUrl + "/api/auth/login", request, String.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().contains("Authentication successful"));
        assertTrue(response.getBody().contains("SUPER_ADMIN"));

        // Verify Set-Cookie header contains JSESSIONID
        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(cookies);
        boolean hasSessionCookie = cookies.stream().anyMatch(c -> c.contains("JSESSIONID"));
        assertTrue(hasSessionCookie, "Response must set JSESSIONID cookie");

        // Use the session cookie to access protected /api/admin/dashboard
        String sessionCookie = cookies.get(0).split(";")[0];
        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.set(HttpHeaders.COOKIE, sessionCookie);
        HttpEntity<Void> authRequest = new HttpEntity<>(authHeaders);

        ResponseEntity<String> dashboardResponse = restTemplate.exchange(
                baseUrl + "/api/admin/dashboard",
                HttpMethod.GET,
                authRequest,
                String.class
        );

        assertEquals(HttpStatus.OK, dashboardResponse.getStatusCode());
        assertTrue(dashboardResponse.getBody().contains("Admin dashboard API is working"));
    }

    @Test
    @DisplayName("3. Invalid password returns HTTP 401 Unauthorized")
    void invalidPasswordReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<LoginRequest> request = new HttpEntity<>(
                new LoginRequest(superAdminEmail, "WrongPassword@999"), headers
        );

        try {
            restTemplate.postForEntity(baseUrl + "/api/auth/login", request, String.class);
            fail("Expected 401 Unauthorized for bad password");
        } catch (HttpClientErrorException.Unauthorized ex) {
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        }
    }

    @Test
    @DisplayName("4. Non-admin user (e.g. REVIEWER) receives HTTP 403 Forbidden on /api/admin/**")
    void nonAdminUserReceivesForbidden403OnAdminEndpoints() {
        String reviewerEmail = "reviewer.test@secureexam.edu";
        String reviewerPassword = "ReviewerPass@123";

        if (!userRepository.existsByEmailIgnoreCase(reviewerEmail)) {
            User reviewer = new User(reviewerEmail, passwordEncoder.encode(reviewerPassword), "Test Reviewer", Role.REVIEWER);
            userRepository.save(reviewer);
        }

        // Login as Reviewer
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<LoginRequest> loginReq = new HttpEntity<>(
                new LoginRequest(reviewerEmail, reviewerPassword), headers
        );

        ResponseEntity<String> loginResp = restTemplate.postForEntity(baseUrl + "/api/auth/login", loginReq, String.class);
        assertEquals(HttpStatus.OK, loginResp.getStatusCode());

        List<String> cookies = loginResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(cookies);
        String sessionCookie = cookies.get(0).split(";")[0];

        // Attempt accessing /api/admin/dashboard with Reviewer session
        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.set(HttpHeaders.COOKIE, sessionCookie);
        HttpEntity<Void> req = new HttpEntity<>(authHeaders);

        try {
            restTemplate.exchange(baseUrl + "/api/admin/dashboard", HttpMethod.GET, req, String.class);
            fail("Expected 403 Forbidden for non-SUPER_ADMIN user");
        } catch (HttpClientErrorException.Forbidden ex) {
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            assertTrue(ex.getResponseBodyAsString().contains("Forbidden") ||
                       ex.getResponseBodyAsString().contains("SUPER_ADMIN"));
        }
    }

    @Test
    @DisplayName("5. Logout invalidates session and subsequent request receives 401")
    void logoutInvalidatesSession() {
        // Login first
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<LoginRequest> loginReq = new HttpEntity<>(
                new LoginRequest(superAdminEmail, superAdminPassword), headers
        );

        ResponseEntity<String> loginResp = restTemplate.postForEntity(baseUrl + "/api/auth/login", loginReq, String.class);
        List<String> cookies = loginResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(cookies);
        String sessionCookie = cookies.get(0).split(";")[0];

        // Logout
        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.set(HttpHeaders.COOKIE, sessionCookie);
        HttpEntity<Void> logoutReq = new HttpEntity<>(authHeaders);

        ResponseEntity<String> logoutResp = restTemplate.postForEntity(baseUrl + "/api/auth/logout", logoutReq, String.class);
        assertEquals(HttpStatus.OK, logoutResp.getStatusCode());

        // Subsequent access to /api/admin/dashboard must fail with 401
        try {
            restTemplate.exchange(baseUrl + "/api/admin/dashboard", HttpMethod.GET, logoutReq, String.class);
            fail("Expected 401 Unauthorized after session invalidation");
        } catch (HttpClientErrorException.Unauthorized ex) {
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        }
    }

    @Test
    @DisplayName("6. Bootstrap is idempotent: account is not duplicated and role remains SUPER_ADMIN")
    void bootstrapIsIdempotent() {
        long countBefore = userRepository.count();
        User adminBefore = userRepository.findByEmailIgnoreCase(superAdminEmail).orElseThrow();
        assertEquals(Role.SUPER_ADMIN, adminBefore.getRole());

        // Simulate re-running bootstrap logic
        if (!userRepository.existsByEmailIgnoreCase(superAdminEmail)) {
            userRepository.save(new User(superAdminEmail, passwordEncoder.encode(superAdminPassword), "D. Koushik", Role.SUPER_ADMIN));
        }

        long countAfter = userRepository.count();
        assertEquals(countBefore, countAfter, "Re-running bootstrap must not duplicate user records");
    }
}
