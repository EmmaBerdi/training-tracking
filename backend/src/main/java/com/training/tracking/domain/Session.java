package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(name = "session",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "session_date", "day_key"}))
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    /**
     * Client-facing id of the plan this was logged against, for the same reason
     * {@link PlannedSession#getDayKey()} stores one: PUT /api/state recreates every day row on each
     * save. Keeping the key rather than a FK also lets the history outlive a deleted plan.
     */
    @Column(name = "day_key", nullable = false, length = 16)
    private String dayKey;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public LocalDate getSessionDate() { return sessionDate; }
    public void setSessionDate(LocalDate sessionDate) { this.sessionDate = sessionDate; }

    public String getDayKey() { return dayKey; }
    public void setDayKey(String dayKey) { this.dayKey = dayKey; }
}
