package com.exam.secureexam.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe brute force mitigation tracking consecutive failed authentication attempts.
 * Locks the client identifier (IP / email) temporarily once the threshold is exceeded.
 */
@Component
public class LoginRateLimiter {

    @Value("${app.security.rate-limit.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.rate-limit.lockout-minutes:15}")
    private int lockoutMinutes;

    private static class AttemptRecord {
        int count;
        LocalDateTime lockedUntil;

        AttemptRecord(int count) {
            this.count = count;
        }
    }

    private final Map<String, AttemptRecord> attemptsCache = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        if (key == null) return false;
        AttemptRecord record = attemptsCache.get(key.toLowerCase().trim());
        if (record == null) return false;

        if (record.lockedUntil != null) {
            if (LocalDateTime.now().isBefore(record.lockedUntil)) {
                return true;
            } else {
                // Lockout period has elapsed; reset record
                attemptsCache.remove(key.toLowerCase().trim());
                return false;
            }
        }
        return false;
    }

    public void recordFailedAttempt(String key) {
        if (key == null) return;
        String normalizedKey = key.toLowerCase().trim();
        LocalDateTime now = LocalDateTime.now();

        attemptsCache.compute(normalizedKey, (k, existing) -> {
            if (existing == null) {
                return new AttemptRecord(1);
            }
            existing.count += 1;
            if (existing.count >= maxAttempts) {
                existing.lockedUntil = now.plusMinutes(lockoutMinutes);
            }
            return existing;
        });
    }

    public void recordSuccessfulAttempt(String key) {
        if (key == null) return;
        attemptsCache.remove(key.toLowerCase().trim());
    }

    public int getRemainingAttempts(String key) {
        if (key == null) return maxAttempts;
        AttemptRecord record = attemptsCache.get(key.toLowerCase().trim());
        if (record == null) return maxAttempts;
        return Math.max(0, maxAttempts - record.count);
    }
}
