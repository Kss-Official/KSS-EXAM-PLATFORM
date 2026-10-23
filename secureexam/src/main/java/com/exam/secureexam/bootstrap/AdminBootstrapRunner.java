package com.exam.secureexam.bootstrap;

import com.exam.secureexam.model.Role;
import com.exam.secureexam.model.User;
import com.exam.secureexam.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Idempotent Administrator Bootstrap Runner.
 * Provisions the single authorized SUPER_ADMIN account using environment-supplied credentials.
 * Never logs or exposes passwords or password hashes.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.security.bootstrap.enabled:true}")
    private boolean bootstrapEnabled;

    @Value("${app.security.bootstrap.email:d.koushik@kalpanaaasoftwaresolutions.in}")
    private String bootstrapEmail;

    @Value("${app.security.bootstrap.password:}")
    private String bootstrapPassword;

    @Value("${app.security.bootstrap.full-name:D. Koushik}")
    private String bootstrapFullName;

    public AdminBootstrapRunner(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!bootstrapEnabled) {
            logger.info("[Bootstrap] Initial administrator provisioning is disabled by configuration (app.security.bootstrap.enabled=false).");
            return;
        }

        if (bootstrapEmail == null || bootstrapEmail.trim().isEmpty()) {
            logger.error("[Bootstrap] Missing bootstrap email configuration. Bootstrap aborted.");
            return;
        }

        String normalizedEmail = bootstrapEmail.toLowerCase().trim();

        Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (existingUserOpt.isPresent()) {
            User existing = existingUserOpt.get();
            // Validate existing state without overwriting password or re-inserting
            if (existing.getRole() != Role.SUPER_ADMIN) {
                logger.warn("[Bootstrap] Account exists for email '{}', but its role is '{}'. Will not silently promote.",
                        normalizedEmail, existing.getRole());
            } else if (!existing.isEnabled() || !existing.isAccountNonLocked()) {
                logger.warn("[Bootstrap] Administrator account '{}' exists but is currently disabled or locked.", normalizedEmail);
            } else {
                logger.info("[Bootstrap] Authorized Super Administrator '{}' is verified and active (idempotent skip).", normalizedEmail);
            }
            return;
        }

        // New provisioning requires a non-empty password
        if (bootstrapPassword == null || bootstrapPassword.trim().isEmpty()) {
            logger.error("[Bootstrap] Cannot provision initial administrator: ADMIN_BOOTSTRAP_PASSWORD environment variable is empty. " +
                    "Set ADMIN_BOOTSTRAP_PASSWORD to provision the account safely.");
            return;
        }

        if (bootstrapPassword.length() < 8) {
            logger.error("[Bootstrap] Bootstrap password fails minimum length requirement (min 8 characters). Provisioning aborted.");
            return;
        }

        try {
            String encodedHash = passwordEncoder.encode(bootstrapPassword.trim());
            User superAdmin = new User(normalizedEmail, encodedHash, bootstrapFullName.trim(), Role.SUPER_ADMIN);
            superAdmin.setEnabled(true);
            superAdmin.setAccountNonLocked(true);

            userRepository.save(superAdmin);
            logger.info("[Bootstrap] Initial Super Administrator account successfully provisioned for '{}' with role SUPER_ADMIN.",
                    normalizedEmail);
        } catch (Exception e) {
            logger.error("[Bootstrap] Failed to provision administrator account safely: {}", e.getMessage());
        }
    }
}
