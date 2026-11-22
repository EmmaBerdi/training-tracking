package com.training.tracking.dto;

public record IntervalTimerDto(
        Long id,
        String name,
        int prepareSec,
        int workSec,
        int restSec
) {
}
