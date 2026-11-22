package com.training.tracking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** One interval of a timer's round; the ranges mirror the CHECKs on {@code interval_timer_step}. */
public record TimerStepDto(
        @Min(1) @Max(3600) int workSec,
        @Min(0) @Max(3600) int restSec
) {
}
