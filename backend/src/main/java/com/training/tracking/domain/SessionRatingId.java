package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class SessionRatingId implements Serializable {

    private Long sessionId;

    @Column(name = "exercise_client_id", length = 32)
    private String exerciseClientId;

    public SessionRatingId() { }

    public SessionRatingId(Long sessionId, String exerciseClientId) {
        this.sessionId = sessionId;
        this.exerciseClientId = exerciseClientId;
    }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public String getExerciseClientId() { return exerciseClientId; }
    public void setExerciseClientId(String exerciseClientId) { this.exerciseClientId = exerciseClientId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SessionRatingId that)) return false;
        return Objects.equals(sessionId, that.sessionId)
                && Objects.equals(exerciseClientId, that.exerciseClientId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sessionId, exerciseClientId);
    }
}
