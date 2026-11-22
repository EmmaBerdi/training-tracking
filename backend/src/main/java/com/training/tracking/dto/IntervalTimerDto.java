package com.training.tracking.dto;

import java.util.List;

public record IntervalTimerDto(
        Long id,
        String name,
        int prepareSec,
        List<TimerStepDto> steps
) {
}
