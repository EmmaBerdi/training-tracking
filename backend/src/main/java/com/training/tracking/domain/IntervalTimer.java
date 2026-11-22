package com.training.tracking.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.List;

/**
 * One round of an interval exercise: prepare once, then its intervals in order, each work and rest.
 * The exercise sets how many rounds.
 */
@Entity
@Table(name = "interval_timer")
public class IntervalTimer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "prepare_sec", nullable = false)
    private int prepareSec;

    /** Batched so listing the timers doesn't query once per timer. */
    @ElementCollection
    @CollectionTable(name = "interval_timer_step", joinColumns = @JoinColumn(name = "timer_id"))
    @OrderColumn(name = "position")
    @BatchSize(size = 100)
    private List<TimerStep> steps = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getPrepareSec() { return prepareSec; }
    public void setPrepareSec(int prepareSec) { this.prepareSec = prepareSec; }

    public List<TimerStep> getSteps() { return steps; }
    public void setSteps(List<TimerStep> steps) { this.steps = steps; }
}
