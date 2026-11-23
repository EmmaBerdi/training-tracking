package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One interval of a timer's round: work, then rest; optionally named after its exercise. */
@Embeddable
public class TimerStep {

    @Column(name = "work_sec", nullable = false)
    private int workSec;

    @Column(name = "rest_sec", nullable = false)
    private int restSec;

    @Column(name = "name", length = 64)
    private String name;

    public TimerStep() { }

    public TimerStep(int workSec, int restSec, String name) {
        this.workSec = workSec;
        this.restSec = restSec;
        this.name = name;
    }

    public int getWorkSec() { return workSec; }
    public int getRestSec() { return restSec; }
    public String getName() { return name; }
}
