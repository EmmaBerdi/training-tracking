package com.training.tracking.repository;

import com.training.tracking.domain.IntervalTimer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface IntervalTimerRepository extends JpaRepository<IntervalTimer, Long> {
    List<IntervalTimer> findAllByUserIdOrderById(Long userId);

    Optional<IntervalTimer> findByIdAndUserId(Long id, Long userId);

    @Query("SELECT t.id FROM IntervalTimer t WHERE t.userId = :userId AND t.id IN :ids")
    List<Long> findOwnedIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);
}
