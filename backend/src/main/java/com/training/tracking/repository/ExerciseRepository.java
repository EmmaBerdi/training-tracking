package com.training.tracking.repository;

import com.training.tracking.domain.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExerciseRepository extends JpaRepository<Exercise, Long> {
    List<Exercise> findAllByBlock_UserIdOrderByPosition(Long userId);

    /**
     * Clears the photo lists before the exercises themselves, which a batch delete would leave
     * behind; see {@link SessionWarmupRepository#deleteAllByUserId}. Native because the list is an
     * element collection, which JPQL cannot delete from.
     */
    @Modifying
    @Query(value = "DELETE FROM exercise_image_link WHERE exercise_id IN "
            + "(SELECT e.id FROM exercise e JOIN block b ON b.id = e.block_id WHERE b.user_id = :userId)",
            nativeQuery = true)
    void deleteImageLinksByUserId(@Param("userId") Long userId);

    /** The progression steps, cleared before the exercises for the same reason as the photos. */
    @Modifying
    @Query(value = "DELETE FROM exercise_step WHERE exercise_id IN "
            + "(SELECT e.id FROM exercise e JOIN block b ON b.id = e.block_id WHERE b.user_id = :userId)",
            nativeQuery = true)
    void deleteStepsByUserId(@Param("userId") Long userId);

    /** Unlinks a timer about to be deleted; the FK's ON DELETE SET NULL does the same in Postgres. */
    @Modifying
    @Query("UPDATE Exercise e SET e.timerId = NULL WHERE e.timerId = :timerId")
    void clearTimer(@Param("timerId") Long timerId);
}
