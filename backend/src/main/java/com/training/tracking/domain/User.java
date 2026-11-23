package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
// Backtick-quoted because `user` is a reserved word in PostgreSQL and in H2 (the test
// profile); Hibernate rewrites the backticks into whichever quote character the dialect uses.
@Table(name = "`user`")
public class User {

    /** Created by an admin, waiting for its invitation to be accepted; has no password yet. */
    public static final String STATUS_INVITED = "invited";
    public static final String STATUS_ACTIVE = "active";
    /** Switched off by an admin: can't log in, but its data is kept. */
    public static final String STATUS_DEACTIVATED = "deactivated";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Null exactly while the account is invited. */
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    @Column(nullable = false)
    private String status = STATUS_ACTIVE;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isActive() { return STATUS_ACTIVE.equals(status); }

    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}
