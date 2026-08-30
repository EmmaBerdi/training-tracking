package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "session_value")
public class SessionValue {

    @EmbeddedId
    private SessionValueId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("sessionId")
    @JoinColumn(name = "session_id")
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("exerciseId")
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    /** Backtick-quoted because `value` is a reserved word in H2 (used by the test profile). */
    @Column(name = "`value`", nullable = false, length = 64)
    private String value;

    public SessionValueId getId() { return id; }
    public void setId(SessionValueId id) { this.id = id; }

    public Session getSession() { return session; }
    public void setSession(Session session) { this.session = session; }

    public Exercise getExercise() { return exercise; }
    public void setExercise(Exercise exercise) { this.exercise = exercise; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
