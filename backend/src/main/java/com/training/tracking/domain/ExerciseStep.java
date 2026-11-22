package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One step of an exercise's planned progression; null sets or reps keep the plan's own. */
@Embeddable
public class ExerciseStep {

    @Column(nullable = false, length = 32)
    private String name;

    private Integer sets;

    @Column(length = 64)
    private String reps;

    @Column(length = 500)
    private String text;

    public ExerciseStep() { }

    public ExerciseStep(String name, Integer sets, String reps, String text) {
        this.name = name;
        this.sets = sets;
        this.reps = reps;
        this.text = text;
    }

    public String getName() { return name; }
    public Integer getSets() { return sets; }
    public String getReps() { return reps; }
    public String getText() { return text; }
}
