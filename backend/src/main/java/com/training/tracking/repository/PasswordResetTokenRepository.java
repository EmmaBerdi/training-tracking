package com.training.tracking.repository;

import com.training.tracking.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);
}
