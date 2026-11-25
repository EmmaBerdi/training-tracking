package com.training.tracking.repository;

import com.training.tracking.domain.EmailChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface EmailChangeRequestRepository extends JpaRepository<EmailChangeRequest, Long> {
    Optional<EmailChangeRequest> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);
}
