package com.training.tracking.repository;

import com.training.tracking.domain.ExerciseImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExerciseImageRepository extends JpaRepository<ExerciseImage, UUID> {

    /** Always scoped by owner: an id alone must never be enough to read someone else's picture. */
    Optional<ExerciseImage> findByIdAndUserId(UUID id, Long userId);

    @Query("SELECT i.id FROM ExerciseImage i WHERE i.userId = :userId AND i.id IN :ids")
    List<UUID> findOwnedIds(@Param("userId") Long userId, @Param("ids") Collection<UUID> ids);

    /**
     * Drops this user's pictures that no exercise points at any more — the plan no longer carries
     * the reference, so nothing can ever reach them again.
     *
     * <p>{@code cutoff} spares images uploaded moments ago: the upload answers before the plan that
     * will reference it is saved, and a save arriving in between would otherwise collect a picture
     * the user is in the middle of attaching.
     */
    @Modifying
    @Query("DELETE FROM ExerciseImage i WHERE i.userId = :userId AND i.createdAt < :cutoff "
            + "AND NOT EXISTS (SELECT 1 FROM Exercise e WHERE e.imageId = i.id)")
    int deleteUnreferenced(@Param("userId") Long userId, @Param("cutoff") Instant cutoff);
}
