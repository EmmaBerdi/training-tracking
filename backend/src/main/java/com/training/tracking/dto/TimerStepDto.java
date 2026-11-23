package com.training.tracking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * One interval of a timer's round; the ranges mirror the CHECKs on {@code interval_timer_step}.
 * {@code name} is the exercise done during its work, or null when unnamed.
 */
public record TimerStepDto(
        @Min(1) @Max(3600) int workSec,
        @Min(0) @Max(3600) int restSec,
        @Size(max = 64) String name
) {
}
