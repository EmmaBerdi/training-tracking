package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One round of an interval exercise: prepare once, then work and rest; the exercise sets the rounds. */
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

    @Column(name = "work_sec", nullable = false)
    private int workSec;

    @Column(name = "rest_sec", nullable = false)
    private int restSec;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getPrepareSec() { return prepareSec; }
    public void setPrepareSec(int prepareSec) { this.prepareSec = prepareSec; }

    public int getWorkSec() { return workSec; }
    public void setWorkSec(int workSec) { this.workSec = workSec; }

    public int getRestSec() { return restSec; }
    public void setRestSec(int restSec) { this.restSec = restSec; }
}
