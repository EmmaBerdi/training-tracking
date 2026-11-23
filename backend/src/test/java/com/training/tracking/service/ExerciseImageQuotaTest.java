package com.training.tracking.service;

import com.training.tracking.domain.ExerciseImage;
import com.training.tracking.domain.User;
import com.training.tracking.repository.ExerciseImageRepository;
import com.training.tracking.repository.UserRepository;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Its own class because it runs with quotas small enough to reach in a test. */
@SpringBootTest(properties = {"app.images.max-count=3", "app.images.max-total-size=20KB"})
class ExerciseImageQuotaTest {

    @Autowired
    private ExerciseImageService exerciseImageService;

    @Autowired
    private ExerciseImageRepository imageRepository;

    @Autowired
    private UserRepository userRepository;

    private Long userId;

    @BeforeEach
    void createUser() {
        userId = newUser();
    }

    @Test
    void refusesAnImageOverTheCountLimit() throws IOException {
        for (int i = 0; i < 3; i++) {
            exerciseImageService.store(userId, tiny());
        }

        assertQuotaReached(() -> exerciseImageService.store(userId, tiny()));
    }

    /** About 12 KB each, since random pixels don't compress: one fits in 20 KB, two don't. */
    @Test
    void refusesAnImageOverTheSizeLimit() throws IOException {
        exerciseImageService.store(userId, noise());

        assertQuotaReached(() -> exerciseImageService.store(userId, noise()));
    }

    @Test
    void sweepsOldOrphansBeforeRefusing() throws IOException {
        for (int i = 0; i < 3; i++) {
            saveOrphan(userId, Instant.now().minus(Duration.ofHours(2)));
        }

        exerciseImageService.store(userId, tiny());

        assertThat(imageRepository.countByUserId(userId)).isEqualTo(1);
    }

    /** A picture uploaded moments ago may be about to land in a plan save, so it still counts. */
    @Test
    void freshOrphansStillCount() throws IOException {
        for (int i = 0; i < 3; i++) {
            exerciseImageService.store(userId, tiny());
        }

        assertQuotaReached(() -> exerciseImageService.store(userId, tiny()));
        assertThat(imageRepository.countByUserId(userId)).isEqualTo(3);
    }

    @Test
    void anotherUsersImagesDoNotCount() throws IOException {
        for (int i = 0; i < 3; i++) {
            exerciseImageService.store(userId, tiny());
        }

        Long otherUserId = newUser();
        exerciseImageService.store(otherUserId, tiny());

        assertThat(imageRepository.countByUserId(otherUserId)).isEqualTo(1);
    }

    private static void assertQuotaReached(ThrowingCallable upload) {
        assertThatThrownBy(upload)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("image quota reached");
    }

    private Long newUser() {
        User user = new User();
        user.setEmail("quota-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setCreatedAt(Instant.now());
        userRepository.save(user);
        return user.getId();
    }

    private void saveOrphan(Long owner, Instant createdAt) throws IOException {
        byte[] bytes = encode(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB));
        ExerciseImage image = new ExerciseImage();
        image.setId(UUID.randomUUID());
        image.setUserId(owner);
        image.setContentType("image/png");
        image.setByteSize(bytes.length);
        image.setWidth(1);
        image.setHeight(1);
        image.setData(bytes);
        image.setCreatedAt(createdAt);
        imageRepository.save(image);
    }

    private static MockMultipartFile tiny() throws IOException {
        return upload(encode(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB)));
    }

    private static MockMultipartFile noise() throws IOException {
        BufferedImage image = new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB);
        Random random = new Random();
        for (int x = 0; x < 64; x++) {
            for (int y = 0; y < 64; y++) {
                image.setRGB(x, y, random.nextInt(0x1000000));
            }
        }
        return upload(encode(image));
    }

    private static byte[] encode(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static MockMultipartFile upload(byte[] bytes) {
        return new MockMultipartFile("file", "setup.png", "image/png", bytes);
    }
}
