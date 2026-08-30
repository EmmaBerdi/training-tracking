package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
// Backtick-quoted because `day` is a reserved word in H2 (the test profile), where it names an
// interval field. PostgreSQL accepts it bare, which is why the changelog writes it unquoted.
@Table(name = "`day`", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "day_key"}))
public class Day {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The client-facing id ("mo", "tu", ...), unique per user rather than globally. */
    @Column(name = "day_key", nullable = false, length = 16)
    private String dayKey;

    @Column(name = "short_label", nullable = false, length = 32)
    private String shortLabel;

    /** One of 'morgens' | 'nachmittags'; DB CHECK enforces valid values. */
    @Column(nullable = false, length = 32)
    private String slot;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private int position;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getDayKey() { return dayKey; }
    public void setDayKey(String dayKey) { this.dayKey = dayKey; }

    public String getShortLabel() { return shortLabel; }
    public void setShortLabel(String shortLabel) { this.shortLabel = shortLabel; }

    public String getSlot() { return slot; }
    public void setSlot(String slot) { this.slot = slot; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
