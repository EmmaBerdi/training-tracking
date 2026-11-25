package com.training.tracking.repository;

import com.training.tracking.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.createdAt < :cutoff")
    int deleteAllCreatedBefore(@Param("cutoff") Instant cutoff);
}
