package com.training.tracking.dto;

/** What an upload answers with: the id the plan stores, plus the dimensions for laying it out. */
public record ExerciseImageDto(String id, int width, int height) {
}
