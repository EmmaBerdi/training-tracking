package com.training.tracking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Creates or replaces a timer; the ranges mirror the CHECKs on {@code interval_timer}. */
public record IntervalTimerRequest(
        @NotBlank @Size(max = 64) String name,
        @Min(0) @Max(3600) int prepareSec,
        @Min(1) @Max(3600) int workSec,
        @Min(0) @Max(3600) int restSec
) {
}
