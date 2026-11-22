package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One interval of a timer's round: work, then rest. */
@Embeddable
public class TimerStep {

    @Column(name = "work_sec", nullable = false)
    private int workSec;

    @Column(name = "rest_sec", nullable = false)
    private int restSec;

    public TimerStep() { }

    public TimerStep(int workSec, int restSec) {
        this.workSec = workSec;
        this.restSec = restSec;
    }

    public int getWorkSec() { return workSec; }
    public int getRestSec() { return restSec; }
}
