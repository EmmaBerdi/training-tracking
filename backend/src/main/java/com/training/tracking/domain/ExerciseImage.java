package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A setup photo for one exercise. Owned by a user, referenced by {@link Exercise#getImageId()}.
 *
 * <p>The id is assigned by the application rather than the database: the upload has to answer with
 * it before any exercise references it.
 */
@Entity
@Table(name = "exercise_image")
public class ExerciseImage {

    /** The column's width, and with it the largest upload that can be stored. */
    public static final int MAX_BYTES = 2 * 1024 * 1024;

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "content_type", nullable = false, length = 32)
    private String contentType;

    @Column(name = "byte_size", nullable = false)
    private int byteSize;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(nullable = false, length = MAX_BYTES)
    private byte[] data;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public int getByteSize() { return byteSize; }
    public void setByteSize(int byteSize) { this.byteSize = byteSize; }

    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }

    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
