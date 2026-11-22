package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** How hard one exercise felt in one logged workout. */
@Entity
@Table(name = "session_rating")
public class SessionRating {

    @EmbeddedId
    private SessionRatingId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("sessionId")
    @JoinColumn(name = "session_id")
    private Session session;

    @Column(nullable = false, length = 8)
    private String effort;

    /** The progression step the exercise was at, by name; null without one. */
    @Column(length = 32)
    private String step;

    public SessionRatingId getId() { return id; }
    public void setId(SessionRatingId id) { this.id = id; }

    public Session getSession() { return session; }
    public void setSession(Session session) { this.session = session; }

    public String getEffort() { return effort; }
    public void setEffort(String effort) { this.effort = effort; }

    public String getStep() { return step; }
    public void setStep(String step) { this.step = step; }
}
