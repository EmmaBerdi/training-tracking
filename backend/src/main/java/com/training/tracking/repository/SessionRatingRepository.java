package com.training.tracking.repository;

import com.training.tracking.domain.SessionRating;
import com.training.tracking.domain.SessionRatingId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SessionRatingRepository extends JpaRepository<SessionRating, SessionRatingId> {
    List<SessionRating> findAllBySession_UserId(Long userId);

    /** See {@link SessionWarmupRepository#deleteAllByUserId}. */
    @Modifying
    @Query("DELETE FROM SessionRating sr WHERE sr.session.id IN "
            + "(SELECT s.id FROM Session s WHERE s.userId = :userId)")
    void deleteAllByUserId(@Param("userId") Long userId);
}
