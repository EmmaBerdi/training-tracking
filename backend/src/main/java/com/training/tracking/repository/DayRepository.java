package com.training.tracking.repository;

import com.training.tracking.domain.Day;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DayRepository extends JpaRepository<Day, Long> {
    List<Day> findAllByUserIdOrderByPosition(Long userId);

    Optional<Day> findByUserIdAndDayKey(Long userId, String dayKey);

    long countBySessionTypeId(Long sessionTypeId);
}
