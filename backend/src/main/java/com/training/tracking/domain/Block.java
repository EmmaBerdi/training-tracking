package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "block")
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "day_id", nullable = false)
    private Day day;

    /** One of the BlockKind values the client offers; DB CHECK enforces valid values. */
    @Column(nullable = false, length = 32)
    private String kind;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int position;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Day getDay() { return day; }
    public void setDay(Day day) { this.day = day; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
