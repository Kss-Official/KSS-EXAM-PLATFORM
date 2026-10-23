package com.exam.secureexam.controller;

import com.exam.secureexam.dto.AuthResponse;
import com.exam.secureexam.dto.LoginRequest;
import com.exam.secureexam.dto.UserDto;
import com.exam.secureexam.model.User;
import com.exam.secureexam.repository.UserRepository;
import com.exam.secureexam.security.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final LoginRateLimiter rateLimiter;

    public AuthController(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            LoginRateLimiter rateLimiter) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        String rateLimitKey = request.getEmail() + "@" + clientIp;

        if (rateLimiter.isBlocked(rateLimitKey) || rateLimiter.isBlocked(clientIp)) {
            logger.warn("[Auth] Rate limit exceeded for identifier: {} from IP: {}", request.getEmail(), clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(AuthResponse.failure("Too many failed login attempts. Account temporarily locked for 15 minutes to prevent brute-force attacks."));
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            // Establish secure server-side session
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);

            HttpSession session = httpRequest.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

            rateLimiter.recordSuccessfulAttempt(rateLimitKey);
            rateLimiter.recordSuccessfulAttempt(clientIp);

            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(request.getEmail());
            UserDto userDto = userOpt.map(UserDto::fromEntity).orElse(null);

            logger.info("[Auth] Administrator successfully authenticated: '{}' from IP: {}", request.getEmail(), clientIp);

            return ResponseEntity.ok(AuthResponse.ok("Authentication successful", userDto));

        } catch (BadCredentialsException e) {
            rateLimiter.recordFailedAttempt(rateLimitKey);
            rateLimiter.recordFailedAttempt(clientIp);
            int remaining = rateLimiter.getRemainingAttempts(rateLimitKey);

            logger.warn("[Auth] Failed authentication attempt for '{}' from IP: {} (Remaining attempts before temporary lockout: {})",
                    request.getEmail(), clientIp, remaining);

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(AuthResponse.failure("Invalid email or password. Remaining attempts: " + remaining));

        } catch (DisabledException e) {
            logger.warn("[Auth] Login rejected: account '{}' is disabled.", request.getEmail());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(AuthResponse.failure("This administrator account has been disabled. Contact system support."));

        } catch (LockedException e) {
            logger.warn("[Auth] Login rejected: account '{}' is locked.", request.getEmail());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(AuthResponse.failure("This account is currently locked. Contact system support."));

        } catch (Exception e) {
            logger.error("[Auth] Unexpected authentication error for '{}': {}", request.getEmail(), e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(AuthResponse.failure("An error occurred during authentication. Please try again."));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(AuthResponse.failure("No active session found. Please sign in."));
        }

        String email = auth.getName();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(AuthResponse.failure("User record not found."));
        }

        return ResponseEntity.ok(UserDto.fromEntity(userOpt.get()));
    }

    @PostMapping("/logout")
    public ResponseEntity<AuthResponse> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        return ResponseEntity.ok(AuthResponse.ok("Signed out successfully", null));
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isEmpty()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
